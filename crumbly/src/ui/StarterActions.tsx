// Kleine bouwstenen rond de starter, gedeeld door het startscherm en het starterscherm:
// "Gevoed" met ongedaan maken, de plek (koelkast of kamertemperatuur) met één tik, en het logboek.
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { fmtDayTime, fmtTime } from '../domain/dates';
import { feedIntervalHours, feedSummary, locationLabel, locationSince, starterLog } from '../domain/location';
import type { Feed, Starter } from '../domain/types';
import { useCrumbly } from '../store/store';
import { Button, Row, Txt } from './kit';
import { colors, radius, space } from './theme';

/** "Gevoed" met een bevestiging en "Ongedaan maken" (15 seconden). */
export function useFeedWithUndo(): { feed: () => void; note: ReactNode } {
  const feedNow = useCrumbly((s) => s.feedNow);
  const deleteFeed = useCrumbly((s) => s.deleteFeed);
  const [last, setLast] = useState<{ id: string; at: Date } | null>(null);
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setLast(null), 15_000);
    return () => clearTimeout(t);
  }, [last]);
  const feed = (): void => {
    const at = new Date();
    setLast({ id: feedNow(at), at });
  };
  const note = last ? (
    <View style={st.undo} accessibilityLiveRegion="polite">
      <Txt v="bold" style={st.undoText}>Voeding genoteerd om {fmtTime(last.at)}.</Txt>
      <Button small v="outline" light style={st.undoBtn} label="Ongedaan maken" onPress={() => { deleteFeed(last.id); setLast(null); }} />
    </View>
  ) : null;
  return { feed, note };
}

/** Waar staat de starter, sinds wanneer, en één knop om hem te verplaatsen. */
export function LocationControl({ starter, now, compact }: { starter: Starter; now: Date; compact?: boolean }) {
  const moveStarterTo = useCrumbly((s) => s.moveStarterTo);
  const [justOut, setJustOut] = useState(false);
  const since = locationSince(starter);
  const fridge = starter.location === 'koelkast';
  const days = Math.round(feedIntervalHours(starter) / 24);
  return (
    <View>
      <Txt v={compact ? 'note' : 'body'}>
        Staat {locationLabel(starter.location)}{since ? ` sinds ${fmtDayTime(new Date(since), now)}` : ''}.
        {fridge ? ` Voeden om de ${days} dagen.` : ''}
      </Txt>
      <Row style={st.mt}>
        <Button
          small
          v={fridge ? 'green' : 'outline'}
          label={fridge ? 'Uit de koelkast gehaald' : 'In de koelkast gezet'}
          onPress={() => { moveStarterTo(fridge ? 'kamer' : 'koelkast'); setJustOut(fridge); }}
        />
      </Row>
      {justOut && !fridge ? (
        <Txt v="note">Voed {starter.name} nu en laat hem op kamertemperatuur komen. De eerste verdubbeling na de koelkast telt niet mee voor "klaar om te bakken".</Txt>
      ) : null}
    </View>
  );
}

/** Logboek: voedingen en verplaatsingen samen, nieuwste eerst. `renderFeed` laat het starterscherm een voeding aanpasbaar maken. */
export function StarterLog({ starter, feeds, now, renderFeed, limit = 14 }: { starter: Starter; feeds: Feed[]; now: Date; renderFeed?: (f: Feed) => ReactNode; limit?: number }) {
  const log = starterLog(starter, feeds, limit);
  if (log.length === 0) return <Txt style={st.mt}>Nog niets genoteerd.</Txt>;
  return (
    <>
      {log.map((e) =>
        e.kind === 'plek' ? (
          <View key={`plek-${e.at}`} style={st.row}>
            <Txt v="bold">{fmtDayTime(new Date(e.at), now)}</Txt>
            <Txt v="note">{e.location === 'koelkast' ? 'In de koelkast gezet' : 'Uit de koelkast gehaald'}</Txt>
          </View>
        ) : renderFeed ? (
          <View key={e.feed.id}>{renderFeed(e.feed)}</View>
        ) : (
          <View key={e.feed.id} style={st.row}>
            <Txt v="bold">{fmtDayTime(new Date(e.feed.fedAt), now)}</Txt>
            <Txt v="note">{feedSummary(e.feed)}</Txt>
            {e.feed.note ? <Txt v="note">{e.feed.note}</Txt> : null}
          </View>
        ),
      )}
    </>
  );
}

const st = StyleSheet.create({
  mt: { marginTop: space(1) },
  row: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: space(1), paddingTop: space(1) },
  undo: { backgroundColor: colors.grn, borderRadius: radius.card, paddingHorizontal: space(2), paddingTop: space(1), marginBottom: space(2), flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space(1) },
  undoBtn: { borderColor: '#F6F0E6' },
  undoText: { color: '#F6F0E6', flex: 1, minWidth: 160, paddingBottom: space(1) },
});
