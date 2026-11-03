import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { fmtCountdown, fmtDay, fmtDayTime, fmtDuration, fmtTime, sameDay } from '../../src/domain/dates';
import { formatPct, recipeRatios } from '../../src/domain/ratios';
import { endOf, findFittingEnd, homeConflicts, planBackward, stepState, totalMinutes, workMinutes } from '../../src/domain/schedule';
import { adjustForTemperature } from '../../src/domain/temperature';
import type { Bake, HomeWindow, PlannedStep, ProcessStep } from '../../src/domain/types';
import { liveRecipes, plannedBakes, useCrumbly } from '../../src/store/store';
import { Button, Card, Chip, Gap, Row, Screen, Txt } from '../../src/ui/kit';
import { colors, space } from '../../src/ui/theme';
import { useAlarmState } from '../../src/services/alarmState';
import { StepCard } from '../../src/ui/StepCard';
import { Bell, DayChips, TimeStepper, useNow, useWakeLock } from '../../src/ui/widgets';

function StepRow({ bake, step, now, current }: { bake: Bake; step: PlannedStep; now: Date; current: boolean }) {
  const setStepDone = useCrumbly((s) => s.setStepDone);
  const setStepAlarm = useCrumbly((s) => s.setStepAlarm);
  const at = new Date(step.startAt);
  const done = !!step.doneAt;
  return (
    <View style={[p.step, current && p.stepNow]}>
      <Pressable style={p.stepMain} onPress={() => setStepDone(bake.id, step.id, !done)} accessibilityRole="checkbox" accessibilityState={{ checked: done }}>
        <View style={[p.check, done && p.checkOn]} />
        <View style={p.time}>
          <Txt v="bold" style={p.timeText}>{fmtTime(at)}</Txt>
          {!sameDay(at, now) ? <Txt v="note">{fmtDay(at, now)}</Txt> : null}
        </View>
        <View style={p.flex}>
          <Txt v={step.kind === 'hand' ? 'bold' : 'body'} style={done ? p.doneText : step.kind === 'wacht' ? p.waitText : undefined}>{step.name}</Txt>
          <Txt v="note">{step.kind === 'hand' ? `${fmtDuration(workMinutes(step))} handwerk` : `wachten, ${fmtDuration(step.minutes)}`}</Txt>
        </View>
      </Pressable>
      {step.kind === 'hand' && !done ? <Bell on={step.alarm} onPress={() => setStepAlarm(bake.id, step.id, !step.alarm)} /> : null}
    </View>
  );
}

function AlarmBanner() {
  const router = useRouter();
  const alarm = useAlarmState();
  if (alarm === 'laden') return null;
  if (alarm.ok) return <Txt v="note" style={p.mb}>Wekkers staan aan op dit toestel. Een melding kan een paar minuten later komen.</Txt>;
  return (
    <Card tone="blush">
      <Txt v="folio">Let op</Txt>
      <Txt style={p.mt}>{alarm.text}</Txt>
      {alarm.action ? (
        <>
          <Gap />
          <Row><Button small v="green" label="Naar de instellingen" onPress={() => router.push('/instellingen')} /></Row>
        </>
      ) : null}
    </Card>
  );
}

