import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { pushStatus, type PushStatus } from './push';
import { useSessionEmail } from './auth';
import { supabase } from './supabase';

export type AlarmState =
  | { ok: true }
  | { ok: false; reason: 'geen-account' | 'uit' | 'iphone-installeren' | 'geweigerd' | 'niet-ondersteund' | 'nog-niet'; text: string; action: 'instellingen' | null };

function describe(push: PushStatus, signedIn: boolean): AlarmState | null {
  if (!supabase) return { ok: false, reason: 'nog-niet', text: 'Wekkers (meldingen) zijn nog niet ingesteld. Het schema met uren werkt wel.', action: null };
  if (!signedIn) return { ok: false, reason: 'geen-account', text: 'De bel doet nog niets: wekkers werken pas met een account.', action: 'instellingen' };
  switch (push) {
    case 'aan': return null;
    case 'uit': return { ok: false, reason: 'uit', text: 'De bel doet nog niets: de meldingen staan uit op dit toestel.', action: 'instellingen' };
    case 'iphone-installeren': return { ok: false, reason: 'iphone-installeren', text: 'De bel doet nog niets: zet Crumbly eerst op je beginscherm (Deel, Zet op beginscherm).', action: 'instellingen' };
    case 'geweigerd': return { ok: false, reason: 'geweigerd', text: 'De bel doet niets: je hebt meldingen geweigerd. Zet ze aan bij Instellingen van je telefoon, Meldingen, Crumbly.', action: null };
    case 'nog-niet': return { ok: false, reason: 'nog-niet', text: 'Wekkers (meldingen) zijn nog niet ingesteld. Het schema met uren werkt wel.', action: null };
    case 'niet-ondersteund': return { ok: false, reason: 'niet-ondersteund', text: 'Deze browser kan geen meldingen ontvangen. Het schema met uren werkt wel.', action: null };
    default: return null; // 'laden': nog niet tonen
  }
}

/** Kunnen de wekkers (meldingen) nu echt afgaan op dit toestel? Ververst bij terugkeer naar de app. */
export function useAlarmState(): AlarmState | 'laden' {
  const email = useSessionEmail();
  const [push, setPush] = useState<PushStatus>('laden');
  useEffect(() => {
    let alive = true;
    const check = (): void => { void pushStatus().then((s) => alive && setPush(s)).catch(() => alive && setPush('niet-ondersteund')); };
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => { alive = false; sub.remove(); };
  }, [email]);
  if (email === undefined || push === 'laden') return 'laden';
  return describe(push, email !== null) ?? { ok: true };
}
