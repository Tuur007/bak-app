import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { YoungSerif_400Regular } from '@expo-google-fonts/young-serif/400Regular';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthGate, useSessionEmail } from '../src/services/auth';
import { refreshPushSubscription, registerServiceWorker } from '../src/services/push';
import { supabase } from '../src/services/supabase';
import { AanmeldScherm } from '../src/ui/AuthForm';
import { syncNow } from '../src/services/sync';
import { useCrumbly } from '../src/store/store';
import { colors } from '../src/ui/theme';

function useHydrated(): boolean {
  const [done, setDone] = useState(() => useCrumbly.persist.hasHydrated());
  useEffect(() => {
    const unsub = useCrumbly.persist.onFinishHydration(() => setDone(true));
    if (useCrumbly.persist.hasHydrated()) setDone(true);
    return unsub;
  }, []);
  return done;
}

/** Sync bij opstarten, bij terugkeren naar de app, elke 2 minuten en kort na een wijziging. */
function useSyncLoop(enabled: boolean): void {
  const dirtyCount = useCrumbly((s) => s.dirty.length);
  useEffect(() => {
    if (!enabled) return;
    void syncNow();
    const id = setInterval(() => void syncNow(), 120_000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        void syncNow();
        void refreshPushSubscription();
      }
    });
    const onVis = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void syncNow();
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      sub.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || dirtyCount === 0) return;
    const t = setTimeout(() => void syncNow(), 2000);
    return () => clearTimeout(t);
  }, [enabled, dirtyCount]);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ YoungSerif_400Regular, Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold });
  const hydrated = useHydrated();
  const seedIfEmpty = useCrumbly((s) => s.seedIfEmpty);
  const sessionEmail = useSessionEmail();
  const gate = useAuthGate();

  useEffect(() => {
    if (hydrated) seedIfEmpty();
  }, [hydrated, seedIfEmpty]);
  useEffect(() => registerServiceWorker(), []);

  // Vaste voeduur: noteer de voedingen die zijn voorbijgekomen (bij opstarten, bij terugkeer en elke 5 minuten).
  // "Ik ben weg" met de starter in de koelkast: noteer de verplaatsing bij vertrek (voor de voedingen).
  const ensureAutoFeeds = useCrumbly((s) => s.ensureAutoFeeds);
  const ensureAwayFridge = useCrumbly((s) => s.ensureAwayFridge);
  useEffect(() => {
    if (!hydrated) return;
    const tick = (): void => { ensureAwayFridge(); ensureAutoFeeds(); };
    tick();
    const id = setInterval(tick, 300_000);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') tick(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [hydrated, ensureAutoFeeds, ensureAwayFridge]);
  useSyncLoop(hydrated);
  // Net aangemeld: meteen synchroniseren, zodat je gegevens en die van de ander er zijn.
  useEffect(() => {
    if (hydrated && typeof sessionEmail === 'string') {
      void syncNow();
      void refreshPushSubscription();
    }
  }, [hydrated, sessionEmail]);

  // Eerst aanmelden: zonder account zie je niets van de app. Zonder Supabase-gegevens (lokaal testen) geldt dit niet.
  const checkingSession = gate === 'laden';
  if (!fontsLoaded || !hydrated || checkingSession) {
    return (
      <View style={st.boot}>
        <Text style={st.bootText}>Crumbly</Text>
      </View>
    );
  }
  if (supabase && gate === 'uit') {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AanmeldScherm />
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  bootText: { fontFamily: 'Georgia', fontSize: 28, color: colors.grn },
});