function ActiveBake({ bake, now }: { bake: Bake; now: Date }) {
  const router = useRouter();
  const windows = useCrumbly((s) => s.settings.homeWindows);
  const cancelBake = useCrumbly((s) => s.cancelBake);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const st = stepState(bake.steps, now);
  const conflicts = homeConflicts(bake.steps, windows);
  // Scherm aan als er binnen het halfuur iets te doen is.
  useWakeLock(!!st.step && st.msUntil < 30 * 60_000);

  return (
    <>
      <Txt v="note" style={p.mb}>Klaar: {fmtDayTime(new Date(bake.endAt), now)} · hydratatie {formatPct(bake.hydration)}</Txt>
      {st.step ? (
        <StepCard bake={bake} now={now} />
      ) : (
        <Card tone="blush">
          <Txt v="h2">Klaar!</Txt>
          <Txt style={p.mt}>Hoe is hij geworden? Drie tikken en je weet het de volgende keer.</Txt>
          <Gap />
          <Button label="Brood bijhouden" onPress={() => router.push('/broden')} />
        </Card>
      )}

      {windows.length > 0 ? (
        <Txt v="note" style={p.mb}>
          {conflicts.length === 0
            ? 'Al het handwerk valt op een moment dat je thuis bent.'
            : `Let op: ${conflicts.length} ${conflicts.length === 1 ? 'stap valt' : 'stappen vallen'} buiten je thuis-momenten (${conflicts.map((c) => fmtTime(new Date(c.startAt))).join(', ')}).`}
        </Txt>
      ) : null}

      <AlarmBanner />

      <Card style={p.list}>
        {bake.steps.map((s, i) => (
          <StepRow key={s.id} bake={bake} step={s} now={now} current={i === st.index} />
        ))}
        <View style={p.endRow}>
          <Txt v="bold">{fmtTime(endOf(bake.steps))}</Txt>
          <Txt v="note">  brood klaar, {fmtDay(endOf(bake.steps), now)}</Txt>
        </View>
      </Card>
      <Txt v="note" style={p.mb}>Tik op een stap om hem af te vinken. De bel zet een wekker (melding) voor die stap.</Txt>
      <Button v="outline" label="Ik ben weg of later thuis" onPress={() => router.push('/weg')} />
      {confirmCancel ? (
        <Row>
          <Button small v="danger" label="Ja, annuleer deze bak" onPress={() => cancelBake(bake.id)} />
          <Button small v="ghost" label="Nee" onPress={() => setConfirmCancel(false)} />
        </Row>
      ) : (
        <Button v="ghost" label="Bak annuleren" onPress={() => setConfirmCancel(true)} />
      )}
    </>
  );
}

/** Eerste middag (12:00) waarop het brood klaar kan zijn; met thuis-momenten het eerste dat past. */
function defaultEnd(process: ProcessStep[], windows: HomeWindow[], now: Date): Date {
  const earliest = new Date(now.getTime() + (totalMinutes(process) + 30) * 60_000);
  const noon = new Date(earliest);
  noon.setHours(12, 0, 0, 0);
  if (noon.getTime() < earliest.getTime()) noon.setDate(noon.getDate() + 1);
  if (windows.length === 0) return noon;
  return findFittingEnd(process, noon, windows, now) ?? noon;
}

