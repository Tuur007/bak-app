import { useRouter } from 'expo-router';
import { Button, Screen, Txt } from '../src/ui/kit';
import { Koppelen } from '../src/ui/Koppelen';
import { useCrumbly } from '../src/store/store';

export default function KoppelenScherm() {
  const router = useRouter();
  const peers = useCrumbly((s) => s.peers);
  return (
    <Screen folio="Koppelen" title="Starters delen" sub="Zie elkaars starter, enkel kijken." right={<Button small v="ghost" label="Sluiten" onPress={() => router.back()} />}>
      <Koppelen />
      {peers.length === 0 ? <Txt v="note">Eén van jullie maakt een code, de ander vult ze in. Daarna staan beide starters in het tabblad Starter.</Txt> : null}
    </Screen>
  );
}
