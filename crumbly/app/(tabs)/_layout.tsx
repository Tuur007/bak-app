import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCrumbly } from '../../src/store/store';
import { colors, fonts } from '../../src/ui/theme';

const LABELS: Record<string, string> = { index: 'Vandaag', jean: 'Starter', recepten: 'Recepten', plan: 'Plan', broden: 'Broden' };

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const starterName = useCrumbly((s) => s.starter?.name);
  return (
    <View style={[t.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((r, i) => {
        const on = state.index === i;
        const label = r.name === 'jean' && starterName ? starterName : LABELS[r.name] ?? r.name;
        return (
          <Pressable
            key={r.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              const ev = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
              if (!on && !ev.defaultPrevented) navigation.navigate(r.name);
            }}
            style={t.tab}
          >
            <View style={[t.mark, on && t.markOn]} />
            <Text style={[t.label, on && t.labelOn]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="jean" />
      <Tabs.Screen name="recepten" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="broden" />
    </Tabs>
  );
}

const t = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6 },
  tab: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 24, height: 4, borderRadius: 2, marginBottom: 6, backgroundColor: 'transparent' },
  markOn: { backgroundColor: colors.bor },
  label: { fontFamily: fonts.bold, fontSize: 12, color: colors.mut },
  labelOn: { color: colors.ter },
});
