import { useRouter } from 'expo-router';
import { Button, Screen, Txt } from '../src/ui/kit';
import { Gezin } from '../src/ui/Gezin';
import { Koppelen } from '../src/ui/Koppelen';
import { useCrumbly } from '../src/store/store';

export default function KoppelenScherm() {
  const router = useRouter();
  const peers = useCrumbly((s) => s.peers);
  return (
    <Screen folio="Koppelen" title="Delen" sub="Samen op dezelfde starter (gezin), of de starter van een ander zien." right={<Button small v="ghost" label="Sluiten" onPress={() => router.back()} />}>
      <Gezin />
      <Koppelen />
      {peers.length === 0 ? <Txt v="note">Eén van jullie maakt een code, de ander vult ze in. Daarna staan beide starters in het tabblad Starter.</Txt> : null}
    </Screen>
  );
}
