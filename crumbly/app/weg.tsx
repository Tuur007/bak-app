import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { addDays, atTime, fmtDayTime, fmtTime } from '../src/domain/dates';
import { bakesHitByAway, endOf, shiftForReturn, upcomingAway } from '../src/domain/schedule';
import { plannedBakes, useCrumbly } from '../src/store/store';
import { Button, Card, Chip, Gap, Row, Screen, Segmented, Toggle, Txt } from '../src/ui/kit';
import { space } from '../src/ui/theme';
import { DayChips, TimeStepper, useNow } from '../src/ui/widgets';

function LaterThuis() {
  const router = useRouter();
  const now = useNow(60_000);
  const bakes = plannedBakes(useCrumbly((s) => s.bakes));
  const shift = useCrumbly((s) => s.shiftBakeForReturn);
  const [bakeId, setBakeId] = useState<string | undefined>(bakes[0]?.id);
  const [back, setBack] = useState<Date>(() => {
    const d = new Date(Date.now() + 2 * 3600_000);
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return d;
  });
  const bake = bakes.find((b) => b.id === bakeId) ?? bakes[0];
  const preview = useMemo(() => (bake ? shiftForReturn(bake.steps, back) : null), [bake, back]);
  if (!bake) return <Card><Txt>Er is geen bak gepland. Dan hoeft er niets te schuiven.</Txt></Card>;
  const moved = preview ? preview.steps.find((s, i) => s.startAt !== bake.steps[i].startAt) : null;

  return (
    <>
      {bakes.length > 1 ? (
        <Row style={st.wrap}>{bakes.map((b) => <Chip key={b.id} label={b.recipeName} on={b.id === bake.id} onPress={() => setBakeId(b.id)} />)}</Row>
      ) : null}
      <Txt v="label">Ik ben thuis vanaf</Txt>
      <DayChips value={back} onChange={setBack} start={now} days={4} />
      <TimeStepper value={back} onChange={setBack} />
      <Card tone="blush">
        <Txt v="folio">De app stelt voor</Txt>
        {preview && moved ? (
          <Txt style={st.mt}>
            <Txt v="bold">{moved.name} schuift naar {fmtTime(new Date(moved.startAt))}.</Txt> Alle stappen daarna schuiven {preview.deltaMin} minuten mee. Het brood is klaar {fmtDayTime(endOf(preview.steps), now)} in plaats van {fmtDayTime(new Date(bake.endAt), now)}.
          </Txt>
        ) : (
          <Txt style={st.mt}>Er valt geen handwerk voor dat moment. Er hoeft niets te schuiven.</Txt>
        )}
        <Txt v="note" style={st.mt}>Als je later vormt, rijst het deeg langer. Kijk naar het deeg: jij beslist of het klaar is.</Txt>
      </Card>
      <Button label="Pas de planning aan" disabled={!preview} onPress={() => { shift(bake.id, back); router.back(); }} />
    </>
  );
}