function Planner({ initialRecipe, onDone }: { initialRecipe?: string; onDone: () => void }) {
  const router = useRouter();
  const now = useNow(60_000);
  const recipes = liveRecipes(useCrumbly((s) => s.recipes));
  const windows = useCrumbly((s) => s.settings.homeWindows);
  const planBake = useCrumbly((s) => s.planBake);
  const settings = useCrumbly((s) => s.settings);
  const updateSettings = useCrumbly((s) => s.updateSettings);
  const [recipeId, setRecipeId] = useState<string | undefined>(initialRecipe ?? recipes[0]?.id);
  const recipe = recipes.find((r) => r.id === recipeId) ?? recipes[0];
  const [end, setEnd] = useState<Date>(() => defaultEnd(recipe?.process ?? [], windows, new Date()));
  const [msg, setMsg] = useState('');
  const [tempC, setTempC] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (initialRecipe) setRecipeId(initialRecipe);
  }, [initialRecipe]);

  // Keukentemperatuur: enkel als het recept zegt bij hoeveel graden zijn tijden gelden.
  const refTemp = recipe?.refTempC;
  const kitchen = refTemp === undefined ? undefined : tempC ?? settings.kitchenTempC ?? refTemp;
  const adjusted = useMemo(
    () => (recipe ? adjustForTemperature(recipe.process, recipe.refTempC, kitchen, settings.tempDoubling) : null),
    [recipe, kitchen, settings.tempDoubling],
  );
  const steps = useMemo(() => (recipe && adjusted ? planBackward(adjusted.process, end) : []), [recipe, adjusted, end]);
  if (!recipe) {
    return (
      <Card>
        <Txt>Voeg eerst een recept toe.</Txt>
        <Gap />
        <Button label="Recept toevoegen" onPress={() => router.push('/recept/nieuw')} />
      </Card>
    );
  }
  const start = steps[0] ? new Date(steps[0].startAt) : end;
  const tooEarly = start.getTime() < now.getTime() - 5 * 60_000;
  const conflicts = homeConflicts(steps, windows);
  const q = recipeRatios(recipe);

  return (
    <>
      <Txt v="label">Recept</Txt>
      <Row style={p.wrap}>
        {recipes.map((r) => (
          <Chip key={r.id} label={r.name || 'Naamloos'} on={r.id === recipe.id} onPress={() => setRecipeId(r.id)} />
        ))}
      </Row>
      <Txt v="note" style={p.mb}>Hydratatie {formatPct(q.hydration)} · duurt {fmtDuration(totalMinutes(adjusted?.process ?? recipe.process))}</Txt>
      {refTemp !== undefined && kitchen !== undefined ? (
        <>
          <Txt v="label">Temperatuur in je keuken</Txt>
          <Row style={p.wrap}>
            <Button small v="outline" label="-1" onPress={() => setTempC(kitchen - 1)} />
            <Txt v="title" style={p.tempNum}>{kitchen} graden</Txt>
            <Button small v="outline" label="+1" onPress={() => setTempC(kitchen + 1)} />
          </Row>
          <Txt v="note" style={p.mb}>
            {adjusted && adjusted.changes.length > 0
              ? `Je recept rekent met ${refTemp} graden. Bij ${kitchen} graden duurt ${adjusted.changes.map((c) => `"${c.name.toLowerCase()}" ${fmtDuration(c.to)} in plaats van ${fmtDuration(c.from)}`).join(' en ')}. Grove schatting: kijk naar het deeg.`
              : `Je recept rekent met ${refTemp} graden. Bij ${kitchen} graden verandert er niets.`}
          </Txt>
        </>
      ) : (
        <Txt v="note" style={p.mb}>Wil je dat de rijstijd meegaat met de temperatuur in je keuken? Vul bij het recept in bij hoeveel graden de tijden gelden.</Txt>
      )}
      <Txt v="label">Brood klaar op</Txt>
      <DayChips value={end} onChange={(d) => { setEnd(d); setMsg(''); }} start={now} days={14} />
      <TimeStepper value={end} onChange={(d) => { setEnd(d); setMsg(''); }} step={15} />

      <Card tone={tooEarly || conflicts.length > 0 ? 'blush' : 'card'}>
        <Txt v="folio">Dan begin je</Txt>
        <Txt v="h2">{fmtDayTime(start, now)}</Txt>
        <Txt v="note">met: {steps[0]?.name.toLowerCase()}</Txt>
        {tooEarly ? <Txt style={p.mt}>Dat is al voorbij. Kies een later uur.</Txt> : null}
        {!tooEarly && windows.length > 0 ? (
          conflicts.length === 0 ? (
            <Txt style={p.mt}>Al het handwerk valt op een moment dat je thuis bent.</Txt>
          ) : (
            <>
              <Txt style={p.mt}>Niet thuis bij: {conflicts.slice(0, 4).map((c) => `${c.name.toLowerCase()} (${fmtDayTime(new Date(c.startAt), now)})`).join(', ')}{conflicts.length > 4 ? ' ...' : ''}.</Txt>
              <Gap />
              <Button small v="green" label="Zoek een moment dat past" onPress={() => {
                const fit = findFittingEnd(recipe.process, end, windows, now);
                if (fit) { setEnd(fit); setMsg(`Gevonden: klaar ${fmtDayTime(fit, now)}.`); }
                else setMsg('Niets gevonden binnen een week. Pas je thuis-momenten of de tijden van het recept aan.');
              }} />
            </>
          )
        ) : null}
        {msg ? <Txt v="note" style={p.mt}>{msg}</Txt> : null}
      </Card>

      <Card style={p.list}>
        {steps.filter((s) => s.kind === 'hand').map((s) => (
          <View key={s.id} style={p.previewRow}>
            <Txt v="bold" style={p.previewTime}>{fmtTime(new Date(s.startAt))}</Txt>
            <Txt style={p.flex}>{s.name}</Txt>
            <Txt v="note">{fmtDay(new Date(s.startAt), now)}</Txt>
          </View>
        ))}
      </Card>
      <Button label="Plan deze bak" disabled={tooEarly} onPress={() => { if (kitchen !== undefined) updateSettings({ kitchenTempC: kitchen }); if (planBake(recipe.id, end, kitchen)) onDone(); }} />
      <Button v="ghost" label="Werkwijze en tijden aanpassen" onPress={() => router.push(`/recept/${recipe.id}`)} />
    </>
  );
}

