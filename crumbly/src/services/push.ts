// Meldingen via Web Push (zoals in de Tuin-app). Op een iPhone werkt dit enkel als
// Crumbly op het beginscherm staat (iOS 16.4 of nieuwer), en de toestemming moet uit
// een tik komen.

import { Platform } from 'react-native';
import { supabase, VAPID_PUBLIC_KEY } from './supabase';

export type PushStatus = 'laden' | 'nog-niet' | 'niet-ondersteund' | 'iphone-installeren' | 'geweigerd' | 'uit' | 'aan';

function keyToBytes(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function supported(): boolean {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;
}

export async function pushStatus(): Promise<PushStatus> {
  if (!VAPID_PUBLIC_KEY || !supabase) return 'nog-niet';
  if (!supported()) {
    const iphone = typeof navigator !== 'undefined' && /iphone|ipad/i.test(navigator.userAgent);
    return iphone ? 'iphone-installeren' : 'niet-ondersteund';
  }
  if (Notification.permission === 'denied') return 'geweigerd';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? 'aan' : 'uit';
}

export async function turnPushOn(): Promise<{ ok: boolean; message: string }> {
  if (!supabase || !VAPID_PUBLIC_KEY) return { ok: false, message: 'Meldingen zijn nog niet ingesteld op de server.' };
  if (!supported()) return { ok: false, message: 'Zet Crumbly eerst op je beginscherm (Deel, Zet op beginscherm) en open het van daaruit.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, message: 'Zonder toestemming kan Crumbly geen melding sturen.' };
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) as BufferSource }));
  const json = sub.toJSON();
  const { error } = await supabase.from('bak_push_subscriptions').upsert(
    { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    { onConflict: 'endpoint' },
  );
  if (error) return { ok: false, message: `Opslaan mislukt: ${error.message}` };
  return { ok: true, message: 'Meldingen staan aan.' };
}

/**
 * Houdt de meldingen in orde zonder dat je iets tikt. Heb je ooit "Meldingen aanzetten" gekozen en is de toestemming nog
 * aan, dan zorgen we dat de server een geldig abonnement van dit toestel heeft: de server wist verlopen abonnementen, en
 * iOS laat een abonnement soms vallen. Zonder dit komen er stilletjes geen meldingen meer. Doet niets als je meldingen
 * uitzette of nooit aanzette. Geeft terug wat er gebeurde (voor de tests).
 */
export async function refreshPushSubscription(): Promise<'niets' | 'bevestigd' | 'hersteld' | 'mislukt'> {
  try {
    if (!supabase || !VAPID_PUBLIC_KEY || !supported() || Notification.permission !== 'granted') return 'niets';
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return 'niets';
    let sub = await reg.pushManager.getSubscription();
    let restored = false;
    if (!sub) {
      // De toestemming is er nog, het abonnement niet meer: opnieuw aanmaken mag zonder tik.
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) as BufferSource });
      restored = true;
    }
    const json = sub.toJSON();
    const { error } = await supabase.from('bak_push_subscriptions').upsert(
      { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
      { onConflict: 'endpoint' },
    );
    if (error) return 'mislukt';
    return restored ? 'hersteld' : 'bevestigd';
  } catch {
    return 'mislukt';
  }
}

export async function turnPushOff(): Promise<void> {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  if (supabase) await supabase.from('bak_push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export function registerServiceWorker(): void {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // Vraag de browser om de gegevens op dit toestel niet op te ruimen bij plaatsgebrek.
  const storage = (navigator as Navigator & { storage?: { persist?: () => Promise<boolean> } }).storage;
  storage?.persist?.().catch(() => undefined);
  if (typeof __DEV__ !== 'undefined' && __DEV__) return;
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

/**
 * Plant een testmelding die binnen een minuut moet aankomen (de wekker-functie in de databank
 * verstuurt ze zoals elke andere wekker). Het id begint met 'test:' zodat de planning ze niet wist.
 */
export async function sendTestReminder(): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Sync is niet ingesteld.' };
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { ok: false, message: 'Meld je eerst aan.' };
  const status = await pushStatus();
  if (status !== 'aan') return { ok: false, message: 'Zet eerst de meldingen aan op dit toestel.' };
  const { error } = await supabase.from('bak_reminders').upsert(
    { id: `test:${Date.now()}`, due_at: new Date().toISOString(), title: 'Crumbly', body: 'Testmelding: je wekkers werken.', url: '/', sent_at: null },
    { onConflict: 'user_id,id' },
  );
  if (error) return { ok: false, message: `Mislukt: ${error.message}` };
  return { ok: true, message: 'Binnen een minuut moet er een melding komen. Komt er niets, sluit de app dan en wacht nog eens twee minuten.' };
}
