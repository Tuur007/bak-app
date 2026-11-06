// Gezin: samen op dezelfde starter werken. De eigenaar maakt een gezinscode, een ander (met een eigen account)
// vult ze in en werkt dan op dezelfde gegevens: voeden, noteren, koelkast. Elke voeding krijgt de naam van wie voedde.
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { fmtDayTime } from '../domain/dates';
import { useSessionEmail } from '../services/auth';
import { createHouseholdCode, fetchHousehold, joinHousehold, myHouseholdCode, removeMembership, type HouseholdCode } from '../services/household';
import { supabase } from '../services/supabase';
import { syncNow } from '../services/sync';
import { useCrumbly } from '../store/store';
import { Button, Card, Field, Gap, Row, Txt } from './kit';
import { colors, space } from './theme';

/**
 * Bij een gezin komen: gezinscode van de eigenaar en je eigen naam (die komt bij wat je noteert). Gebruikt in Instellingen,
 * Delen en in het welkomscherm. `onJoined` loopt nadat de gegevens van het gezin zijn opgehaald.
 */
export function GezinJoin({ onJoined }: { onJoined?: () => void | Promise<void> }) {
  const setHousehold = useCrumbly((s) => s.setHousehold);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (!supabase) return null;
  return (
    <>
      <Field label="Gezinscode van de ander" value={code} onChange={setCode} placeholder="bv. 3F9A12BC07" />
      <Field label="Jouw naam (komt bij elke voeding die jij noteert)" value={name} onChange={setName} placeholder="bv. Louise" />
      <Txt v="note">Je werkt dan op de gegevens van de ander: dezelfde starter, voedingen, recepten en bakken. Je eigen Crumbly-gegevens op dit toestel worden vervangen, ze blijven wel bewaard in je account.</Txt>
      <Button small v="green" label={busy ? 'Even geduld...' : 'Ga bij het gezin'} disabled={busy || code.trim() === '' || name.trim() === ''} onPress={async () => {
        setBusy(true); setMsg('');
        const r = await joinHousehold(supabase!, code, name);
        if ('error' in r) { setMsg(r.error); setBusy(false); return; }
        setCode('');
        setMsg('Je zit nu in het gezin. De gegevens worden opgehaald.');
        await syncNow();
        try {
          const { data } = await supabase!.auth.getSession();
          const me = data.session?.user.id;
          if (me) setHousehold(await fetchHousehold(supabase!, me));
        } catch { /* de laatst bekende stand blijft */ }
        await onJoined?.();
        setBusy(false);
      }} />
      {msg ? <Txt v="bold" style={{ color: colors.bor, marginVertical: space(1) }}>{msg}</Txt> : null}
    </>
  );
}

