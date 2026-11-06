import { useRouter } from 'expo-router';
import { GLOSSARY } from '../src/domain/glossary';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { dayName, fmtDayTime } from '../src/domain/dates';
import type { HomeWindow } from '../src/domain/types';
import { downloadBackup, parseBackup } from '../src/services/backup';
import { pushStatus, sendTestReminder, turnPushOff, turnPushOn, type PushStatus } from '../src/services/push';
import { useSessionEmail } from '../src/services/auth';
import { supabase } from '../src/services/supabase';
import { getSyncStatus, onSyncStatus, syncNow, type SyncStatus } from '../src/services/sync';
import { useCrumbly } from '../src/store/store';
import { Gezin } from '../src/ui/Gezin';
import { Koppelen } from '../src/ui/Koppelen';
import { Button, Card, Field, Gap, Row, Screen, Segmented, Toggle, Txt } from '../src/ui/kit';
import { colors, space } from '../src/ui/theme';
import { HhmmStepper } from '../src/ui/widgets';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

function Account() {
  const user = useSessionEmail();
  const dirtyCount = useCrumbly((s) => s.dirty.length);
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => onSyncStatus(setSync), []);
  if (!supabase || !user) return null;
  const statusText =
    sync.kind === 'ok' ? `Gesynchroniseerd, ${fmtDayTime(new Date(sync.at), new Date())}.` : sync.kind === 'bezig' ? 'Bezig met synchroniseren...' : sync.kind === 'fout' ? sync.message : sync.reason;
  return (
    <Card>
      <Txt v="folio">Account en sync</Txt>
      <Txt style={st.mt}>Aangemeld als {user}.</Txt>
      <Txt v="note">{statusText}</Txt>
      <Txt v="note">{dirtyCount === 0 ? 'Alles is verstuurd.' : `${dirtyCount} ${dirtyCount === 1 ? 'wijziging wacht' : 'wijzigingen wachten'} om verstuurd te worden.`}</Txt>
      <Gap />
      <Row>
        <Button small v="green" label="Nu synchroniseren" onPress={() => void syncNow()} />
        <Button small v="ghost" label="Afmelden" onPress={() => void supabase?.auth.signOut()} />
      </Row>
    </Card>
  );
}

function Meldingen() {
  const feedReminder = useCrumbly((s) => s.settings.feedReminder);
  const updateSettings = useCrumbly((s) => s.updateSettings);
  const starterName = useCrumbly((s) => s.starter?.name ?? 'je starter');
  const [status, setStatus] = useState<PushStatus>('laden');
  const [msg, setMsg] = useState('');
  useEffect(() => { void pushStatus().then(setStatus).catch(() => setStatus('niet-ondersteund')); }, []);

  const text: Record<PushStatus, string> = {
    laden: 'Even kijken...',
    'nog-niet': 'Meldingen zijn nog niet ingesteld op de server. Het schema met uren werkt wel.',
    'niet-ondersteund': 'Deze browser kan geen meldingen ontvangen.',
    'iphone-installeren': 'Zet Crumbly eerst op je beginscherm (Deel, Zet op beginscherm) en open het van daaruit.',
    geweigerd: 'Je hebt meldingen geweigerd. Zet ze aan in Instellingen, Meldingen, Crumbly.',
    uit: 'Meldingen staan uit.',
    aan: 'Meldingen staan aan op dit toestel.',
  };
  return (
    <Card>
      <Txt v="folio">Wekkers en meldingen</Txt>
      <Txt style={st.mt}>{text[status]}</Txt>
      <Txt v="note">Een melding kan een paar minuten later komen. De uren staan altijd in het bakplan.</Txt>
      <Gap />
      {status === 'uit' ? <Button v="green" label="Meldingen aanzetten" onPress={async () => { const r = await turnPushOn(); setMsg(r.message); setStatus(await pushStatus()); void syncNow(); }} /> : null}
      {status === 'aan' ? (
        <>
          <Button v="green" label="Stuur mij een testmelding" onPress={async () => { setMsg('Even geduld...'); const r = await sendTestReminder(); setMsg(r.message); }} />
          <Button v="outline" label="Meldingen uitzetten" onPress={async () => { await turnPushOff(); setStatus(await pushStatus()); }} />
        </>
      ) : null}
      {msg ? <Txt v="note">{msg}</Txt> : null}
      <Toggle value={feedReminder} onChange={(v) => updateSettings({ feedReminder: v })} label={`Herinnering om ${starterName} te voeden`} note="Op het uur van de volgende voeding." />
    </Card>
  );
}

