import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { usePalette } from '@/state/app';

export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: string }) {
  const p = usePalette();
  return <MaterialIcons name={name} size={size} color={color ?? p.text} />;
}

export function IconButton({
  name,
  onPress,
  label,
  color,
  size = 24,
  style,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  style?: ViewStyle;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      android_ripple={{ color: p.rule, borderless: true, radius: 22 }}
      style={[styles.btn, style]}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
