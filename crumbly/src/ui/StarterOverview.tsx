// Overzicht bovenaan het startscherm: welke starters zijn er en van wie. Je eigen starter, en de
// gekoppelde starters (enkel kijken). Zonder koppeling een duidelijke weg naar het koppelen.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { fmtDayTime } from '../domain/dates';
import { peerName } from '../domain/peers';
import { ageDays, liveFeeds, readiness } from '../domain/starter';
import { useCrumbly } from '../store/store';
import { Button, Card, Field, Gap, Row, Txt } from './kit';
import { colors, radius, space } from './theme';

function Tag({ label, tone }: { label: string; tone: 'own' | 'peer' }) {
  return (
    <View style={[st.tag, tone === 'own' ? st.tagOwn : st.tagPeer]}>
      <Txt v="label" style={tone === 'own' ? st.tagOwnText : st.tagPeerText}>{label}</Txt>
    </View>
  );
}

export function StarterOverview({ now }: { now: Date }) {
  const router = useRouter();
  const starter = useCrumbly((s) => s.starter);
  const feeds = useCrumbly((s) => s.feeds);
  const peers = useCrumbly((s) => s.peers);
  const updateStarter = useCrumbly((s) => s.updateStarter);
  const [naming, setNaming] = useState(false);
  if (!starter) return null;

  const own = readiness(starter, feeds, now);
  const ownFed = liveFeeds(feeds).pop();
  const clash = peers.some((p) => p.starter?.name.trim().toLowerCase() === starter.name.trim().toLowerCase());
  const generic = starter.name.trim().toLowerCase() === 'jean';
  const shouldName = naming || clash || (generic && peers.length > 0);

  return (
    <Card>
      <Txt v="folio">{peers.length > 0 ? 'Jullie starters' : 'Je starter'}</Txt>

      <Pressable style={st.item} onPress={() => router.navigate('/jean')} accessibilityRole="button" accessibilityLabel={`${starter.name} openen`}>
        <View style={st.flex}>
          <Txt v="h3">{starter.name}</Txt>
          <Txt v="note">Dag {own.ageDays}. {ownFed ? `Laatst gevoed ${fmtDayTime(new Date(ownFed.fedAt), now)}.` : 'Nog niet gevoed.'}{own.ready ? ' Lijkt klaar.' : ''}</Txt>
        </View>
        <Tag label="Van jou" tone="own" />
      </Pressable>

      {peers.map((p) => {
        const pr = p.starter ? readiness(p.starter, p.feeds, now) : null;
        const last = liveFeeds(p.feeds).pop();
        return (
          <Pressable key={p.userId} style={st.item} onPress={() => router.navigate({ pathname: '/jean', params: { view: p.userId } })} accessibilityRole="button" accessibilityLabel={`${peerName(p, starter.name)} bekijken`}>
            <View style={st.flex}>
              <Txt v="h3">{peerName(p, starter.name)}</Txt>
              <Txt v="note">
                {p.starter && pr
                  ? `Dag ${ageDays(p.starter.startedOn, now)}. ${last ? `Laatst gevoed ${fmtDayTime(new Date(last.fedAt), now)}.` : 'Nog niet gevoed.'}${pr.ready ? ' Lijkt klaar.' : ''}`
                  : 'Nog geen gegevens, ze verschijnen na de volgende sync.'}
              </Txt>
            </View>
            <Tag label="Gekoppeld, enkel kijken" tone="peer" />
          </Pressable>
        );
      })}

      {shouldName ? (
        <View style={st.name}>
          <Txt v="note">{clash ? 'Jullie starters heten hetzelfde. Geef de jouwe een eigen naam, bv. Jean Tuur.' : 'Geef je starter een eigen naam zodat je hem kan onderscheiden, bv. Jean Tuur. Je kan dit later nog veranderen.'}</Txt>
          <Field label="Naam van jouw starter" value={starter.name} onChange={(v) => updateStarter({ name: v })} />
          {naming ? <Button small v="green" label="Klaar" onPress={() => setNaming(false)} /> : null}
        </View>
      ) : generic ? (
        <Row style={st.mt}>
          <Button small v="ghost" label="Eigen naam kiezen" onPress={() => setNaming(true)} />
        </Row>
      ) : null}

      {peers.length === 0 ? (
        <>
          <Gap />
          <Txt v="note">Deel je een starter met iemand? Koppel jullie accounts, dan zie je elkaars starter (enkel kijken).</Txt>
          <Row style={st.mt}>
            <Button small v="outline" label="Koppelen" onPress={() => router.push('/koppelen')} />
          </Row>
        </>
      ) : null}
    </Card>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  mt: { marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: space(1), borderTopWidth: 1, borderTopColor: colors.line, marginTop: space(1), gap: space(1) },
  tag: { borderRadius: radius.pill ?? 999, paddingHorizontal: space(1), paddingVertical: 4 },
  tagOwn: { backgroundColor: colors.grn },
  tagOwnText: { color: '#F6F0E6' },
  tagPeer: { backgroundColor: colors.blush },
  tagPeerText: { color: colors.ink },
  name: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: space(1), paddingTop: space(1) },
});
