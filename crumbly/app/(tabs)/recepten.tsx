import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { panBreadRecipe } from '../../src/domain/guide';
import { formatPct, recipeRatios } from '../../src/domain/ratios';
import { liveRecipes, useCrumbly } from '../../src/store/store';
import { Button, Card, Screen, Txt } from '../../src/ui/kit';
import { colors, space } from '../../src/ui/theme';

export default function Recepten() {
  const router = useRouter();
  const recipes = liveRecipes(useCrumbly((s) => s.recipes));
  const saveRecipe = useCrumbly((s) => s.saveRecipe);
  return (
    <Screen folio="Mijn recepten" title="Recepten" sub="Je eigen recepten, op de gram. De verhoudingen rekenen vanzelf mee.">
      {recipes.map((r) => {
        const q = recipeRatios(r);
        return (
          <Pressable key={r.id} onPress={() => router.push(`/recept/${r.id}`)} accessibilityRole="button">
            <Card>
              {r.isExample ? <View style={s.tag}><Txt v="folio" style={s.tagText}>Voorbeeld, pas aan</Txt></View> : null}
              <Txt v="h2">{r.name || 'Naamloos recept'}</Txt>
              {r.source ? <Txt v="note">{r.source}</Txt> : null}
              <Txt style={s.mt}>Hydratatie {formatPct(q.hydration)} · starter {formatPct(q.starterPct)} · zout {formatPct(q.saltPct)}</Txt>
              <Txt v="note">{Math.round(q.doughWeight)} g deeg</Txt>
            </Card>
          </Pressable>
        );
      })}
      <Button label="Recept uit mijn boek omzetten" onPress={() => router.push('/recept/plakken')} />
      <Button v="outline" label="Voorbeeld toevoegen: pannenbrood met nachtrust" onPress={() => { const r = panBreadRecipe(); saveRecipe(r); router.push(`/recept/${r.id}`); }} />
      <Button v="outline" label="Recept zelf invullen" onPress={() => router.push('/recept/nieuw')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  mt: { marginTop: space(1) },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.blush, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 2, marginBottom: space(1) },
  tagText: { color: colors.ink },
});
