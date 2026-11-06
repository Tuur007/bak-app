import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { addDays, fmtDayTime, fmtLongDate, toDayString } from '../../src/domain/dates';
import { peerName } from '../../src/domain/peers';
import { feedAmounts, parseFeedRatio } from '../../src/domain/ratios';
import { ageDays, liveFeeds, parseDay, peakSeries, readiness } from '../../src/domain/starter';
import type { Feed } from '../../src/domain/types';
import { useCrumbly } from '../../src/store/store';
import { Button, Card, Field, Gap, num, Row, Screen, Segmented, str, Txt } from '../../src/ui/kit';
import { PeerView } from '../../src/ui/PeerView';
import { LocationControl, StarterLog, feedSummary, useFeedWithUndo } from '../../src/ui/StarterActions';
import { DEFAULT_FRIDGE_FEED_DAYS } from '../../src/domain/location';
import { colors, space } from '../../src/ui/theme';
import { PeakQuestion } from '../../src/ui/PeakQuestion';
import { HhmmStepper, PeakChart, TimeStepper, useNow } from '../../src/ui/widgets';
import { Toggle } from '../../src/ui/kit';

function FeedRow({ f, now }: { f: Feed; now: Date }) {
  const [open, setOpen] = useState(false);
  const updateFeed = useCrumbly((s) => s.updateFeed);
  const deleteFeed = useCrumbly((s) => s.deleteFeed);
  return (
    <View style={st.feed}>
      <Pressable onPress={() => setOpen(!open)} style={st.feedHead} accessibilityRole="button" accessibilityLabel="voeding aanpassen">
        <View style={st.flex}>
          <Txt v="bold">{fmtDayTime(new Date(f.fedAt), now)}</Txt>
          <Txt v="note">{feedSummary(f)}</Txt>
          {f.note ? <Txt v="note">{f.note}</Txt> : null}
        </View>
        <Txt v="note">{open ? 'sluiten' : 'aanpassen'}</Txt>
      </Pressable>
      {open ? (
        <View style={st.feedEdit}>
          <Txt v="label">Gevoed om</Txt>
          <TimeStepper value={new Date(f.fedAt)} onChange={(d) => updateFeed(f.id, { fedAt: d.toISOString() })} />
          <Txt v="label">Verdubbeld om</Txt>
          {f.peakAt ? (
            <TimeStepper value={new Date(f.peakAt)} onChange={(d) => updateFeed(f.id, { peakAt: d.toISOString() })} />
          ) : (
            <Button small v="outline" label="Nu aanduiden" onPress={() => updateFeed(f.id, { peakAt: new Date().toISOString() })} />
          )}
          <Gap />
          <Field label="Notitie" value={f.note ?? ''} onChange={(v) => updateFeed(f.id, { note: v })} placeholder="bv. rogge erbij, warm in de keuken" />
          <Button small v="danger" label="Voeding verwijderen" onPress={() => deleteFeed(f.id)} />
        </View>
      ) : null}
    </View>
  );
}

