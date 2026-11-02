import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';
import { addDays, dayShort, fmtTime, pad, sameDay } from '../domain/dates';
import { colors, fonts, radius, space } from './theme';
import { Txt } from './kit';

/** Huidige tijd, elke `ms` bijgewerkt. Aftellen rekent altijd vanaf echte tijdstippen. */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// ---------------------------------------------------------------- boog (starter)

export function Arch({ label, title, children }: { label: string; title: string; children?: React.ReactNode }) {
  return (
    <View style={w.arch}>
      <View style={[w.bub, w.b1]} />
      <View style={[w.bub, w.b2]} />
      <View style={[w.bub, w.b3]} />
      <Txt v="folio" style={w.center}>{label}</Txt>
      <Txt v="title" style={[w.center, w.archTitle]}>{title}</Txt>
      {children}
    </View>
  );
}

export function Dots({ filled, total }: { filled: number; total: number }) {
  return (
    <View style={w.dots} accessibilityLabel={`${filled} van ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[w.dot, i < filled && w.dotOn]} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- bel (wekker)

export function Bell({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel="wekker" style={[w.bell, on && w.bellOn]}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={on ? colors.bg : colors.mut} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5z" />
        <Path d="M10 20a2 2 0 0 0 4 0" />
      </Svg>
    </Pressable>
  );
}

export function Gear({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Instellingen" style={w.gear}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.grn} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={3} />
        <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </Svg>
    </Pressable>
  );
}

// ---------------------------------------------------------------- grafiek

/** Uren tot verdubbeling per voeding, met de doellijn. Lager = sterker. */
export function PeakChart({ points, threshold }: { points: { at: string; hours: number }[]; threshold: number }) {
  const W = 300;
  const H = 130;
  const padL = 28;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const max = Math.max(threshold + 2, ...points.map((p) => p.hours));
  const x = (i: number): number => (points.length <= 1 ? padL + (W - padL - padR) / 2 : padL + (i * (W - padL - padR)) / (points.length - 1));
  const y = (h: number): number => padT + (1 - h / max) * (H - padT - padB);
  const poly = points.map((p, i) => `${x(i)},${y(p.hours)}`).join(' ');
  const first = points[0] ? new Date(points[0].at) : null;
  const last = points[points.length - 1] ? new Date(points[points.length - 1].at) : null;
  const lbl = (d: Date | null): string => (d ? `${d.getDate()}/${d.getMonth() + 1}` : '');
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={padL} y1={y(threshold)} x2={W - padR} y2={y(threshold)} stroke={colors.bor} strokeWidth={1.5} strokeDasharray="4 4" />
      <SvgText x={padL} y={y(threshold) - 6} fontSize={10} fill={colors.bor} fontFamily={fonts.bold}>{`doel: binnen ${threshold} u`}</SvgText>
      <SvgText x={2} y={padT + 8} fontSize={10} fill={colors.mut} fontFamily={fonts.body}>{`${Math.round(max)} u`}</SvgText>
      <SvgText x={2} y={H - padB} fontSize={10} fill={colors.mut} fontFamily={fonts.body}>0</SvgText>
      {points.length > 1 ? <Polyline points={poly} fill="none" stroke={colors.grn} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {points.map((p, i) => (
        <Circle key={p.at} cx={x(i)} cy={y(p.hours)} r={4} fill={p.hours <= threshold ? colors.grn : colors.ter} />
      ))}
      <SvgText x={padL} y={H - 4} fontSize={10} fill={colors.mut} fontFamily={fonts.body}>{lbl(first)}</SvgText>
      <SvgText x={W - padR} y={H - 4} fontSize={10} fill={colors.mut} fontFamily={fonts.body} textAnchor="end">{lbl(last)}</SvgText>
    </Svg>
  );
}

// ---------------------------------------------------------------- dag en uur kiezen

export function DayChips({ value, onChange, days = 10, start }: { value: Date; onChange: (d: Date) => void; days?: number; start: Date }) {
  const list = Array.from({ length: days }, (_, i) => addDays(start, i));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={w.dayScroll} contentContainerStyle={w.dayRow}>
      {list.map((d, i) => {
        const on = sameDay(d, value);
        const label = i === 0 && sameDay(d, new Date()) ? 'vandaag' : i === 1 && sameDay(d, addDays(new Date(), 1)) ? 'morgen' : `${dayShort(d.getDay())} ${d.getDate()}`;
        return (
          <Pressable key={d.toISOString()} onPress={() => onChange(new Date(d.getFullYear(), d.getMonth(), d.getDate(), value.getHours(), value.getMinutes()))} style={[w.dayChip, on && w.dayChipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
            <Text style={[w.dayText, on && w.dayTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function TimeStepper({ value, onChange, step = 15 }: { value: Date; onChange: (d: Date) => void; step?: number }) {
  const add = (m: number): void => onChange(new Date(value.getTime() + m * 60_000));
  return (
    <View style={w.stepper}>
      <Pressable onPress={() => add(-60)} style={w.stepBtn} accessibilityLabel="een uur vroeger"><Text style={w.stepBtnText}>-1 u</Text></Pressable>
      <Pressable onPress={() => add(-step)} style={w.stepBtn} accessibilityLabel={`${step} minuten vroeger`}><Text style={w.stepBtnText}>-</Text></Pressable>
      <Text style={w.stepValue}>{fmtTime(value)}</Text>
      <Pressable onPress={() => add(step)} style={w.stepBtn} accessibilityLabel={`${step} minuten later`}><Text style={w.stepBtnText}>+</Text></Pressable>
      <Pressable onPress={() => add(60)} style={w.stepBtn} accessibilityLabel="een uur later"><Text style={w.stepBtnText}>+1 u</Text></Pressable>
    </View>
  );
}

/** "HH:MM" bijstellen met knoppen (voor thuis-momenten). */
export function HhmmStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(':').map(Number);
  const total = (h || 0) * 60 + (m || 0);
  const set = (t: number): void => {
    const c = Math.max(0, Math.min(24 * 60, t));
    onChange(`${pad(Math.floor(c / 60))}:${pad(c % 60)}`);
  };
  return (
    <View style={w.stepperSmall}>
      <Pressable onPress={() => set(total - 30)} style={w.stepBtn} accessibilityLabel="30 minuten vroeger"><Text style={w.stepBtnText}>-</Text></Pressable>
      <Text style={w.stepValueSmall}>{value}</Text>
      <Pressable onPress={() => set(total + 30)} style={w.stepBtn} accessibilityLabel="30 minuten later"><Text style={w.stepBtnText}>+</Text></Pressable>
    </View>
  );
}

const w = StyleSheet.create({
  arch: { backgroundColor: colors.blush, borderTopLeftRadius: 200, borderTopRightRadius: 200, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, paddingTop: 44, paddingBottom: space(2), paddingHorizontal: space(3), marginBottom: 12, overflow: 'hidden' },
  bub: { position: 'absolute', borderRadius: 20, backgroundColor: colors.card, opacity: 0.7 },
  b1: { width: 18, height: 18, left: '14%', top: 34 },
  b2: { width: 10, height: 10, right: '16%', top: 26 },
  b3: { width: 14, height: 14, right: '8%', top: 62 },
  center: { textAlign: 'center' },
  archTitle: { marginVertical: 6 },
  dots: { flexDirection: 'row', gap: space(1), marginVertical: space(1) },
  dot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.card },
  dotOn: { backgroundColor: colors.grn },
  bell: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  bellOn: { backgroundColor: colors.bor, borderColor: colors.bor },
  gear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  dayScroll: { marginHorizontal: -space(2), marginBottom: space(1) },
  dayRow: { paddingHorizontal: space(2), gap: space(1) },
  dayChip: { minHeight: 44, paddingHorizontal: space(2), borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  dayChipOn: { backgroundColor: colors.grn, borderColor: colors.grn },
  dayText: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink },
  dayTextOn: { color: colors.bg },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(1), marginBottom: space(1) },
  stepperSmall: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  stepValue: { flex: 1, textAlign: 'center', fontFamily: fonts.title, fontSize: 30, color: colors.grn },
  stepValueSmall: { width: 56, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
});
