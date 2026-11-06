import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { fmtDay, fmtDayTime, fmtLongDate, fmtTime, toDayString } from '../../src/domain/dates';
import type { Feed } from '../../src/domain/types';
import { activeAway, stepState, upcomingAway } from '../../src/domain/schedule';
import { earliestBakeDay, formatHours, liveFeeds, nextFeedDue, readiness } from '../../src/domain/starter';
import { useSessionEmail } from '../../src/services/auth';
import { syncNow, useSyncStatus } from '../../src/services/sync';
import { supabase } from '../../src/services/supabase';
import { liveRecipes, plannedBakes, useCrumbly } from '../../src/store/store';
import { Button, Card, Gap, Row, Screen, Txt } from '../../src/ui/kit';
import { space } from '../../src/ui/theme';
import { StarterOverview } from '../../src/ui/StarterOverview';
import { LocationControl, useFeedWithUndo } from '../../src/ui/StarterActions';
import { backFromAwayWithFridge, DEFAULT_FRIDGE_FEED_DAYS } from '../../src/domain/location';
import { PeakQuestion } from '../../src/ui/PeakQuestion';
import { StepCard } from '../../src/ui/StepCard';
import { Arch, Dots, Gear, useNow } from '../../src/ui/widgets';

/**
 * Voed je de laatste 3 keer rond hetzelfde uur (binnen een uur van elkaar)? Dan stellen we voor dat Crumbly het
 * zelf noteert, op dat uur (afgerond op een kwartier).
 */
function suggestAutoFeed(feeds: Feed[]): string | null {
  const last = liveFeeds(feeds).slice(-3);
  if (last.length < 3) return null;
  const mins = last.map((f) => { const d = new Date(f.fedAt); return d.getHours() * 60 + d.getMinutes(); });
  if (Math.max(...mins) - Math.min(...mins) > 60) return null;
  const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length / 15) * 15;
  return `${String(Math.floor(avg / 60) % 24).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`;
}

