import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { peerName } from '../domain/peers';
import { useSessionEmail } from '../services/auth';
import { fmtDayTime } from '../domain/dates';
import { createLinkCode, myLinkCode, redeemLinkCode, unlinkPeer, type MyLinkCode } from '../services/peers';
import { supabase } from '../services/supabase';
import { syncNow } from '../services/sync';
import { useCrumbly } from '../store/store';
import { Button, Card, Field, Gap, Row, Txt } from './kit';
import { colors, space } from './theme';

export function Koppelen() {
  const user = useSessionEmail();
  const peers = useCrumbly((s) => s.peers);
  const ownName = useCrumbly((s) => s.starter?.name);
  const [code, setCode] = useState('');
  const [mine, setMine] = useState<MyLinkCode | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);

  // Toon meteen je geldige code (ook als je ze op een ander toestel maakte).
  const refresh = async (): Promise<void> => {
    if (!supabase) return;
    setMine(await myLinkCode(supabase));
  };
  useEffect(() => { if (user) void refresh(); }, [user]);
  if (!supabase || !user) return null;

  const make = async (fresh: boolean): Promise<void> => {
    setBusy(true); setMsg(''); setConfirmNew(false);
    const r = await createLinkCode(supabase!, fresh);
    if ('error' in r) setMsg(r.error);
    else {
      const full = await myLinkCode(supabase!);
      // Oudere databank zonder bak_my_link_code: toon de code zonder einddatum.
      setMine(full && full.code === r.code ? full : { code: r.code, expiresAt: '' });
    }
    setBusy(false);
  };

  const share = async (): Promise<void> => {
    if (!mine) return;
    const text = `Mijn koppelcode voor Crumbly: ${mine.code}`;
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }) : undefined;
    try {
      if (Platform.OS === 'web' && nav?.share) { await nav.share({ text }); return; }
      if (Platform.OS === 'web' && nav?.clipboard) { await nav.clipboard.writeText(mine.code); setMsg('Code gekopieerd.'); return; }
    } catch {
      return; // delen geannuleerd
    }
    setMsg('Delen lukt niet op dit toestel. Schrijf de code over.');
  };

  return (
    <Card>
      <Txt v="folio">Koppelen met een ander account</Txt>
      <Txt v="note" style={st.mt}>Zo zien jullie elkaars starter: leeftijd, voedingen en of hij klaar is. Enkel kijken, niemand kan iets van de ander aanpassen. Recepten, bakken en broden blijven privé.</Txt>
      {peers.map((p) => (
        <View key={p.userId} style={st.day}>
          <Txt v="bold">Gekoppeld met {peerName(p, ownName)}</Txt>
          {confirm === p.userId ? (
            <>
              <Txt v="bold" style={st.warn}>Jullie zien elkaars starter dan niet meer. Zeker?</Txt>
              <Row>
                <Button small v="danger" label="Ja, ontkoppelen" onPress={async () => {
                  const { data } = await supabase!.auth.getSession();
                  const me = data.session?.user.id;
                  const r = me ? await unlinkPeer(supabase!, me, p.userId) : { error: 'Niet aangemeld.' };
                  setConfirm(null);
                  if ('error' in r) setMsg(r.error); else { setMsg('Ontkoppeld.'); void syncNow(); }
                }} />
                <Button small v="ghost" label="Nee" onPress={() => setConfirm(null)} />
              </Row>
            </>
          ) : (
            <Button small v="ghost" label="Ontkoppelen" onPress={() => setConfirm(p.userId)} style={st.left} />
          )}
        </View>
      ))}
      <Gap />
      <Txt v="label">Een code geven aan de ander</Txt>
      {mine ? (
        <>
          <Txt v="h3" style={st.code}>{mine.code}</Txt>
          <Txt v="note">
            Geef deze code aan de ander, die ze invult op haar of zijn eigen account. Ze werkt één keer
            {mine.expiresAt ? `, tot ${fmtDayTime(new Date(mine.expiresAt), new Date())}` : ''}. Op al je toestellen zie je dezelfde code.
          </Txt>
          <Row style={st.mt}>
            <Button small v="outline" label="Deel de code" onPress={() => void share()} />
            <Button small v="ghost" label="Nieuwe code" disabled={busy} onPress={() => setConfirmNew(true)} />
          </Row>
          {confirmNew ? (
            <>
              <Txt v="bold" style={st.warn}>De code {mine.code} werkt dan niet meer. Zeker?</Txt>
              <Row>
                <Button small v="danger" label="Ja, nieuwe code" onPress={() => void make(true)} />
                <Button small v="ghost" label="Nee" onPress={() => setConfirmNew(false)} />
              </Row>
            </>
          ) : null}
        </>
      ) : (
        <Button small v="outline" label={busy ? 'Even geduld...' : 'Maak een koppelcode'} disabled={busy} onPress={() => void make(false)} style={st.left} />
      )}
      <Gap />
      <Field label="Of vul de code van de ander in" value={code} onChange={setCode} placeholder="bv. 3F9A12BC07" />
      <Button small v="green" label="Koppel" disabled={busy || code.trim() === ''} onPress={async () => {
        setBusy(true); setMsg('');
        if (mine && code.trim().toUpperCase() === mine.code) { setMsg('Dit is je eigen code. Die vult de ander in, op een ander account.'); setBusy(false); return; }
        const r = await redeemLinkCode(supabase!, code);
        if ('error' in r) setMsg(r.error); else { setCode(''); setMsg('Gekoppeld. De starter van de ander verschijnt zo.'); await syncNow(); }
        setBusy(false);
      }} />
      {msg ? <Txt v="bold" style={st.warn}>{msg}</Txt> : null}
    </Card>
  );
}

const st = StyleSheet.create({
  mt: { marginTop: space(1) },
  warn: { color: colors.bor, marginVertical: space(1) },
  day: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space(1), marginTop: space(1) },
  left: { alignSelf: 'flex-start' },
  code: { marginTop: space(1), fontSize: 28, lineHeight: 36, letterSpacing: 3, color: colors.grn },
});