function MijnStarter({ top }: { top: ReactNode }) {
  const now = useNow(30_000);
  const starter = useCrumbly((s) => s.starter);
  const feeds = useCrumbly((s) => s.feeds);
  const { feed, note: feedNote } = useFeedWithUndo();
  const [earlierAt, setEarlierAt] = useState<Date | null>(null);
  const markPeak = useCrumbly((s) => s.markPeak);
  const updateStarter = useCrumbly((s) => s.updateStarter);
  const [keepG, setKeepG] = useState('20');

  if (!starter) return <Screen title="Starter"><Txt>Even geduld...</Txt></Screen>;
  const r = readiness(starter, feeds, now);
  const series = peakSeries(feeds, 14);
  const lastFedAt = new Date(liveFeeds(feeds).slice(-1)[0]?.fedAt ?? Date.now()).getTime() + 30 * 60_000;
  const amounts = feedAmounts(starter.defaultRatio, num(keepG));

  return (
    <Screen folio="Starter" title={starter.name} sub={`Gestart op ${fmtLongDate(parseDay(starter.startedOn))}, dag ${ageDays(starter.startedOn, now)}.${starter.splitFrom ? ` Gesplitst van ${starter.splitFrom}${starter.splitOn ? ` op ${fmtLongDate(parseDay(starter.splitOn))}` : ''}.` : ''}`}>
      {top}
      <Row style={st.buttons}>
        <Button style={st.flex} label="Gevoed" onPress={feed} />
        <Button style={st.flex} v="green" label="Verdubbeld" onPress={() => markPeak()} disabled={!r.waitingForPeak} />
      </Row>
      <Txt v="note" style={st.hint}>
        {r.waitingForPeak ? `Tik op "Verdubbeld" zodra ${starter.name} dubbel zo hoog staat. Te laat getikt? Pas het uur aan in de lijst.` : `Na het voeden tik je op "Gevoed". Zo leert de app hoe snel ${starter.name} is.`}
      </Txt>

      {feedNote}
      {r.waitingForPeak ? (
        <View style={st.earlier}>
          {earlierAt ? (
            <>
              <Txt v="label">Verdubbeld om</Txt>
              <TimeStepper value={earlierAt} onChange={setEarlierAt} />
              <Row>
                <Button small v="green" label="Bewaar" onPress={() => { markPeak(earlierAt); setEarlierAt(null); }} />
                <Button small v="ghost" label="Annuleer" onPress={() => setEarlierAt(null)} />
              </Row>
            </>
          ) : (
            <Button small v="ghost" label="Eerder verdubbeld? Kies het uur" onPress={() => setEarlierAt(new Date(Math.max(Date.now() - 60 * 60_000, lastFedAt)))} style={st.left} />
          )}
        </View>
      ) : null}

      <PeakQuestion now={now} />

      <Card>
        <Txt v="folio">Logboek</Txt>
        <StarterLog starter={starter} feeds={feeds} now={now} renderFeed={(f) => <FeedRow f={f} now={now} />} />
      </Card>

      <Card>
        <Txt v="folio">Waar staat {starter.name}?</Txt>
        <Gap />
        <LocationControl starter={starter} now={now} />
        <Gap />
        <Field label="In de koelkast voeden om de (dagen)" value={str(starter.fridgeFeedDays ?? DEFAULT_FRIDGE_FEED_DAYS)} onChange={(v) => updateStarter({ fridgeFeedDays: Math.max(1, Math.round(num(v))) })} numeric />
        <Txt v="note">In de koelkast komt de herinnering om te voeden niet elke dag maar om de zoveel dagen. Voedingen in de koelkast, en de eerste erna, tellen niet mee voor "klaar om te bakken".</Txt>
      </Card>

      <Card>
        <Txt v="folio">Voeden</Txt>
        <Toggle
          value={!!starter.autoFeedAt}
          onChange={(on) => updateStarter(on ? { autoFeedAt: starter.autoFeedAt ?? '18:00', autoFeedSince: toDayString(new Date()) } : { autoFeedAt: undefined, autoFeedSince: undefined })}
          label="Voeding zelf laten noteren"
          note={starter.autoFeedAt ? `Crumbly noteert elke dag om ${starter.autoFeedAt} dat je ${starter.name} voedde, behalve als je weg bent. Voedde je niet, tik dan "Niet gevoed" bij de vraag.` : 'Voed je elke dag rond hetzelfde uur? Dan hoef je niets meer te tikken bij het voeden. Enkel vanaf vandaag.'}
        />
        {starter.autoFeedAt ? (
          <Row style={st.mtSmall}>
            <Txt v="label">Om</Txt>
            <HhmmStepper value={starter.autoFeedAt} onChange={(v) => updateStarter({ autoFeedAt: v })} />
          </Row>
        ) : null}
        <Row style={st.mt}>
          <Field style={st.flex} label="Starter die je houdt (g)" value={keepG} onChange={setKeepG} numeric />
          <Field style={st.flex} label="Verhouding" value={starter.defaultRatio} onChange={(v) => updateStarter({ defaultRatio: v })} />
        </Row>
        <Txt>{amounts ? `Voeg ${str(amounts.flour)} g meel en ${str(amounts.water)} g water toe.` : parseFeedRatio(starter.defaultRatio) ? 'Vul de hoeveelheid starter in.' : 'Schrijf de verhouding als 1:5:5 (starter:meel:water).'}</Txt>
      </Card>

      <Card>
        <Txt v="folio">Uren tot verdubbeling</Txt>
        {series.length >= 3 ? (
          <>
            <PeakChart points={series} threshold={starter.thresholdHours} />
            <Txt v="note">Lager is sterker. Groen = binnen {starter.thresholdHours} uur.</Txt>
          </>
        ) : (
          <Txt style={st.mt}>De grafiek verschijnt na 3 metingen ({series.length} van 3). Ze toont of {starter.name} sneller verdubbelt, en dus sterker wordt.</Txt>
        )}
      </Card>

      <Card>
        <Txt v="folio">Over {starter.name}</Txt>
        <Gap />
        <Field label="Naam" value={starter.name} onChange={(v) => updateStarter({ name: v })} />
        <Txt v="label">Gestart op</Txt>
        <Row style={st.mtSmall}>
          <Button small v="outline" label="-1 dag" onPress={() => updateStarter({ startedOn: toDayString(addDays(parseDay(starter.startedOn), -1)) })} />
          <Txt v="bold" style={st.flexCenter}>{fmtLongDate(parseDay(starter.startedOn))}</Txt>
          <Button small v="outline" label="+1 dag" onPress={() => updateStarter({ startedOn: toDayString(addDays(parseDay(starter.startedOn), 1)) })} />
        </Row>
        <Gap />
        <Field label="Gesplitst van (naam, mag leeg)" value={starter.splitFrom ?? ''} onChange={(v) => updateStarter({ splitFrom: v.trim() === '' ? undefined : v, splitOn: v.trim() === '' ? undefined : starter.splitOn ?? toDayString(new Date()) })} placeholder="bv. Jean Flore" />
        {starter.splitFrom ? (
          <>
            <Txt v="label">Gesplitst op</Txt>
            <Row style={st.mtSmall}>
              <Button small v="outline" label="-1 dag" onPress={() => updateStarter({ splitOn: toDayString(addDays(parseDay(starter.splitOn ?? toDayString(new Date())), -1)) })} />
              <Txt v="bold" style={st.flexCenter}>{fmtLongDate(parseDay(starter.splitOn ?? toDayString(new Date())))}</Txt>
              <Button small v="outline" label="+1 dag" onPress={() => updateStarter({ splitOn: toDayString(addDays(parseDay(starter.splitOn ?? toDayString(new Date())), 1)) })} />
            </Row>
            <Txt v="note">De leeftijd telt door vanaf de oorspronkelijke startdatum hierboven.</Txt>
          </>
        ) : null}
        <Gap />
        <Row>
          <Field style={st.flex} label="Voeden om de (uur)" value={str(starter.feedIntervalHours)} onChange={(v) => updateStarter({ feedIntervalHours: Math.max(1, num(v)) })} numeric />
          <Field style={st.flex} label="Klaar binnen (uur)" value={str(starter.thresholdHours)} onChange={(v) => updateStarter({ thresholdHours: Math.max(1, num(v)) })} numeric />
        </Row>
        <Field label="Zoveel keer op rij" value={str(starter.streakNeeded)} onChange={(v) => updateStarter({ streakNeeded: Math.max(1, Math.round(num(v))) })} numeric />
        <Txt v="note">"Klaar" is een schatting volgens bakkersbronnen: hij verdubbelt een paar keer op rij binnen enkele uren, en is minstens 14 dagen oud. Jij beslist.</Txt>
      </Card>
    </Screen>
  );
}

export default function Starter() {
  const peers = useCrumbly((s) => s.peers);
  const ownName = useCrumbly((s) => s.starter?.name);
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<string>(params.view ?? 'mine');
  useEffect(() => { setView(params.view ?? 'mine'); }, [params.view]);
  const peer = peers.find((p) => p.userId === view);
  if (peers.length === 0) return <MijnStarter top={null} />;
  const top = (
    <Segmented
      options={[{ value: 'mine', label: ownName ?? 'Mijn starter' }, ...peers.map((p) => ({ value: p.userId, label: peerName(p, ownName) }))]}
      value={peer ? view : 'mine'}
      onChange={setView}
    />
  );
  return peer ? <PeerView peer={peer} top={top} /> : <MijnStarter top={top} />;
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  flexCenter: { flex: 1, textAlign: 'center' },
  buttons: { alignItems: 'flex-start' },
  hint: { marginBottom: space(2) },
  mt: { marginTop: space(1) },
  mtSmall: { marginTop: 4, marginBottom: 4, flexWrap: 'wrap' },
  earlier: { marginBottom: space(2) },
  left: { alignSelf: 'flex-start' },
  feed: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: space(1) },
  feedHead: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingTop: space(1) },
  feedEdit: { paddingVertical: space(1) },
});