export default function Vandaag() {
  const router = useRouter();
  const now = useNow(1000);
  const starter = useCrumbly((s) => s.starter);
  const feeds = useCrumbly((s) => s.feeds);
  const away = useCrumbly((s) => s.away);
  const allBakes = useCrumbly((s) => s.bakes);
  const bakes = plannedBakes(allBakes);
  const { feed, note: feedNote } = useFeedWithUndo();
  const updateStarter = useCrumbly((s) => s.updateStarter);
  const dirtyCount = useCrumbly((s) => s.dirty.length);
  const markPeak = useCrumbly((s) => s.markPeak);
  const recipes = useCrumbly((s) => s.recipes);
  const sessionEmail = useSessionEmail();

  const sync = useSyncStatus();
  const onboarded = useCrumbly((s) => s.settings.onboarded);
  const lastPulledAt = useCrumbly((s) => s.lastPulledAt);

  // Eerste keer: toon de welkom-pagina. Is er een account, wacht dan op de eerste sync, zodat wie
  // al een bak had op een ander toestel niet opnieuw begint.
  const needsWelcome = !onboarded && (sessionEmail === null || (typeof sessionEmail === 'string' && lastPulledAt !== null));
  useEffect(() => {
    if (needsWelcome) router.replace('/welkom');
  }, [needsWelcome, router]);

  if (!starter) return <Screen title="Crumbly"><Txt>Even geduld...</Txt></Screen>;
  // Net aangemeld op dit toestel: wacht op je gegevens uit de cloud, anders zie je even de startgegevens ("Jean").
  if (typeof sessionEmail === 'string' && lastPulledAt === null && sync.kind !== 'fout') {
    return (
      <Screen folio="Crumbly" title="Je gegevens ophalen">
        <Txt>Even geduld, je starter en recepten komen eraan.</Txt>
      </Screen>
    );
  }

  const r = readiness(starter, feeds, now);
  const earliest = earliestBakeDay(starter, feeds, now);
  const nextFeed = nextFeedDue(starter, feeds);
  const bake = bakes[0];
  const st = bake ? stepState(bake.steps, now) : null;
  const awayNow = activeAway(away, now);
  const awaySoon = upcomingAway(away, now).filter((p) => p !== awayNow)[0];
  const lastResult = allBakes
    .filter((b) => !b.deletedAt && b.result?.nextTime)
    .sort((a, b) => (b.result?.at ?? '').localeCompare(a.result?.at ?? ''))[0];
  const hasFeeds = liveFeeds(feeds).length > 0;

  const archTitle = r.ready ? 'Ja, hij lijkt klaar' : r.tooYoung && r.streak >= r.needed ? 'Bijna, nog even jong' : 'Nog niet helemaal';
  const archText = r.ready
    ? `${r.streak} keer op rij verdubbeld binnen ${starter.thresholdHours} uur. Jij beslist: ruikt en ziet hij er goed uit, dan kan je bakken.`
    : r.measured === 0
      ? `Duid na het voeden aan wanneer ${starter.name} verdubbeld is. Na ${r.needed} keer op rij binnen ${starter.thresholdHours} uur is hij klaar.`
      : `${r.streak} van ${r.needed} keer op rij verdubbeld binnen ${starter.thresholdHours} uur.${r.lastHours ? ` Laatste keer: ${formatHours(r.lastHours)}.` : ''}`;

  return (
    <Screen folio={`Dag ${r.ageDays} · ${fmtLongDate(now)}`} title={`Dag ${r.ageDays} met ${starter.name}`} right={<Gear onPress={() => router.push('/instellingen')} />}>
      {sync.kind === 'fout' ? (
        <Card tone="blush">
          <Txt v="folio">Synchroniseren mislukt</Txt>
          <Txt style={s.mt}>{sync.message}</Txt>
          <Txt v="note" style={s.mt}>{dirtyCount > 0 ? `${dirtyCount} ${dirtyCount === 1 ? 'wijziging wacht' : 'wijzigingen wachten'} op dit toestel` : 'Alles staat op dit toestel'} en wordt verstuurd zodra het weer lukt.</Txt>
          <Gap />
          <Row><Button small v="green" label="Probeer opnieuw" onPress={() => void syncNow()} /></Row>
        </Card>
      ) : null}

      {awayNow ? (
        <Card tone="punch">
          <Txt v="folio" style={s.onPunchMuted}>Je bent weg</Txt>
          <Txt v="bold" style={s.onPunch}>Tot {fmtDayTime(new Date(awayNow.to), now)}.{awayNow.starterInFridge ? ` ${starter.name} rust in de koelkast.` : ''}</Txt>
        </Card>
      ) : null}

      <StarterOverview now={now} />

      {backFromAwayWithFridge(starter, away, now) ? (
        <Card tone="blush">
          <Txt v="folio">Welkom terug</Txt>
          <Txt style={s.mt}>{starter.name} staat nog in de koelkast. Haal hem eruit, voed hem en laat hem op kamertemperatuur komen.</Txt>
          <Gap />
          <LocationControl starter={starter} now={now} compact />
        </Card>
      ) : null}

      <Arch label="Klaar om te bakken?" title={archTitle}>
        <Dots filled={Math.min(r.streak, r.needed)} total={r.needed} />
        <Txt v="note" style={s.center}>{archText}</Txt>
      </Arch>

      <PeakQuestion now={now} />

      {bake && st?.step ? (
        <StepCard bake={bake} now={now} showName showPlanLink />
      ) : (
        <Card>
          <Txt v="folio">Volgende voeding</Txt>
          <Txt v="h2" style={s.mt}>{nextFeed ? `${fmtDay(nextFeed, now)} ${fmtTime(nextFeed)}` : `Voed ${starter.name} wanneer het je past`}</Txt>
          {starter.location === 'koelkast' ? (
            <Txt v="note" style={s.mt}>{starter.name} staat in de koelkast: voeden om de {starter.fridgeFeedDays ?? DEFAULT_FRIDGE_FEED_DAYS} dagen.</Txt>
          ) : null}
          {starter.autoFeedAt && starter.location !== 'koelkast' ? (
            <Txt v="note" style={s.mt}>Crumbly noteert de voeding zelf. Jij hoeft alleen af en toe de vraag hierboven te beantwoorden. Anders gevoed? Pas het aan bij {starter.name}.</Txt>
          ) : (
            <>
              <Gap />
              {r.waitingForPeak ? (
                <Button v="green" label={`${starter.name} is verdubbeld`} onPress={() => markPeak()} />
              ) : null}
              <Button label={`${starter.name} is gevoed`} onPress={feed} />
              {feedNote}
              <Txt v="note">Eén tik. Zelfde verhouding als altijd ({starter.defaultRatio}).{hasFeeds ? '' : ' Pas ze aan bij je starter.'}</Txt>
              {starter.location !== 'koelkast' && suggestAutoFeed(feeds) ? (
                <Button
                  small
                  v="ghost"
                  label={`Voed je elke dag rond ${suggestAutoFeed(feeds)}? Laat Crumbly het noteren`}
                  onPress={() => updateStarter({ autoFeedAt: suggestAutoFeed(feeds) ?? '08:00', autoFeedSince: toDayString(new Date()) })}
                />
              ) : null}
            </>
          )}
        </Card>
      )}

      {lastResult?.result ? (
        <Card tone="blush">
          <Txt v="folio">Vorige keer</Txt>
          <Txt style={s.mt}>{lastResult.result.nextTime}</Txt>
        </Card>
      ) : null}

      {!bake ? (
        <Card tone="blush">
          <Txt v="folio">Eerste brood</Txt>
          <Txt style={s.mt}>
            {r.ready
              ? `${starter.name} lijkt klaar. Kies een recept en plan je bak.`
              : earliest
                ? `Op zijn vroegst rond ${fmtLongDate(earliest)}. Een jonge starter heeft vaak 2 tot 4 weken nodig. Dit is een schatting: jij ziet het aan ${starter.name}.`
                : 'Plan je bak wanneer je er klaar voor bent.'}
          </Txt>
          <Gap />
          <Row>
            <Button small v="green" label="Plan een bak" onPress={() => router.push('/plan')} />
          </Row>
        </Card>
      ) : null}

      {awaySoon ? (
        <Card>
          <Txt v="folio">Straks weg</Txt>
          <Txt style={s.mt}>Van {fmtDayTime(new Date(awaySoon.from), now)} tot {fmtDayTime(new Date(awaySoon.to), now)}.</Txt>
        </Card>
      ) : null}
      {supabase && sessionEmail === null ? (
        <Card>
          <Txt v="folio">Bewaar je gegevens</Txt>
          <Txt style={s.mt}>Nu staat alles enkel op dit toestel. Met een account staat het ook veilig in de cloud.</Txt>
          <Gap />
          <Row><Button small v="outline" label="Aanmelden of account maken" onPress={() => router.push('/instellingen')} /></Row>
        </Card>
      ) : null}

      {liveRecipes(recipes).every((x) => x.isExample) ? (
        <Card>
          <Txt v="folio">Eerst even</Txt>
          <Txt style={s.mt}>Vul je eigen recept in. Het voorbeeld en zijn tijden zijn maar een vertrekpunt.</Txt>
          <Gap />
          <Row><Button small v="outline" label="Naar mijn recepten" onPress={() => router.push('/recepten')} /></Row>
        </Card>
      ) : null}
      <View style={s.bottom} />
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { textAlign: 'center' },
  mt: { marginTop: 4 },
  count: { fontSize: 48, lineHeight: 56, marginVertical: space(1) },
  onPunch: { color: '#F6F0E6' },
  onPunchMuted: { color: '#EBD2C4' },
  bottom: { height: space(2) },
});
