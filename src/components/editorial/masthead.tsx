import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { japaneseDate, longDate } from '@/domain/dates';
import { usePalette } from '@/state/app';
import { GUTTER, fonts } from '@/theme';

import { IconButton } from '../ui/icon';
import { T } from '../ui/text';

/** The wordmark: 日本語 in a Japanese serif, Daily in the headline serif. */
export function Wordmark({ size = 30 }: { size?: number }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} accessible accessibilityRole="header" accessibilityLabel="Nihongo Daily">
      <Text style={{ fontFamily: fonts.masthead, fontSize: size, lineHeight: size * 1.25, color: p.text }}>日本語</Text>
      <Text style={{ fontFamily: fonts.headlineBold, fontSize: size * 1.02, lineHeight: size * 1.25, color: p.brand, marginLeft: 6 }}>Daily</Text>
    </View>
  );
}

function MenuButton() {
  return <IconButton name="account-circle" label="Profile and settings" onPress={() => router.push('/profile')} />;
}

/** Full masthead for the Home page. */
export function Masthead({ date, editionNumber }: { date: string; editionNumber?: number }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 6, backgroundColor: p.bg }}>
      <View style={[styles.top, { paddingHorizontal: GUTTER }]}>
        <Wordmark />
        <MenuButton />
      </View>
      <View style={{ height: 3, backgroundColor: p.brand, marginTop: 6 }} />
      <View style={[styles.dateline, { borderBottomColor: p.rule, paddingHorizontal: GUTTER }]}>
        <T v="meta" color="secondary" style={{ flexShrink: 1 }} numberOfLines={1}>
          {longDate(date)}
        </T>
        <T v="meta" color="secondary">
          {editionNumber ? `No. ${editionNumber}` : ''}
          {'  '}
          {japaneseDate(date)}
        </T>
      </View>
    </View>
  );
}

/** Slimmer header for the other tabs. */
export function PageHeader({ title, ja, right }: { title: string; ja?: string; right?: React.ReactNode }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 6, backgroundColor: p.bg }}>
      <View style={[styles.top, { paddingHorizontal: GUTTER }]}>
        <Wordmark size={20} />
        <View style={{ flexDirection: 'row' }}>
          {right}
          <MenuButton />
        </View>
      </View>
      <View style={{ height: 3, backgroundColor: p.brand, marginTop: 4 }} />
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 6, flexDirection: 'row', alignItems: 'baseline' }}>
        <T v="display">{title}</T>
        {ja ? (
          <T v="meta" color="muted" style={{ marginLeft: 10, fontSize: 15 }}>
            {ja}
          </T>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateline: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
});
