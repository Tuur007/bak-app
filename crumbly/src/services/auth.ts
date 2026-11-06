import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authStorageKey, supabase, translateAuthError } from './supabase';

/** E-mailadres van wie aangemeld is (null = niet aangemeld, undefined = nog aan het kijken). */
export function useSessionEmail(): string | null | undefined {
  const [email, setEmail] = useState<string | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return email;
}

export type AuthGate = 'laden' | 'in' | 'uit';

/** Staat er op dit toestel een bewaarde sessie? Leest enkel de opslag, nooit het netwerk. */
export async function hasStoredSession(): Promise<boolean> {
  if (!authStorageKey) return false;
  try {
    const raw = await AsyncStorage.getItem(authStorageKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { user?: unknown; refresh_token?: unknown } | null;
    return !!parsed && (!!parsed.user || typeof parsed.refresh_token === 'string');
  } catch {
    return false;
  }
}

/**
 * Wie mag de app in? Een bewaarde sessie op het toestel telt meteen: de app opent dus ook zonder of met trage
 * verbinding. getSession kan lang wachten (het ververst een verlopen sessie via het netwerk) en mag de app
 * niet blokkeren. Is de sessie echt ingetrokken, dan volgt "uit" via de aanmeldmelding of via getSession.
 */
export function useAuthGate(): AuthGate {
  const [gate, setGate] = useState<AuthGate>(supabase ? 'laden' : 'in');
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void hasStoredSession().then((stored) => {
      if (!alive) return;
      // Geen bewaarde sessie: getSession antwoordt dan meteen zonder netwerk (hieronder).
      if (stored) setGate((g) => (g === 'laden' ? 'in' : g));
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setGate(data.session ? 'in' : 'uit');
    }).catch(() => {
      if (alive) setGate((g) => (g === 'laden' ? 'uit' : g));
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setGate(session ? 'in' : 'uit');
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  return gate;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Sync is niet ingesteld.';
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? translateAuthError(error.message) : null;
}

/** Nieuw account (zelfde login als de Recepten-app). Geeft een boodschap terug. */
export async function signUp(email: string, password: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Sync is niet ingesteld.' };
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return { ok: false, message: 'Vul een geldig e-mailadres in.' };
  if (password.length < 8) return { ok: false, message: 'Kies een wachtwoord van minstens 8 tekens.' };
  const redirect = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: redirect ? { emailRedirectTo: redirect } : undefined });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('already registered') || m.includes('already exists')) return { ok: false, message: 'Er bestaat al een account met dit e-mailadres. Meld je aan.' };
    return { ok: false, message: translateAuthError(error.message) };
  }
  if (!data.session) return { ok: true, message: 'Bijna klaar: bevestig je e-mailadres via de link in je mailbox en meld je daarna hier aan.' };
  return { ok: true, message: 'Account gemaakt. Je bent aangemeld.' };
}

export async function sendPasswordReset(email: string): Promise<string> {
  if (!supabase) return 'Sync is niet ingesteld.';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Vul eerst je e-mailadres in.';
  const redirect = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), redirect ? { redirectTo: redirect } : undefined);
  return error ? translateAuthError(error.message) : 'Je krijgt een mail om een nieuw wachtwoord te kiezen.';
}
