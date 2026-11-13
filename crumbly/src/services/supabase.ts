import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isNetworkError, NETWORK_TEXT } from '../domain/errors';
import { fetchWithTimeout } from './runGuard';

// Hetzelfde Supabase-project als de Recepten-app en de Tuin-app: een login voor alles.
// Zonder de twee variabelen werkt Crumbly gewoon lokaal, zonder sync.
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  URL && KEY
    ? createClient(URL, KEY, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
        // Een verzoek dat nooit antwoordt (de iPhone pauzeerde de app) eindigt na 20 seconden met een netwerkfout.
        global: { fetch: fetchWithTimeout((input, init) => fetch(input, init)) },
      })
    : null;

/** Sleutel waaronder supabase-js de sessie op het toestel bewaart (zelfde regel als in de bibliotheek). */
export const authStorageKey: string | null = (() => {
  if (!URL) return null;
  try {
    return `sb-${new globalThis.URL(URL).hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
})();

export const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

/** Supabase geeft Engelse foutteksten; vertaal de gewone. */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mailadres of wachtwoord klopt niet.';
  if (m.includes('email not confirmed')) return 'Bevestig eerst je e-mailadres via de link die je kreeg.';
  if (isNetworkError(message) || m.includes('network') || m.includes('fetch')) return NETWORK_TEXT;
  return message;
}
