import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { usePalette } from '@/state/app';
import { fonts } from '@/theme';

import { T } from './text';

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, { borderColor: active ? p.text : p.rule, backgroundColor: active ? p.text : 'transparent' }]}>
      <T v="meta" style={{ color: active ? p.bg : p.text, fontFamily: fonts.sansMedium }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
});