function ThuisMomenten() {
  const windows = useCrumbly((s) => s.settings.homeWindows);
  const updateSettings = useCrumbly((s) => s.updateSettings);
  const set = (w: HomeWindow[]): void => updateSettings({ homeWindows: w });
  const on = windows.length > 0;
  return (
    <Card>
      <Txt v="folio">Wanneer ben je thuis?</Txt>
      <Txt v="note" style={st.mt}>De planner legt het handwerk (mengen, vouwen, vormen, bakken) op deze momenten. De uren hieronder zijn een voorbeeld: pas ze aan aan je week.</Txt>
      <Toggle
        value={on}
        onChange={(v) => set(v ? [1, 2, 3, 4, 5].flatMap((day) => [{ day, from: '17:30', to: '23:30' }]).concat([0, 6].map((day) => ({ day, from: '07:00', to: '23:30' }))) : [])}
        label="Thuis-momenten gebruiken"
      />
      {on
        ? ORDER.map((day) => {
            const list = windows.map((w, i) => ({ w, i })).filter((x) => x.w.day === day);
            return (
              <View key={day} style={st.day}>
                <Txt v="bold">{dayName(day)}</Txt>
                {list.length === 0 ? <Txt v="note">niet thuis (of niet ingevuld)</Txt> : null}
                {list.map(({ w, i }) => (
                  <Row key={i} style={st.windowRow}>
                    <HhmmStepper value={w.from} onChange={(v) => set(windows.map((x, j) => (j === i ? { ...x, from: v } : x)))} />
                    <Txt v="note">tot</Txt>
                    <HhmmStepper value={w.to} onChange={(v) => set(windows.map((x, j) => (j === i ? { ...x, to: v } : x)))} />
                    <Button small v="ghost" label="weg" onPress={() => set(windows.filter((_, j) => j !== i))} />
                  </Row>
                ))}
                <Button small v="ghost" label="Moment toevoegen" onPress={() => set([...windows, { day, from: '18:00', to: '22:00' }])} style={st.left} />
              </View>
            );
          })
        : null}
    </Card>
  );
}

function Temperatuur() {
  const kitchen = useCrumbly((s) => s.settings.kitchenTempC);
  const doubling = useCrumbly((s) => s.settings.tempDoubling) ?? 2;
  const updateSettings = useCrumbly((s) => s.updateSettings);
  return (
    <Card>
      <Txt v="folio">Rijstijd en temperatuur</Txt>
      <Txt v="note" style={st.mt}>Als een recept zegt bij hoeveel graden het rijst, past Crumbly de rijstijd aan jouw keuken aan. Dat is een grove vuistregel: per 10 graden koeler duurt het ongeveer zoveel keer langer. Pas het getal aan op wat je zelf ziet.</Txt>
      <Gap />
      <Row>
        <Field style={st.flexField} label="Keuken (graden)" value={kitchen === undefined ? '' : String(kitchen)} onChange={(v) => updateSettings({ kitchenTempC: v.trim() === '' ? undefined : Number(v.replace(',', '.')) || undefined })} numeric placeholder="bv. 21" />
        <Field style={st.flexField} label="Keer langer per 10 graden koeler" value={String(doubling).replace('.', ',')} onChange={(v) => { const n = Number(v.replace(',', '.')); if (Number.isFinite(n) && n > 1 && n < 5) updateSettings({ tempDoubling: n }); }} numeric />
      </Row>
    </Card>
  );
}

function BackUp() {
  const replaceAll = useCrumbly((s) => s.replaceAll);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(false);
  return (
    <Card>
      <Txt v="folio">Back-up</Txt>
      <Txt v="note" style={st.mt}>Al je gegevens als een bestand: starter, recepten, bakken en broden.</Txt>
      <Gap />
      {Platform.OS === 'web' ? <Button v="outline" label="Back-up downloaden" onPress={() => downloadBackup()} /> : null}
      <Field label="Back-up terugzetten: plak de inhoud van het bestand" value={text} onChange={(v) => { setText(v); setConfirm(false); setMsg(''); }} multiline />
      {confirm ? (
        <>
          <Txt v="bold" style={st.warn}>Dit vervangt alles op dit toestel. Zeker?</Txt>
          <Row>
            <Button small v="danger" label="Ja, terugzetten" onPress={() => { const d = parseBackup(text); if (d) { replaceAll(d); setMsg('Teruggezet.'); setText(''); } else setMsg('Dit is geen geldige back-up van Crumbly.'); setConfirm(false); }} />
            <Button small v="ghost" label="Nee" onPress={() => setConfirm(false)} />
          </Row>
        </>
      ) : (
        <Button small v="outline" label="Terugzetten" disabled={text.trim().length === 0} onPress={() => (parseBackup(text) ? setConfirm(true) : setMsg('Dit is geen geldige back-up van Crumbly.'))} />
      )}
      {msg ? <Txt v="note">{msg}</Txt> : null}
    </Card>
  );
}

function Uitleg() {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Txt v="folio">Uitleg</Txt>
      <Txt v="note" style={st.mt}>Wat betekenen verdubbeld, 1:5:5, hydratatie, bulk en de bel?</Txt>
      <Gap />
      <Button small v="outline" label={open ? 'Verberg de uitleg' : 'Toon de uitleg'} onPress={() => setOpen(!open)} />
      {open ? GLOSSARY.map((g) => (
        <View key={g.term} style={st.day}>
          <Txt v="bold">{g.term}</Txt>
          <Txt>{g.text}</Txt>
        </View>
      )) : null}
    </Card>
  );
}

export default function Instellingen() {
  const router = useRouter();
  return (
    <Screen folio="Instellingen" title="Instellingen" right={<Button small v="ghost" label="Sluiten" onPress={() => router.back()} />}>
      <Account />
      <Gezin />
      <Koppelen />
      <Meldingen />
      <ThuisMomenten />
      <Temperatuur />
      <Uitleg />
      <BackUp />
      <Txt v="note" style={st.center}>Crumbly 0.1</Txt>
    </Screen>
  );
}

const st = StyleSheet.create({
  mt: { marginTop: space(1) },
  warn: { color: colors.bor, marginVertical: space(1) },
  day: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space(1), marginTop: space(1) },
  windowRow: { flexWrap: 'wrap', marginTop: 4 },
  left: { alignSelf: 'flex-start' },
  center: { textAlign: 'center', marginTop: space(2) },
  flexField: { flex: 1 },
});
