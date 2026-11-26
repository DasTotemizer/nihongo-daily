import { Platform } from 'react-native';

export interface Palette {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  raised: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  rule: string;
  ruleStrong: string;
  brand: string;
  brandText: string;
  accentSoft: string;
  good: string;
  goodSoft: string;
  bad: string;
  badSoft: string;
  ruby: string;
  overlay: string;
}

export const light: Palette = {
  scheme: 'light',
  bg: '#FFFFFF',
  surface: '#F6F3EE',
  raised: '#FFFFFF',
  text: '#141414',
  textSecondary: '#545250',
  textMuted: '#7A7773',
  rule: '#E4E0D9',
  ruleStrong: '#141414',
  brand: '#B3261E',
  brandText: '#FFFFFF',
  accentSoft: '#F7E7E5',
  good: '#1E7B4F',
  goodSoft: '#E3F1E9',
  bad: '#B3261E',
  badSoft: '#F8E5E3',
  ruby: '#6B6763',
  overlay: 'rgba(0,0,0,0.45)',
};

export const dark: Palette = {
  scheme: 'dark',
  bg: '#0E0E0F',
  surface: '#18181A',
  raised: '#1F1F22',
  text: '#F1EFEA',
  textSecondary: '#B4B0A8',
  textMuted: '#8C8982',
  rule: '#2C2C2F',
  ruleStrong: '#F1EFEA',
  brand: '#E5483B',
  brandText: '#FFFFFF',
  accentSoft: '#3A1D1A',
  good: '#5CC28E',
  goodSoft: '#16291F',
  bad: '#F07167',
  badSoft: '#331A18',
  ruby: '#A8A49C',
  overlay: 'rgba(0,0,0,0.6)',
};

/** Font family names registered in the root layout. */
export const fonts = {
  headline: 'Newsreader-SemiBold',
  headlineBold: 'Newsreader-Bold',
  headlineMedium: 'Newsreader-Medium',
  serif: 'Newsreader-Regular',
  serifItalic: 'Newsreader-Italic',
  masthead: 'MastheadJP',
  /** UI text and Japanese use the system font (Roboto and Noto Sans CJK on Android). */
  sans: Platform.select({ android: 'sans-serif', default: 'System' }) as string,
  sansMedium: Platform.select({ android: 'sans-serif-medium', default: 'System' }) as string,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Page gutter. Content max width keeps lines readable on tablets. */
export const GUTTER = 16;
export const MAX_WIDTH = 720;

export const DIFFICULTY = ['', 'Beginner', 'Beginner', 'Elementary', 'Intermediate', 'Advanced'];
