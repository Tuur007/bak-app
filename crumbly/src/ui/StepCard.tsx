import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { fmtCountdown, fmtDayTime, fmtTime } from '../domain/dates';
import { isDoughRise, stepHeadline } from '../domain/schedule';
import type { Bake } from '../domain/types';
import { useCrumbly } from '../store/store';
import { Button, Card, Gap, Row, Txt } from './kit';
import { colors, space } from './theme';

/** De eerstvolgende stap van een bak: nu, wachten (met "is het deeg klaar?") of volgende. */
export function StepCard({ bake, now, showName, showPlanLink }: { bake: Bake; now: Date; showName?: boolean; showPlanLink?: boolean }) {
  const router = useRouter();
  const setStepDone = useCrumbly((s) => s.setStepDone);
  const finishWait = useCrumbly((s) => s.finishWait);
  const startBakeNow = useCrumbly((s) => s.startBakeNow);
  const delayBake = useCrumbly((s) => s.delayBake);
  const h = stepHeadline(bake.steps, now);
  if (!h) return null;
  const step = bake.steps.find((x) => !x.doneAt)!;
  const loud = h.label === 'Nu';
  const light = loud ? c.onPunch : undefined;

  let count: string;
  if (h.label === 'Nu') count = 'nu';
  else if (h.msUntil !== null && h.msUntil < 6 * 3600_000) count = h.msUntil > 0 ? fmtCountdown(h.msUntil) : 'kijk nu';
  else count = h.at ? fmtDayTime(h.at, now) : '';

  return (
    <Card tone={loud ? 'punch' : 'card'}>
      <Txt v="folio" style={loud ? c.onPunchMuted : undefined}>{h.label}{showName ? ` · ${bake.recipeName}` : ''}</Txt>
      <Txt v="h2" style={[c.mt, light]}>{h.title}</Txt>
      <Txt v="title" style={[c.count, light]}>{count}</Txt>
      {h.waiting && h.at ? <Txt v="note" style={c.mb}>{h.nextName ? `Daarna: ${h.nextName.toLowerCase()}, gepland om ${fmtTime(h.at)}.` : `Gepland tot ${fmtTime(h.at)}.`}</Txt> : null}

      {h.label === 'Nu' ? (
        <>
          <Button v="green" label="Gedaan" onPress={() => setStepDone(bake.id, step.id, true)} />
          <Txt v="note" style={c.onPunchMuted}>Loopt het uit? Alles schuift mee.</Txt>
          <Row style={c.mt}>
            <Button small v="outline" label="+15 min" onPress={() => delayBake(bake.id, 15)} light style={c.lightBtn} />
            <Button small v="outline" label="+30 min" onPress={() => delayBake(bake.id, 30)} light style={c.lightBtn} />
            <Button small v="outline" label="+1 u" onPress={() => delayBake(bake.id, 60)} light style={c.lightBtn} />
          </Row>
        </>
      ) : null}

      {h.label === 'Volgende stap' ? (
        <>
          <Button small v="outline" label="Nu beginnen" onPress={() => startBakeNow(bake.id)} />
          <Txt v="note" style={c.mt}>Begin je vroeger dan gepland? Alles schuift mee.</Txt>
        </>
      ) : null}

      {h.waiting ? (
        <>
          {isDoughRise(step) ? (
            <View style={c.check}>
              <Txt v="bold">Is het deeg klaar? Kijk naar:</Txt>
              <Txt style={c.li}>Hoeveel het gerezen is, zoals je recept zegt</Txt>
              <Txt style={c.li}>Bellen aan de rand en bovenaan</Txt>
              <Txt style={c.li}>Luchtig, wiebelig en met spanning</Txt>
              <Txt v="note" style={c.mt}>De tijd is een schatting. Het deeg beslist.</Txt>
            </View>
          ) : null}
          <Button v="green" label={isDoughRise(step) ? 'Deeg is klaar, volgende stap' : 'Klaar, volgende stap'} onPress={() => finishWait(bake.id, step.id)} />
          <Row>
            <Button small v="outline" label="Nog niet: +15 min" onPress={() => delayBake(bake.id, 15)} />
            <Button small v="outline" label="+30 min" onPress={() => delayBake(bake.id, 30)} />
          </Row>
        </>
      ) : null}

      {showPlanLink ? (
        <>
          <Gap />
          <Button v="outline" label="Naar het bakplan" onPress={() => router.push('/plan')} light={loud} style={loud ? c.lightBtn : undefined} />
        </>
      ) : null}
      {showPlanLink ? <Txt v="note" style={loud ? c.onPunchMuted : undefined}>Brood klaar: {fmtDayTime(new Date(bake.endAt), now)}</Txt> : null}
    </Card>
  );
}

const c = StyleSheet.create({
  mt: { marginTop: 4 },
  mb: { marginBottom: space(1) },
  count: { fontSize: 48, lineHeight: 56, marginVertical: space(1) },
  li: { marginTop: 4 },
  check: { backgroundColor: colors.blush, borderRadius: 16, padding: space(2), marginBottom: space(1) },
  onPunch: { color: colors.bg },
  onPunchMuted: { color: colors.blush },
  lightBtn: { borderColor: colors.bg },
});