function MeerdereDagen() {
  const router = useRouter();
  const now = useNow(60_000);
  const starter = useCrumbly((s) => s.starter);
  const bakes = useCrumbly((s) => s.bakes);
  const away = useCrumbly((s) => s.away);
  const addAway = useCrumbly((s) => s.addAway);
  const deleteAway = useCrumbly((s) => s.deleteAway);
  const cancelBake = useCrumbly((s) => s.cancelBake);
  const [from, setFrom] = useState<Date>(() => atTime(addDays(new Date(), 1), '08:00'));
  const [to, setTo] = useState<Date>(() => atTime(addDays(new Date(), 4), '18:00'));
  const [fridge, setFridge] = useState(true);
  const [mute, setMute] = useState(true);
  const [cancelHit, setCancelHit] = useState(true);
  const name = starter?.name ?? 'je starter';
  const valid = to.getTime() > from.getTime();
  const draft = { id: 'x', from: from.toISOString(), to: to.toISOString(), starterInFridge: fridge, muteFeedReminders: mute, updatedAt: '' };
  const hit = valid ? bakesHitByAway(bakes, draft) : [];
  const list = upcomingAway(away, now);

  return (
    <>
      <Txt v="label">Weg vanaf</Txt>
      <DayChips value={from} onChange={setFrom} start={now} days={30} />
      <TimeStepper value={from} onChange={setFrom} step={30} />
      <Txt v="label">Terug op</Txt>
      <DayChips value={to} onChange={setTo} start={now} days={45} />
      <TimeStepper value={to} onChange={setTo} step={30} />
      {!valid ? <Txt v="bold">De terugkeer ligt voor het vertrek.</Txt> : null}

      <Card>
        <Toggle value={fridge} onChange={setFridge} label={`${name} naar de koelkast`} note={`Voed ${name} een paar uur voor je vertrekt (bijvoorbeeld 1:5:5 of meer meel), laat hem wat rijzen en zet hem dan in de koelkast. Volgens bakkersblogs houdt hij het zo 2 tot 3 weken.`} />
        <Toggle value={mute} onChange={setMute} label="Geen voedingsmeldingen" note="Zolang je weg bent." />
        {hit.length > 0 ? (
          <Toggle value={cancelHit} onChange={setCancelHit} label={`${hit.length} geplande ${hit.length === 1 ? 'bak' : 'bakken'} annuleren`} note={hit.map((b) => `${b.recipeName}, klaar ${fmtDayTime(new Date(b.endAt), now)}`).join('; ')} />
        ) : null}
      </Card>
      <Card tone="blush">
        <Txt v="folio">Als je terug bent</Txt>
        <Txt style={st.mt}>Voed {name} de ochtend dat je thuiskomt. Heeft hij een duwtje nodig, voed hem dan 's avonds nog eens. Staat er vocht bovenop, giet het weg of roer het erdoor. Bak pas als hij weer vlot verdubbelt.</Txt>
        <Txt v="note" style={st.mt}>Tips uit bakkersblogs en een forum, geen vaste regel.</Txt>
      </Card>
      <Button
        label="Bewaar"
        disabled={!valid}
        onPress={() => {
          addAway({ from: from.toISOString(), to: to.toISOString(), starterInFridge: fridge, muteFeedReminders: mute });
          if (cancelHit) hit.forEach((b) => cancelBake(b.id));
          router.back();
        }}
      />
      {list.length > 0 ? (
        <>
          <Gap />
          <Txt v="folio">Gepland weg</Txt>
          {list.map((a) => (
            <Card key={a.id}>
              <Txt v="bold">{fmtDayTime(new Date(a.from), now)} tot {fmtDayTime(new Date(a.to), now)}</Txt>
              <Txt v="note">{a.starterInFridge ? `${name} in de koelkast` : `${name} blijft staan`}{a.muteFeedReminders ? ', geen voedingsmeldingen' : ''}</Txt>
              <Button small v="ghost" label="Verwijderen" onPress={() => deleteAway(a.id)} />
            </Card>
          ))}
        </>
      ) : null}
    </>
  );
}

export default function Weg() {
  const router = useRouter();
  const [mode, setMode] = useState<'uren' | 'dagen'>('uren');
  return (
    <Screen folio="Ik ben weg" title="Even niet thuis" sub="De planning past zich aan." right={<Button small v="ghost" label="Sluiten" onPress={() => router.back()} />}>
      <Segmented options={[{ value: 'uren', label: 'Later thuis' }, { value: 'dagen', label: 'Meerdere dagen' }]} value={mode} onChange={setMode} />
      {mode === 'uren' ? <LaterThuis /> : <MeerdereDagen />}
      <View style={st.bottom} />
    </Screen>
  );
}

const st = StyleSheet.create({
  wrap: { flexWrap: 'wrap', gap: 0 },
  mt: { marginTop: space(1) },
  bottom: { height: space(2) },
});
