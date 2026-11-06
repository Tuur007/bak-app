import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { addDays, fmtLongDate, toDayString } from '../src/domain/dates';
import { GLOSSARY } from '../src/domain/glossary';
import { parseDay } from '../src/domain/starter';
import type { HomeWindow } from '../src/domain/types';
import { HhmmStepper } from '../src/ui/widgets';
import { useCrumbly } from '../src/store/store';
import { Button, Card, Chip, Field, Gap, Row, Screen, Txt } from '../src/ui/kit';
import { space } from '../src/ui/theme';

type Pattern = 'week-avond' | 'altijd' | 'later';

function windowsFor(p: Pattern): HomeWindow[] | null {
  if (p === 'later') return null;
  const days = [0, 1, 2, 3, 4, 5, 6];
  if (p === 'altijd') return days.map((day) => ({ day, from: '07:00', to: '23:00' }));
  return days.map((day) => ({ day, from: day === 0 || day === 6 ? '07:00' : '17:30', to: '23:30' }));
}

/** Eerste keer: drie vragen en uitleg. Alles kan later in de app nog aangepast worden. */
export default function Welkom() {
  const router = useRouter();
  const starter = useCrumbly((s) => s.starter);
  const updateStarter = useCrumbly((s) => s.updateStarter);
  const updateSettings = useCrumbly((s) => s.updateSettings);
  const [name, setName] = useState(starter?.name ?? '');
  const [pattern, setPattern] = useState<Pattern>('week-avond');
  const [feedAt, setFeedAt] = useState<string | null>(null);
  if (!starter) return <Screen title="Even geduld"><Txt>...</Txt></Screen>;
  const started = parseDay(starter.startedOn);

  const done = (target: '/recept/plakken' | '/recepten' | '/'): void => {
    updateStarter({ name: name.trim() || starter.name, ...(feedAt ? { autoFeedAt: feedAt, autoFeedSince: toDayString(new Date()) } : {}) });
    const w = windowsFor(pattern);
    updateSettings({ onboarded: true, ...(w ? { homeWindows: w } : {}) });
    router.replace(target);
  };

  return (
    <Screen folio="Welkom" title="Welkom bij Crumbly" sub="Drie korte vragen, dan kan je beginnen. Alles kan je later aanpassen.">
      <Card>
        <Txt v="folio">1. Je starter</Txt>
        <Field label="Hoe heet hij?" value={name} onChange={setName} placeholder="bv. Jean Tuur" />
        <Txt v="note">Deel je een starter met iemand, geef hem dan een eigen naam (bv. Jean Tuur en Jean Flore). Je kan hem later nog hernoemen.</Txt>
        <Txt v="label">Wanneer ben je gestart?</Txt>
        <Row style={st.row}>
          <Button small v="outline" label="-1 dag" onPress={() => updateStarter({ startedOn: toDayString(addDays(started, -1)) })} />
          <Txt v="bold" style={st.mid}>{fmtLongDate(started)}</Txt>
          <Button small v="outline" label="+1 dag" onPress={() => updateStarter({ startedOn: toDayString(addDays(started, 1)) })} />
        </Row>
      </Card>

      <Card>
        <Txt v="folio">Hoe laat voed je {name.trim() || starter.name}?</Txt>
        <Txt v="note" style={st.mt}>Voed je elke dag rond hetzelfde uur, dan noteert Crumbly de voedingen zelf. Dan hoef je niets te tikken, enkel af en toe één vraag: hoe snel verdubbelde hij?</Txt>
        <Gap />
        <View style={st.chips}>
          <Chip label="Elke dag rond hetzelfde uur" on={feedAt !== null} onPress={() => setFeedAt(feedAt ?? '18:00')} />
          <Chip label="Wisselend, ik tik zelf" on={feedAt === null} onPress={() => setFeedAt(null)} />
        </View>
        {feedAt !== null ? <Row style={st.row}><Txt v="label">Om</Txt><HhmmStepper value={feedAt} onChange={setFeedAt} /></Row> : null}
      </Card>

      <Card>
        <Txt v="folio">2. Wanneer ben je thuis?</Txt>
        <Txt v="note" style={st.mt}>Crumbly legt het handwerk (mengen, vouwen, vormen, bakken) op momenten dat je er bent.</Txt>
        <Gap />
        <View style={st.chips}>
          <Chip label="Weekdagen na 17:30, weekend de hele dag" on={pattern === 'week-avond'} onPress={() => setPattern('week-avond')} />
          <Chip label="Bijna altijd" on={pattern === 'altijd'} onPress={() => setPattern('altijd')} />
          <Chip label="Dat vul ik later in" on={pattern === 'later'} onPress={() => setPattern('later')} />
        </View>
      </Card>

      <Card>
        <Txt v="folio">3. Je eigen recept</Txt>
        <Txt style={st.mt}>Crumbly bevat een voorbeeld, maar de tijden daarin zijn een vertrekpunt. Zet het recept uit je boek om: plak de tekst of scan de bladzijde, en Crumbly maakt er een bakschema van.</Txt>
        <Gap />
        <Button label="Recept uit mijn boek omzetten" onPress={() => done('/recept/plakken')} />
        <Button v="outline" label="Zelf invullen" onPress={() => done('/recepten')} />
        <Button v="outline" label="Eerst rondkijken" onPress={() => done('/')} />
      </Card>

      <Card tone="blush">
        <Txt v="folio">Wat betekenen die woorden?</Txt>
        {GLOSSARY.map((g) => (
          <View key={g.term} style={st.term}>
            <Txt v="bold">{g.term}</Txt>
            <Txt>{g.text}</Txt>
          </View>
        ))}
        <Txt v="note" style={st.mt}>Deze uitleg staat ook in de instellingen.</Txt>
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  row: { marginTop: 4 },
  mid: { flex: 1, textAlign: 'center' },
  mt: { marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  term: { marginTop: space(1) },
});
