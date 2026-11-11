import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { STARTER_DAYS, STARTER_GUIDE_NOTES } from '../domain/guide';
import { Card, Txt } from './kit';
import { colors, space } from './theme';

/** Uitklapbare uitleg: een starter opbouwen, de drijftest en bewaren in de koelkast. */
export function StarterGuide() {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)} style={s.head} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={s.flex}>
          <Txt v="folio">Uitleg</Txt>
          <Txt v="h2">Zelf een starter maken</Txt>
        </View>
        <Txt v="bold" style={s.link}>{open ? 'Sluiten' : 'Openen'}</Txt>
      </Pressable>
      {open ? (
        <View>
          {STARTER_DAYS.map((d) => (
            <View key={d.day} style={s.day}>
              <Txt v="bold" style={s.dayName}>{d.day}</Txt>
              <Txt style={s.flex}>{d.todo}</Txt>
            </View>
          ))}
          {STARTER_GUIDE_NOTES.map((n) => (
            <Txt key={n} v="note" style={s.note}>{n}</Txt>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  link: { color: colors.ter },
  day: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space(1), marginTop: space(1) },
  dayName: { width: 56 },
  note: { marginTop: space(1) },
});
