import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { fmtDuration } from '../../src/domain/dates';
import { newId } from '../../src/domain/ids';
import { formatPct, recipeRatios } from '../../src/domain/ratios';
import { parseRecipeText } from '../../src/domain/recipeText';
import { setRecipeDraft } from '../../src/domain/recipeDraft';
import { totalMinutes } from '../../src/domain/schedule';
import { Button, Card, Field, Gap, Screen, Txt } from '../../src/ui/kit';
import { colors, space } from '../../src/ui/theme';

/** Een recept plakken (of scannen) en er een bakschema van laten maken. */
export default function ReceptPlakken() {
  const router = useRouter();
  const [text, setText] = useState('');
  const parsed = useMemo(() => (text.trim().length > 20 ? parseRecipeText(text) : null), [text]);

  // Niet bewaren: eerst nakijken en verbeteren in de editor. Pas daar bewaar je het recept.
  const review = (): void => {
    if (!parsed) return;
    setRecipeDraft({
      recipe: {
        id: newId(),
        name: parsed.name || 'Recept uit mijn boek',
        source: 'Uit tekst gemaakt',
        flours: parsed.flours.length > 0 ? parsed.flours : [{ id: newId(), name: 'Bloem', grams: 0 }],
        waterG: parsed.waterG,
        starterG: parsed.starterG,
        starterHydration: parsed.starterHydration,
        saltG: parsed.saltG,
        process: parsed.process,
        updatedAt: new Date().toISOString(),
      },
      warnings: parsed.warnings,
      ignored: parsed.ignored,
    });
    router.push('/recept/nieuw');
  };

  const q = parsed ? recipeRatios({ flours: parsed.flours, waterG: parsed.waterG, starterG: parsed.starterG, starterHydration: parsed.starterHydration, saltG: parsed.saltG }) : null;

  return (
    <Screen folio="Recept" title="Recept uit je boek" sub="Plak de tekst, Crumbly maakt er een bakschema van. Jij kijkt het na." right={<Button small v="ghost" label="Sluiten" onPress={() => router.back()} />}>
      <Card tone="blush">
        <Txt v="bold">Foto van de bladzijde?</Txt>
        <Txt style={st.mt}>Tik in het vak hieronder en kies "Tekst scannen" (het cameraicoon), of houd je vinger in het vak. Richt je iPhone op de bladzijde en tik op "Voeg in". Lukt dat niet: kopieer de tekst uit een foto in de Foto's-app (houd je vinger op de tekst), en plak ze hier.</Txt>
      </Card>
      <Field label="Het recept (ingrediënten en bereiding)" value={text} onChange={setText} multiline placeholder={'Klassieke bâtard\n\nIngrediënten\n500 g bloem\n350 g water\n100 g starter\n10 g zout\n\nBereiding\n1. Meng ... en laat 30 minuten rusten.'} />

      {parsed && q ? (
        <>
          <Card>
            <Txt v="folio">Dit heb ik gevonden</Txt>
            <Txt v="h2" style={st.mt}>{parsed.name || 'Recept zonder naam'}</Txt>
            <Txt style={st.mt}>Meel {parsed.flours.map((f) => `${f.name.toLowerCase()} ${f.grams} g`).join(', ') || 'niet gevonden'}</Txt>
            <Txt>Water {parsed.waterG || '?'} g · starter {parsed.starterG || '?'} g · zout {parsed.saltG || '?'} g</Txt>
            {q.totalFlour > 0 && parsed.waterG > 0 ? <Txt v="note" style={st.mt}>Hydratatie {formatPct(q.hydration)} · starter {formatPct(q.starterPct)} · zout {formatPct(q.saltPct)}</Txt> : null}
            {parsed.ignored.length > 0 ? <Txt v="note">Niet herkend: {parsed.ignored.join('; ')}</Txt> : null}
          </Card>

          <Card>
            <Txt v="folio">Het bakschema ({fmtDuration(totalMinutes(parsed.process))} in totaal)</Txt>
            {parsed.process.map((s) => (
              <View key={s.id} style={st.step}>
                <Txt v="bold" style={st.min}>{fmtDuration(s.minutes)}</Txt>
                <View style={st.flex}>
                  <Txt>{s.name}</Txt>
                  <Txt v="note">{s.kind === 'wacht' ? 'wachten' : 'handwerk'}{s.tempSensitive ? ', gevoelig voor temperatuur' : ''}</Txt>
                  {s.check ? <Txt v="note" style={st.check}>Nakijken: {s.check}</Txt> : null}
                </View>
              </View>
            ))}
          </Card>

          <Card tone="blush">
            <Txt v="folio">Kijk dit na</Txt>
            {parsed.warnings.map((w) => <Txt key={w} style={st.mt}>{w}</Txt>)}
          </Card>

          <Button label="Nakijken en verbeteren" onPress={review} />
          <Txt v="note" style={st.center}>Er wordt nog niets bewaard. In het volgende scherm pas je ingrediënten, tijden, volgorde en wekkers aan, en bewaar je het recept zelf.</Txt>
        </>
      ) : (
        <Txt v="note">Plak eerst de tekst van je recept (minstens een paar regels).</Txt>
      )}
      <Gap />
    </Screen>
  );
}

const st = StyleSheet.create({
  mt: { marginTop: 4 },
  flex: { flex: 1 },
  step: { flexDirection: 'row', gap: space(2), paddingVertical: space(1), borderTopWidth: 1, borderTopColor: colors.line, marginTop: space(1) },
  min: { width: 72 },
  center: { textAlign: 'center' },
  check: { color: colors.bor },
});
