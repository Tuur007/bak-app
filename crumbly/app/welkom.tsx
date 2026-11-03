import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { addDays, fmtLongDate, toDayString } from '../src/domain/dates';
import { GLOSSARY } from '../src/domain/glossary';
import { parseDay } from '../src/domain/starter';
import type { HomeWindow } from '../src/domain/types';
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
  if (!starter) return <Screen title="Even geduld"><Txt>...</Txt></Screen>;
  const started = parseDay(starter.startedOn);

  const done = (target: '/recepten' | '/'): void => {
    updateStarter({ name: name.trim() || starter.name });
    const w = windowsFor(pattern);
    updateSettings({ onboarded: true, ...(w ? { homeWindows: w } : {}) });
    router.replace(target);
  };

  return (
    <Screen folio="Welkom" title="Welkom bij Crumbly" sub="Drie korte vragen, dan kan je beginnen. Alles kan je later aanpassen.">
      <Card>
        <Txt v="folio">1. Je starter</Txt>
        <Field label="Hoe heet hij?" value={name} onChange={setName} />
        <Txt v="label">Wanneer ben je gestart?</Txt>
        <Row style={st.row}>
          <Button small v="outline" label="-1 dag" onPress={() => updateStarter({ startedOn: toDayString(addDays(started, -1)) })} />
          <Txt v="bold" style={st.mid}>{fmtLongDate(started)}</Txt>
          <Button small v="outline" label="+1 dag" onPress={() => updateStarter({ startedOn: toDayString(addDays(started, 1)) })} />
        </Row>
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
        <Txt style={st.mt}>Crumbly bevat een voorbeeld, maar de tijden daarin zijn een vertrekpunt. Vul je eigen recept in, op de gram.</Txt>
        <Gap />
        <Button label="Recept invullen" onPress={() => done('/recepten')} />
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
