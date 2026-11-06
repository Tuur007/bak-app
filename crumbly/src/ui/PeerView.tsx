// De starter van een gekoppeld account, enkel lezen: geen knoppen om te voeden of aan te passen.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { fmtDayTime, fmtLongDate } from '../domain/dates';
import { peerName, type PeerData } from '../domain/peers';
import { ageDays, formatHours, liveFeeds, nextFeedDue, parseDay, peakSeries, readiness } from '../domain/starter';
import { useCrumbly } from '../store/store';
import { Card, Gap, Screen, Txt } from './kit';
import { colors, space } from './theme';
import { Dots, PeakChart, useNow } from './widgets';
import { locationLabel, locationSince } from '../domain/location';
import { StarterLog } from './StarterActions';

export function PeerView({ peer, top }: { peer: PeerData; top: ReactNode }) {
  const now = useNow(60_000);
  const ownName = useCrumbly((s) => s.starter?.name);
  const name = peerName(peer, ownName);
  const starter = peer.starter;
  const updated = `Bijgewerkt ${fmtDayTime(new Date(peer.pulledAt), now)}.`;
  const banner = (
    <View style={st.banner} accessibilityRole="header">
      <Txt v="bold" style={st.bannerText} numberOfLines={1}>{name} · alleen kijken</Txt>
    </View>
  );

  if (!starter) {
    return (
      <Screen folio="Gekoppelde starter" title={name} banner={banner}>
        {top}
        <Card tone="blush">
          <Txt v="folio">Alleen kijken</Txt>
          <Txt style={st.mt}>Nog geen gegevens van de ander. Ze verschijnen zodra die Crumbly opent en synchroniseert. {updated}</Txt>
        </Card>
      </Screen>
    );
  }

  const r = readiness(starter, peer.feeds, now);
  const series = peakSeries(peer.feeds, 14);
  const list = liveFeeds(peer.feeds).slice().reverse();
  const next = nextFeedDue(starter, peer.feeds);
  const split = starter.splitFrom ? ` Gesplitst van ${starter.splitFrom}${starter.splitOn ? ` op ${fmtLongDate(parseDay(starter.splitOn))}` : ''}.` : '';

  return (
    <Screen folio="Gekoppelde starter" title={name} banner={banner} sub={`Gestart op ${fmtLongDate(parseDay(starter.startedOn))}, dag ${ageDays(starter.startedOn, now)}.${split}`}>
      {top}
      <Card tone="blush">
        <Txt v="folio">Alleen kijken</Txt>
        <Txt style={st.mt}>Dit is de starter van het gekoppelde account. Jij ziet hem, de ander beheert hem. {updated}</Txt>
      </Card>

      <Card>
        <Txt v="folio">Klaar om te bakken?</Txt>
        <Txt v="h2" style={st.mt}>{r.ready ? 'Ja, hij lijkt klaar' : r.tooYoung && r.streak >= r.needed ? 'Bijna, nog even jong' : 'Nog niet helemaal'}</Txt>
        <Gap />
        <Dots filled={Math.min(r.streak, r.needed)} total={r.needed} />
        <Txt v="note">
          {r.measured === 0
            ? 'Nog geen verdubbeling aangeduid.'
            : `${r.streak} van ${r.needed} keer op rij verdubbeld binnen ${starter.thresholdHours} uur.${r.lastHours ? ` Laatste keer: ${formatHours(r.lastHours)}.` : ''}`}
        </Txt>
      </Card>

      <Card>
        <Txt v="folio">Voeding</Txt>
        <Txt style={st.mt}>{list.length > 0 ? `Laatst gevoed: ${fmtDayTime(new Date(list[0].fedAt), now)}.` : 'Nog geen voedingen.'}</Txt>
        {next ? <Txt v="note">Volgende voeding rond {fmtDayTime(next, now)}.</Txt> : null}
        <Txt v="note">Staat {locationLabel(starter.location)}{locationSince(starter) ? ` sinds ${fmtDayTime(new Date(locationSince(starter) as string), now)}` : ''}. Verhouding {starter.defaultRatio}.</Txt>
      </Card>

      <Card>
        <Txt v="folio">Logboek</Txt>
        <StarterLog starter={starter} feeds={peer.feeds} now={now} />
      </Card>

      <Card>
        <Txt v="folio">Uren tot verdubbeling</Txt>
        {series.length >= 3 ? (
          <>
            <PeakChart points={series} threshold={starter.thresholdHours} />
            <Txt v="note">Lager is sterker. Groen = binnen {starter.thresholdHours} uur.</Txt>
          </>
        ) : (
          <Txt style={st.mt}>De grafiek verschijnt na 3 metingen ({series.length} van 3).</Txt>
        )}
      </Card>
    </Screen>
  );
}

const st = StyleSheet.create({
  mt: { marginTop: space(1) },
  banner: { backgroundColor: colors.grn, paddingHorizontal: space(2), paddingVertical: space(1) },
  bannerText: { color: '#F6F0E6' },
  feed: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: space(1), paddingTop: space(1) },
});
