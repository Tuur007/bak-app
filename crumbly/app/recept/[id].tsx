import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { batardProcess } from '../../src/domain/defaults';
import { fmtDuration } from '../../src/domain/dates';
import { newId } from '../../src/domain/ids';
import { computeRatios, factorForDoughWeight, formatPct, roundGrams } from '../../src/domain/ratios';
import { totalMinutes } from '../../src/domain/schedule';
import type { ProcessStep, Recipe } from '../../src/domain/types';
import { useCrumbly } from '../../src/store/store';
import { Button, Card, Chip, Field, Gap, num, Row, Screen, str, Txt } from '../../src/ui/kit';
import { colors, fonts, space } from '../../src/ui/theme';
import { Bell } from '../../src/ui/widgets';

function blank(): Recipe {
  return {
    id: newId(), name: '', source: '', flours: [{ id: newId(), name: 'Bloem', grams: 500 }], waterG: 350, starterG: 100,
    starterHydration: 100, saltG: 10, process: batardProcess(), updatedAt: new Date().toISOString(),
  };
}

function StepEditor({ step, onChange, onMove, onDelete }: { step: ProcessStep; onChange: (p: Partial<ProcessStep>) => void; onMove: (d: -1 | 1) => void; onDelete: () => void }) {
  return (
    <View style={s.step}>
      <Row>
        <Field style={s.flex} label="Stap" value={step.name} onChange={(v) => onChange({ name: v })} />
        <Bell on={step.alarm} onPress={() => onChange({ alarm: !step.alarm })} />
      </Row>
      <Row style={s.wrap}>
        <Chip label="Gevoelig voor temperatuur" on={!!step.tempSensitive} onPress={() => onChange({ tempSensitive: !step.tempSensitive })} />
      </Row>
      <Row style={s.wrap}>
        <Chip label="Handwerk" on={step.kind === 'hand'} onPress={() => onChange({ kind: 'hand', workMinutes: step.workMinutes ?? 5 })} />
        <Chip label="Wachten" on={step.kind === 'wacht'} onPress={() => onChange({ kind: 'wacht', alarm: false })} />
      </Row>
      <Row>
        <Field style={s.flex} label="Tot volgende stap (min)" value={str(step.minutes)} onChange={(v) => onChange({ minutes: Math.max(0, Math.round(num(v))) })} numeric />
        {step.kind === 'hand' ? <Field style={s.flex} label="Handwerk (min)" value={str(step.workMinutes ?? 5)} onChange={(v) => onChange({ workMinutes: Math.max(0, Math.round(num(v))) })} numeric /> : <View style={s.flex} />}
      </Row>
      <Row style={s.wrap}>
        <Button small v="outline" label="Omhoog" onPress={() => onMove(-1)} />
        <Button small v="outline" label="Omlaag" onPress={() => onMove(1)} />
        <Button small v="ghost" label="Verwijderen" onPress={onDelete} />
      </Row>
    </View>
  );
}

