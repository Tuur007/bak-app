import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from './theme';

// ---------------------------------------------------------------- tekst

type TxtVariant = 'title' | 'h2' | 'h3' | 'body' | 'bold' | 'note' | 'folio' | 'label';

export function Txt({ v = 'body', style, children, numberOfLines }: { v?: TxtVariant; style?: StyleProp<TextStyle>; children: React.ReactNode; numberOfLines?: number }) {
  return (
    <Text style={[t[v], style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

const t = StyleSheet.create({
  title: { fontFamily: fonts.title, fontSize: 30, lineHeight: 34, color: colors.grn },
  h2: { fontFamily: fonts.title, fontSize: 22, lineHeight: 28, color: colors.grn },
  h3: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  bold: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 23, color: colors.ink },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.mut },
  folio: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.mut },
  label: { fontFamily: fonts.bold, fontSize: 12, color: colors.mut },
});

// ---------------------------------------------------------------- scherm

export function Screen({ folio, title, sub, right, children }: { folio?: string; title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {(folio || title || right) && (
          <View style={s.head}>
            <View style={s.flex}>
              {folio ? <Txt v="folio">{folio}</Txt> : null}
              {title ? <Txt v="title" style={s.titleGap}>{title}</Txt> : null}
              {sub ? <Txt v="note" style={s.sub}>{sub}</Txt> : null}
            </View>
            {right}
          </View>
        )}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ tone = 'card', style, children }: { tone?: 'card' | 'blush' | 'punch' | 'green'; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[s.card, tone === 'blush' && s.cardBlush, tone === 'punch' && s.cardPunch, tone === 'green' && s.cardGreen, style]}>{children}</View>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.row, style]}>{children}</View>;
}

export function Gap({ h = 1 }: { h?: number }) {
  return <View style={{ height: space(h) }} />;
}

// ---------------------------------------------------------------- knoppen

type BtnVariant = 'primary' | 'green' | 'outline' | 'ghost' | 'danger';

export function Button({ label, onPress, v = 'primary', small, disabled, style }: { label: string; onPress: () => void; v?: BtnVariant; small?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [s.btn, small && s.btnSmall, s[`btn_${v}`], disabled && s.disabled, pressed && s.pressed, style]}
    >
      <Text style={[s.btnText, small && s.btnTextSmall, s[`btnText_${v}`]]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress, style }: { label: string; on?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress} style={[s.chip, on && s.chipOn, style]}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Toggle({ value, onChange, label, note }: { value: boolean; onChange: (v: boolean) => void; label: string; note?: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={s.toggleRow}>
      <View style={s.flex}>
        <Txt v="bold">{label}</Txt>
        {note ? <Txt v="note">{note}</Txt> : null}
      </View>
      <View style={[s.track, value && s.trackOn]}>
        <View style={[s.knob, value && s.knobOn]} />
      </View>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[s.segBtn, o.value === value && s.segOn]} accessibilityRole="button" accessibilityState={{ selected: o.value === value }}>
          <Text style={s.segText}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- invoer

export function Field({ label, value, onChange, numeric, placeholder, multiline, secure, email, style }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean; placeholder?: string; multiline?: boolean; secure?: boolean; email?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.field, style]}>
      <Txt v="label" style={s.fieldLabel}>{label}</Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        accessibilityLabel={label.trim() || placeholder}
        inputMode={numeric ? 'decimal' : 'text'}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={colors.mut}
        multiline={multiline}
        secureTextEntry={secure}
        autoCapitalize={secure || email ? 'none' : 'sentences'}
        autoComplete={secure ? 'password' : email ? 'email' : 'off'}
        style={[s.input, multiline && s.inputMulti]}
      />
    </View>
  );
}

/** "12,5" -> 12.5; leeg of fout -> 0 */
export function num(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export const str = (n: number): string => (Number.isFinite(n) ? String(Math.round(n * 10) / 10).replace('.', ',') : '');

// ---------------------------------------------------------------- stijlen

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space(2), paddingBottom: space(6), width: '100%', maxWidth: 640, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space(2), gap: space(1) },
  titleGap: { marginTop: 4 },
  sub: { marginTop: 4, fontSize: 14 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space(2), marginBottom: 12, borderWidth: 1, borderColor: colors.line },
  cardBlush: { backgroundColor: colors.blush, borderColor: colors.blush },
  cardPunch: { backgroundColor: colors.bor, borderColor: colors.bor },
  cardGreen: { backgroundColor: colors.grn, borderColor: colors.grn },
  btn: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(2), marginBottom: space(1) },
  btnSmall: { minHeight: 44, paddingHorizontal: space(2), marginBottom: 0 },
  btn_primary: { backgroundColor: colors.ter },
  btn_green: { backgroundColor: colors.grn },
  btn_outline: { borderWidth: 1.5, borderColor: colors.ink, backgroundColor: 'transparent' },
  btn_ghost: { backgroundColor: 'transparent' },
  btn_danger: { borderWidth: 1.5, borderColor: colors.bor, backgroundColor: 'transparent' },
  btnText: { fontFamily: fonts.bold, fontSize: 16 },
  btnTextSmall: { fontSize: 14 },
  btnText_primary: { color: colors.white },
  btnText_green: { color: colors.bg },
  btnText_outline: { color: colors.ink },
  btnText_ghost: { color: colors.ter },
  btnText_danger: { color: colors.bor },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  chip: { minHeight: 44, paddingHorizontal: space(2), borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: space(1), marginBottom: space(1) },
  chipOn: { backgroundColor: colors.grn, borderColor: colors.grn },
  chipText: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink },
  chipTextOn: { color: colors.bg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: 56, paddingVertical: space(1) },
  track: { width: 52, height: 32, borderRadius: 16, backgroundColor: colors.line, padding: 4 },
  trackOn: { backgroundColor: colors.grn },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.card },
  knobOn: { transform: [{ translateX: 20 }] },
  seg: { flexDirection: 'row', backgroundColor: colors.line, borderRadius: radius.pill, padding: 4, marginBottom: 12 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.card },
  segText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  field: { marginBottom: space(1) },
  fieldLabel: { marginBottom: 4 },
  input: { minHeight: 48, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.field, backgroundColor: colors.card, paddingHorizontal: space(2), fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  inputMulti: { minHeight: 88, paddingTop: 12, fontFamily: fonts.body, fontSize: 16, textAlignVertical: 'top' },
});
