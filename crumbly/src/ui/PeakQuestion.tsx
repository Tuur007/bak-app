import { StyleSheet, View } from 'react-native';
import { fmtDayTime } from '../domain/dates';
import { feedToAsk, PEAK_ANSWERS } from '../domain/starter';
import { useCrumbly } from '../store/store';
import { Button, Card, Chip, Row, Txt } from './kit';
import { space } from './theme';

/** De ene vraag van de dag: hoe snel verdubbelde de starter? Eén tik, geen uur invullen. */
export function PeakQuestion({ now }: { now: Date }) {
  const starter = useCrumbly((s) => s.starter);
  const feeds = useCrumbly((s) => s.feeds);
  const answerPeak = useCrumbly((s) => s.answerPeak);
  const feed = feedToAsk(feeds, now, starter ?? undefined);
  if (!starter || !feed) return null;
  return (
    <Card tone="blush">
      <Txt v="folio">Eén tik</Txt>
      <Txt v="bold" style={st.mt}>Hoe snel verdubbelde {starter.name} na de voeding van {fmtDayTime(new Date(feed.fedAt), now)}?</Txt>
      <Txt v="note" style={st.mb}>Zo weet Crumbly wanneer hij klaar is om te bakken. Een schatting volstaat.</Txt>
      <View style={st.chips}>
        {PEAK_ANSWERS.map((a) => <Chip key={a.hours} label={a.label} onPress={() => answerPeak(feed.id, a.hours)} />)}
      </View>
      <Row>
        <Button small v="outline" label="Niet gevoed" onPress={() => answerPeak(feed.id, 'niet-gevoed')} />
        <Button small v="outline" label="Niet bekeken" onPress={() => answerPeak(feed.id, 'niet-gekeken')} />
      </Row>
    </Card>
  );
}

const st = StyleSheet.create({
  mt: { marginTop: 4 },
  mb: { marginBottom: space(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
