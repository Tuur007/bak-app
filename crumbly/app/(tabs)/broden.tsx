import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { fmtDay, fmtLongDate } from '../../src/domain/dates';
import { formatPct } from '../../src/domain/ratios';
import type { Bake, CrumbKind } from '../../src/domain/types';
import { useCrumbly } from '../../src/store/store';
import { Button, Card, Chip, Field, Row, Screen, Txt } from '../../src/ui/kit';
import { colors, space } from '../../src/ui/theme';
import { useNow } from '../../src/ui/widgets';

const CRUMBS: { v: CrumbKind; label: string }[] = [
  { v: 'dicht', label: 'Dicht' },
  { v: 'gelijkmatig', label: 'Gelijkmatig' },
  { v: 'open', label: 'Open' },
];
const CRUST = ['bleek', 'goudbruin', 'bruin', 'donker'];

function ResultForm({ bake }: { bake: Bake }) {
  const finishBake = useCrumbly((s) => s.finishBake);
  const [crust, setCrust] = useState(2);
  const [crumb, setCrumb] = useState<CrumbKind>('gelijkmatig');
  const [next, setNext] = useState('');
  return (
    <Card>
      <Txt v="folio">Hoe is hij geworden?</Txt>
      <Txt v="h2">{bake.recipeName}</Txt>
      <Txt v="note">{fmtLongDate(new Date(bake.endAt))}</Txt>
      <Txt v="label" style={b.mt}>Korstkleur</Txt>
      <View style={b.crust}>
        {colors.crust.map((c, i) => (
          <Pressable key={c} onPress={() => setCrust(i)} style={[b.swatch, { backgroundColor: c }, crust === i && b.swatchOn]} accessibilityRole="radio" accessibilityState={{ selected: crust === i }} accessibilityLabel={CRUST[i]} />
        ))}
      </View>
      <Txt v="label">Kruim</Txt>
      <Row style={b.wrap}>
        {CRUMBS.map((c) => <Chip key={c.v} label={c.label} on={crumb === c.v} onPress={() => setCrumb(c.v)} />)}
      </Row>
      <Field label="Volgende keer" value={next} onChange={setNext} placeholder="bv. bulk 30 min langer" />
      <Button label="Bewaar" onPress={() => finishBake(bake.id, { crust, crumb, nextTime: next.trim() })} />
    </Card>
  );
}

export default function Broden() {
  const now = useNow(60_000);
  const bakes = useCrumbly((s) => s.bakes);
  const live = bakes.filter((x) => !x.deletedAt);
  const open = live.filter((x) => x.status === 'gepland' && (new Date(x.endAt).getTime() <= now.getTime() || x.steps.every((s) => s.doneAt)));
  const done = live.filter((x) => x.status === 'klaar').sort((a, c) => c.endAt.localeCompare(a.endAt));

  return (
    <Screen folio="Mijn broden" title="Broden" sub="Na het snijden: korstkleur, kruim en een zin voor de volgende keer.">
      {open.map((x) => <ResultForm key={x.id} bake={x} />)}
      {done.length === 0 && open.length === 0 ? (
        <Card tone="blush">
          <Txt v="h2">Nog geen broden</Txt>
          <Txt style={b.mt}>Na je eerste bak hou je hier in drie tikken bij hoe hij werd. Wat je bij "volgende keer" schrijft, zie je terug op het startscherm.</Txt>
        </Card>
      ) : null}
      {done.map((x) => (
        <Card key={x.id}>
          <Row>
            <View style={[b.dot, { backgroundColor: colors.crust[x.result?.crust ?? 2] }]} />
            <View style={b.flex}>
              <Txt v="h2">{x.recipeName}</Txt>
              <Txt v="note">{fmtDay(new Date(x.endAt), now)} · hydratatie {formatPct(x.hydration)}{x.result ? ` · ${x.result.crumb} kruim` : ''}</Txt>
            </View>
          </Row>
          {x.result?.nextTime ? <Txt style={b.mt}>Volgende keer: {x.result.nextTime}</Txt> : null}
        </Card>
      ))}
      {done.length > 0 && done.length < 5 ? <Txt v="note">Vergelijkingen tussen broden verschijnen pas na 5 broden, als ze iets vertellen.</Txt> : null}
    </Screen>
  );
}

const b = StyleSheet.create({
  flex: { flex: 1 },
  mt: { marginTop: space(1) },
  wrap: { flexWrap: 'wrap', gap: 0 },
  crust: { flexDirection: 'row', gap: space(1), marginVertical: space(1) },
  swatch: { flex: 1, height: 44, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.ink },
  dot: { width: 28, height: 28, borderRadius: 14 },
});