export function Gezin() {
  const user = useSessionEmail();
  const household = useCrumbly((s) => s.household);
  const setHousehold = useCrumbly((s) => s.setHousehold);
  const ownerName = useCrumbly((s) => s.ownerName);
  const [code, setCode] = useState<HouseholdCode | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const reload = async (): Promise<void> => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const me = data.session?.user.id;
    if (!me) return;
    try {
      setHousehold(await fetchHousehold(supabase, me));
    } catch {
      /* de laatst bekende stand blijft */
    }
    setCode(await myHouseholdCode(supabase));
  };
  useEffect(() => { if (user) void reload(); }, [user]);
  if (!supabase || !user) return null;

  const role = household?.role ?? 'geen';
  const shownName = myName ?? ownerName ?? '';

  const makeCode = async (): Promise<void> => {
    setBusy(true); setMsg('');
    const r = await createHouseholdCode(supabase!);
    if ('error' in r) setMsg(r.error);
    else setCode(await myHouseholdCode(supabase!));
    setBusy(false);
  };

  const share = async (): Promise<void> => {
    if (!code) return;
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }) : undefined;
    try {
      if (Platform.OS === 'web' && nav?.share) { await nav.share({ text: `Gezinscode voor Crumbly: ${code.code}` }); return; }
      if (Platform.OS === 'web' && nav?.clipboard) { await nav.clipboard.writeText(code.code); setMsg('Code gekopieerd.'); return; }
    } catch {
      return;
    }
    setMsg('Delen lukt niet op dit toestel. Schrijf de code over.');
  };

  const saveOwnerName = async (): Promise<void> => {
    const n = shownName.trim();
    if (!n) return;
    const { error } = await supabase!.auth.updateUser({ data: { crumbly_name: n.slice(0, 40) } });
    if (error) setMsg('Naam bewaren lukte niet.');
    else { setHousehold(household, n.slice(0, 40)); setMsg('Naam bewaard.'); }
  };

  const remove = async (owner: string, member: string): Promise<void> => {
    setBusy(true); setMsg(''); setConfirm(null);
    const r = await removeMembership(supabase!, owner, member);
    if ('error' in r) setMsg(r.error);
    else { setMsg(member === owner ? '' : 'Verwijderd uit het gezin.'); await syncNow(); await reload(); }
    setBusy(false);
  };

  return (
    <Card>
      <Txt v="folio">Gezin: samen op dezelfde starter</Txt>

      {role === 'lid' ? (
        <>
          <Txt style={st.mt}>Je werkt in het gezin van de eigenaar, als {household?.myName}. Je ziet en noteert dezelfde starter, voedingen, recepten en bakken. Je naam komt bij wat je noteert.</Txt>
          {confirm === 'verlaat' ? (
            <>
              <Txt v="bold" style={st.warn}>Je ziet de gegevens van het gezin dan niet meer en werkt weer op je eigen gegevens. Zeker?</Txt>
              <Row>
                <Button small v="danger" label="Ja, verlaat het gezin" disabled={busy} onPress={async () => {
                  const { data } = await supabase!.auth.getSession();
                  const me = data.session?.user.id;
                  if (me && household) await remove(household.dataId, me);
                }} />
                <Button small v="ghost" label="Nee" onPress={() => setConfirm(null)} />
              </Row>
            </>
          ) : (
            <Button small v="ghost" label="Verlaat het gezin" onPress={() => setConfirm('verlaat')} style={st.left} />
          )}
        </>
      ) : (
        <>
          <Txt v="note" style={st.mt}>Werken jullie samen aan één starter, bijvoorbeeld als gezin? Eén iemand (de eigenaar) maakt een gezinscode, de ander vult ze in met een eigen account. Daarna zien jullie allebei hetzelfde en kunnen jullie allebei voeden en noteren. Bij elke voeding staat wie ze noteerde.</Txt>

          {role === 'eigenaar' ? (
            <>
              <Txt v="label" style={st.mt}>Wie zit er in jouw gezin</Txt>
              {household?.members.map((m) => (
                <View key={m.userId} style={st.day}>
                  <Txt v="bold">{m.name}</Txt>
                  <Txt v="note">Sinds {fmtDayTime(new Date(m.joinedAt), new Date())}</Txt>
                  {confirm === m.userId ? (
                    <>
                      <Txt v="bold" style={st.warn}>{m.name} ziet de gegevens dan niet meer. Zeker?</Txt>
                      <Row>
                        <Button small v="danger" label="Ja, zet weg" disabled={busy} onPress={async () => {
                          const { data } = await supabase!.auth.getSession();
                          const me = data.session?.user.id;
                          if (me) await remove(me, m.userId);
                        }} />
                        <Button small v="ghost" label="Nee" onPress={() => setConfirm(null)} />
                      </Row>
                    </>
                  ) : (
                    <Button small v="ghost" label="Zet weg uit het gezin" onPress={() => setConfirm(m.userId)} style={st.left} />
                  )}
                </View>
              ))}
            </>
          ) : null}

          <Gap />
          <Txt v="label">Iemand uitnodigen</Txt>
          {code ? (
            <>
              <Txt v="h3" style={st.code}>{code.code}</Txt>
              <Txt v="note">Geef deze code aan de ander. Ze werkt één keer, tot {fmtDayTime(new Date(code.expiresAt), new Date())}.</Txt>
              <Row style={st.mt}>
                <Button small v="outline" label="Deel de code" onPress={() => void share()} />
              </Row>
            </>
          ) : (
            <Button small v="outline" label={busy ? 'Even geduld...' : 'Maak een gezinscode'} disabled={busy} onPress={() => void makeCode()} style={st.left} />
          )}

          {role === 'eigenaar' || code ? (
            <>
              <Gap />
              <Field label="Jouw naam in het gezin" value={shownName} onChange={setMyName} placeholder="bv. Tuur" />
              <Txt v="note">Die naam komt bij elke voeding die jij noteert, zodra er iemand in het gezin zit.</Txt>
              <Button small v="outline" label="Bewaar mijn naam" disabled={shownName.trim() === ''} onPress={() => void saveOwnerName()} style={st.left} />
            </>
          ) : null}

          {role === 'geen' ? (
            <>
              <Gap />
              <Txt v="label">Of ga zelf bij een gezin</Txt>
              <GezinJoin onJoined={reload} />
            </>
          ) : null}
        </>
      )}
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