export default function Plan() {
  const router = useRouter();
  const { recept } = useLocalSearchParams<{ recept?: string }>();
  const now = useNow(1000);
  const bakes = plannedBakes(useCrumbly((s) => s.bakes));
  const [selected, setSelected] = useState<string | null>(null);
  const [planning, setPlanning] = useState<boolean>(!!recept);
  useEffect(() => { if (recept) setPlanning(true); }, [recept]);

  const bake = bakes.find((b) => b.id === selected) ?? bakes[0];
  const showPlanner = planning || !bake;

  return (
    <Screen folio="Bak plannen" title={showPlanner ? 'Nieuwe bak' : bake?.recipeName ?? ''}>
      {bakes.length > 0 ? (
        <Row style={p.wrap}>
          {bakes.map((b) => (
            <Chip key={b.id} label={`${b.recipeName}, ${fmtDay(new Date(b.endAt), now)}`} on={!showPlanner && b.id === bake?.id} onPress={() => { setSelected(b.id); setPlanning(false); }} />
          ))}
          <Chip label="Nieuwe bak" on={showPlanner} onPress={() => setPlanning(true)} />
        </Row>
      ) : null}
      {showPlanner ? <Planner initialRecipe={recept} onDone={() => { setPlanning(false); setSelected(null); if (recept) router.replace('/plan'); }} /> : bake ? <ActiveBake bake={bake} now={now} /> : null}
    </Screen>
  );
}

const p = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexWrap: 'wrap', gap: 0 },
  mb: { marginBottom: space(1) },
  mt: { marginTop: space(1) },
  count: { fontSize: 48, lineHeight: 56, marginVertical: space(1) },
  tempNum: { flex: 1, textAlign: 'center', fontSize: 28 },
  onPunch: { color: colors.bg },
  onPunchMuted: { color: colors.blush },
  lightBtn: { borderColor: colors.bg },
  list: { paddingVertical: 4 },
  step: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, minHeight: 60 },
  stepNow: { backgroundColor: colors.blush, marginHorizontal: -space(1), paddingHorizontal: space(1), borderRadius: 12 },
  stepMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(1), minHeight: 60, paddingVertical: 6 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.grn },
  checkOn: { backgroundColor: colors.grn },
  time: { width: 56 },
  timeText: { color: colors.ter },
  doneText: { textDecorationLine: 'line-through', color: colors.mut },
  waitText: { color: colors.mut },
  endRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: space(1), minHeight: 40, borderBottomWidth: 1, borderBottomColor: colors.line },
  previewTime: { width: 52, color: colors.ter },
});
