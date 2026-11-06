import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { peerName } from '../domain/peers';
import { useSessionEmail } from '../services/auth';
import { createLinkCode, redeemLinkCode, unlinkPeer } from '../services/peers';
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
  const [mine, setMine] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!supabase || !user) return null;

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
      <Button small v="outline" label={mine ? 'Nieuwe code maken' : 'Maak een koppelcode'} disabled={busy} onPress={async () => {
        setBusy(true); setMsg('');
        const r = await createLinkCode(supabase!);
        if ('error' in r) setMsg(r.error); else setMine(r.code);
        setBusy(false);
      }} />
      {mine ? <Txt v="h2" style={st.mt}>{mine}</Txt> : null}
      {mine ? <Txt v="note">Geef deze code aan de ander. Ze werkt eenmalig en een dag lang.</Txt> : null}
      <Gap />
      <Field label="Of vul de code van de ander in" value={code} onChange={setCode} placeholder="bv. 3F9A12BC07" />
      <Button small v="green" label="Koppel" disabled={busy || code.trim() === ''} onPress={async () => {
        setBusy(true); setMsg('');
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
});