export default function ReceptBewerken() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const existing = useCrumbly((s) => s.recipes.find((r) => r.id === id));
  const saveRecipe = useCrumbly((s) => s.saveRecipe);
  const deleteRecipe = useCrumbly((s) => s.deleteRecipe);
  const [r, setR] = useState<Recipe>(() => (existing ? JSON.parse(JSON.stringify(existing)) as Recipe : blank()));
  const [target, setTarget] = useState('');
  const [showSteps, setShowSteps] = useState(false);

  const flourG = r.flours.reduce((a, f) => a + (f.grams || 0), 0);
  const q = useMemo(() => computeRatios({ flourG, waterG: r.waterG, starterG: r.starterG, starterHydration: r.starterHydration, saltG: r.saltG }), [flourG, r]);
  const patch = (p: Partial<Recipe>): void => setR((x) => ({ ...x, ...p }));
  const patchStep = (i: number, p: Partial<ProcessStep>): void => setR((x) => ({ ...x, process: x.process.map((s2, j) => (j === i ? { ...s2, ...p } : s2)) }));
  const moveStep = (i: number, d: -1 | 1): void =>
    setR((x) => {
      const j = i + d;
      if (j < 0 || j >= x.process.length) return x;
      const p = [...x.process];
      [p[i], p[j]] = [p[j], p[i]];
      return { ...x, process: p };
    });

  const scale = (): void => {
    const k = factorForDoughWeight({ flourG, waterG: r.waterG, starterG: r.starterG, starterHydration: r.starterHydration, saltG: r.saltG }, num(target));
    setR((x) => ({
      ...x,
      flours: x.flours.map((f) => ({ ...f, grams: roundGrams(f.grams * k) })),
      waterG: roundGrams(x.waterG * k), starterG: roundGrams(x.starterG * k), saltG: roundGrams(x.saltG * k),
    }));
    setTarget('');
  };

  const save = (thenPlan: boolean): void => {
    saveRecipe({ ...r, name: r.name.trim() || 'Naamloos recept' });
    if (thenPlan) router.replace(`/plan?recept=${r.id}`);
    else router.back();
  };

  return (
    <Screen folio={existing ? 'Recept' : 'Nieuw recept'} title={r.name || 'Recept'} right={<Button small v="ghost" label="Sluiten" onPress={() => router.back()} />}>
      {existing?.isExample ? (
        <Card tone="blush"><Txt>Dit is een voorbeeld. Vul je eigen recept in (bijvoorbeeld uit Kometen Brood) en bewaar.</Txt></Card>
      ) : null}
      <Field label="Naam" value={r.name} onChange={(v) => patch({ name: v })} placeholder="bv. Klassieke bâtard" />
      <Field label="Bron" value={r.source ?? ''} onChange={(v) => patch({ source: v })} placeholder="bv. Kometen Brood, blz. 42" />

      <Card>
        <Txt v="folio">Ingrediënten</Txt>
        <Gap />
        {r.flours.map((f, i) => (
          <Row key={f.id}>
            <Field style={s.flex2} label={i === 0 ? 'Meelsoort' : ' '} value={f.name} onChange={(v) => patch({ flours: r.flours.map((x) => (x.id === f.id ? { ...x, name: v } : x)) })} />
            <Field style={s.flex} label={i === 0 ? 'Gram' : ' '} value={str(f.grams)} onChange={(v) => patch({ flours: r.flours.map((x) => (x.id === f.id ? { ...x, grams: num(v) } : x)) })} numeric />
            {r.flours.length > 1 ? <Pressable onPress={() => patch({ flours: r.flours.filter((x) => x.id !== f.id) })} style={s.x} accessibilityLabel="meelsoort weghalen"><Txt v="bold">x</Txt></Pressable> : null}
          </Row>
        ))}
        <Button small v="ghost" label="Meelsoort toevoegen" onPress={() => patch({ flours: [...r.flours, { id: newId(), name: '', grams: 0 }] })} />
        <Row>
          <Field style={s.flex} label="Water (g)" value={str(r.waterG)} onChange={(v) => patch({ waterG: num(v) })} numeric />
          <Field style={s.flex} label="Zout (g)" value={str(r.saltG)} onChange={(v) => patch({ saltG: num(v) })} numeric />
        </Row>
        <Row>
          <Field style={s.flex} label="Starter (g)" value={str(r.starterG)} onChange={(v) => patch({ starterG: num(v) })} numeric />
          <Field style={s.flex} label="Starter hydratatie (%)" value={str(r.starterHydration)} onChange={(v) => patch({ starterHydration: num(v) })} numeric />
        </Row>
        <View style={s.res}>
          <View style={s.resBox}><Txt style={s.resNum}>{formatPct(q.hydration)}</Txt><Txt v="label">Hydratatie</Txt></View>
          <View style={s.resBox}><Txt style={s.resNum}>{formatPct(q.starterPct)}</Txt><Txt v="label">Starter</Txt></View>
          <View style={s.resBox}><Txt style={s.resNum}>{formatPct(q.saltPct)}</Txt><Txt v="label">Zout</Txt></View>
        </View>
        <Txt v="note">Totaal {Math.round(q.doughWeight)} g deeg, {Math.round(q.totalFlour)} g meel. Alles op het totale meel, het meel en water uit de starter tellen mee.</Txt>
        <Gap />
        <Row>
          <Field style={s.flex} label="Schalen naar deeggewicht (g)" value={target} onChange={setTarget} numeric placeholder={String(Math.round(q.doughWeight * 2))} />
          <Button small v="outline" label="Schaal" onPress={scale} disabled={!(num(target) > 0)} style={s.scaleBtn} />
        </Row>
      </Card>

      <Card>
        <Field label="Tijden gelden bij (graden in de keuken)" value={r.refTempC === undefined ? '' : str(r.refTempC)} onChange={(v) => patch({ refTempC: v.trim() === '' ? undefined : num(v) })} numeric placeholder="leeg = niet aanpassen aan de temperatuur" />
        <Txt v="note" style={s.mbNote}>Vul dit in als je recept zegt bij hoeveel graden het rijst. Dan past Crumbly de rijstijd aan als je keuken warmer of koeler is. Duid bij de stappen aan welke gevoelig zijn (bv. de bulk). Het is een grove schatting: bij 10 graden koeler duurt het ongeveer dubbel zo lang.</Txt>
        <Pressable onPress={() => setShowSteps(!showSteps)} style={s.stepsHead} accessibilityRole="button">
          <View style={s.flex}>
            <Txt v="folio">Werkwijze en tijden</Txt>
            <Txt v="note">{r.process.length} stappen, samen {fmtDuration(totalMinutes(r.process))}</Txt>
          </View>
          <Txt v="bold" style={s.link}>{showSteps ? 'Sluiten' : 'Aanpassen'}</Txt>
        </Pressable>
        {showSteps ? (
          <>
            <Txt v="note">De tijden zijn een vertrekpunt; pas ze aan aan je recept en je keuken. De bel zet standaard een wekker bij die stap.</Txt>
            {r.process.map((st, i) => (
              <StepEditor key={st.id} step={st} onChange={(p) => patchStep(i, p)} onMove={(d) => moveStep(i, d)} onDelete={() => setR((x) => ({ ...x, process: x.process.filter((_, j) => j !== i) }))} />
            ))}
            <Button small v="ghost" label="Stap toevoegen" onPress={() => setR((x) => ({ ...x, process: [...x.process, { id: newId(), name: 'Nieuwe stap', minutes: 30, kind: 'hand', workMinutes: 5, alarm: true }] }))} />
          </>
        ) : null}
      </Card>

      <Field label="Notities" value={r.notes ?? ''} onChange={(v) => patch({ notes: v })} multiline placeholder="Wat je wil onthouden bij dit recept" />
      <Gap />
      <Button label="Bewaar en plan deze bak" onPress={() => save(true)} />
      <Button v="outline" label="Bewaar" onPress={() => save(false)} />
      {existing ? <Button v="danger" label="Recept verwijderen" onPress={() => { deleteRecipe(r.id); router.back(); }} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  flex2: { flex: 2 },
  wrap: { flexWrap: 'wrap', marginBottom: 4 },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  res: { flexDirection: 'row', gap: space(1), marginVertical: space(1) },
  resBox: { flex: 1, backgroundColor: colors.blush, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  resNum: { fontFamily: fonts.title, fontSize: 24, lineHeight: 30, color: colors.grn },
  scaleBtn: { marginTop: 18 },
  stepsHead: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  link: { color: colors.ter },
  mbNote: { marginBottom: space(1) },
  step: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space(1), marginTop: space(1) },
});
