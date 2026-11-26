import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { usePalette } from '@/state/app';
import { fonts } from '@/theme';

type Variant =
  | 'display' // edition title on Home
  | 'lead' // lead story headline
  | 'headline' // article page headline
  | 'title' // story row headline
  | 'small' // compact headline
  | 'standfirst' // article summary under headline
  | 'body' // article prose
  | 'ui' // buttons, settings rows
  | 'meta' // reading time, dates
  | 'label' // small caps category / section labels
  | 'heading'; // section heading inside an article

const base: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.headlineBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.4 },
  lead: { fontFamily: fonts.headlineBold, fontSize: 28, lineHeight: 32, letterSpacing: -0.3 },
  headline: { fontFamily: fonts.headlineBold, fontSize: 31, lineHeight: 36, letterSpacing: -0.4 },
  title: { fontFamily: fonts.headline, fontSize: 19, lineHeight: 23 },
  small: { fontFamily: fonts.headline, fontSize: 17, lineHeight: 21 },
  standfirst: { fontFamily: fonts.serif, fontSize: 19, lineHeight: 27 },
  body: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 28 },
  ui: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 22 },
  meta: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '600' },
  heading: { fontFamily: fonts.headlineBold, fontSize: 23, lineHeight: 28 },
};

export interface TProps extends TextProps {
  v?: Variant;
  color?: 'text' | 'secondary' | 'muted' | 'brand' | 'inverse';
  scale?: number;
}

export function T({ v = 'ui', color = 'text', scale = 1, style, ...rest }: TProps) {
  const p = usePalette();
  const c = { text: p.text, secondary: p.textSecondary, muted: p.textMuted, brand: p.brandInk, inverse: p.brandText }[color];
  const b = base[v];
  const scaled = scale === 1 ? b : { ...b, fontSize: (b.fontSize ?? 16) * scale, lineHeight: (b.lineHeight ?? 20) * scale };
  return <Text maxFontSizeMultiplier={1.6} {...rest} style={[scaled, { color: c }, style]} />;
}
