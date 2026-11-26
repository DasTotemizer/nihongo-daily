/**
 * Japanese text rendering. React Native has no ruby support, so each word is
 * laid out as a small column: furigana above, base text below. Lines wrap
 * between words only, never inside one.
 */
import React from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import type { Inline, JaLine, JaToken } from '@/content/types';
import { usePalette, useSettings } from '@/state/app';
import { fonts } from '@/theme';

export interface JaOptions {
  furigana?: boolean;
  romaji?: boolean;
  /** Base font size before the user's text scale. */
  size?: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  center?: boolean;
}

const KANJI = /[㐀-䶿一-鿿々]/;

export function surface(line: JaLine): string {
  return line.map((t) => t.s.map((s) => s.b).join('')).join('');
}

export function romaji(line: JaLine): string {
  let out = '';
  for (const t of line) {
    if (t.p) {
      const b = t.s[0].b;
      if (/[。！？]/.test(b)) out += b === '。' ? '.' : b === '！' ? '!' : '?';
      else if (/[、]/.test(b)) out += ',';
      continue;
    }
    out += (out ? ' ' : '') + (t.rm ?? '');
  }
  return out.replace(/\s+([.,!?])/g, '$1');
}

function Token({ token, furigana, size, rubySize, color, rubyColor, weight }: {
  token: JaToken; furigana: boolean; size: number; rubySize: number; color: string; rubyColor: string; weight?: TextStyle['fontWeight'];
}) {
  const baseStyle = { fontSize: size, lineHeight: size * 1.35, color, fontWeight: weight, fontFamily: fonts.sans };
  if (!furigana || !token.s.some((s) => s.r)) {
    return (
      <View style={furigana ? { paddingTop: rubySize * 1.25 } : undefined}>
        <Text style={baseStyle}>{token.s.map((s) => s.b).join('')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.token}>
      {token.s.map((seg, i) => (
        <View key={i} style={styles.seg}>
          {seg.r ? (
            <Text style={{ fontSize: rubySize, lineHeight: rubySize * 1.25, color: rubyColor, fontFamily: fonts.sans }} numberOfLines={1}>
              {seg.r}
            </Text>
          ) : (
            <View style={{ height: rubySize * 1.25 }} />
          )}
          <Text style={baseStyle}>{seg.b}</Text>
        </View>
      ))}
    </View>
  );
}

/** A full Japanese sentence with optional furigana and romaji. */
export function JaText({ line, ...opts }: { line: JaLine } & JaOptions) {
  const p = usePalette();
  const settings = useSettings();
  const furigana = (opts.furigana ?? settings.furigana) && line.some((t) => t.s.some((s) => s.r));
  const showRomaji = opts.romaji ?? settings.romaji;
  const size = (opts.size ?? 22) * settings.textScale;
  const rubySize = Math.max(10, size * 0.48);
  const color = opts.color ?? p.text;
  return (
    <View accessible accessibilityLabel={surface(line)}>
      <View style={[styles.line, opts.center && { justifyContent: 'center' }]}>
        {line.map((t, i) => (
          <Token key={i} token={t} furigana={furigana} size={size} rubySize={rubySize} color={color} rubyColor={p.ruby} weight={opts.weight} />
        ))}
      </View>
      {showRomaji ? (
        <Text style={{ fontSize: 15 * settings.textScale, lineHeight: 21 * settings.textScale, color: p.textSecondary, fontFamily: fonts.serifItalic, marginTop: 2, textAlign: opts.center ? 'center' : 'left' }}>
          {romaji(line)}
        </Text>
      ) : null}
    </View>
  );
}

/** Japanese inside an English sentence: readings go in brackets after kanji words. */
function inlineJa(tokens: JaLine, furigana: boolean, showRomaji: boolean): { main: string; extra: string } {
  const main = surface(tokens);
  const parts: string[] = [];
  if (furigana && tokens.some((t) => t.s.some((s) => s.r && KANJI.test(s.b)))) {
    parts.push(tokens.map((t) => t.s.map((s) => s.r ?? s.b).join('')).join(''));
  }
  if (showRomaji) parts.push(romaji(tokens));
  return { main, extra: parts.length ? `（${parts.join(', ')}）` : '' };
}

export function InlineText({ text, style, scale = 1 }: { text: Inline; style?: TextStyle | TextStyle[]; scale?: number }) {
  const p = usePalette();
  const settings = useSettings();
  return (
    <Text style={style}>
      {text.map((run, i) => {
        if (run.k === 'text') {
          const st: TextStyle = run.bold ? { fontFamily: fonts.headlineBold } : run.italic ? { fontFamily: fonts.serifItalic } : {};
          return (
            <Text key={i} style={st}>
              {run.t}
            </Text>
          );
        }
        const { main, extra } = inlineJa(run.tokens, settings.furigana, settings.romaji);
        return (
          <Text key={i}>
            <Text style={{ fontFamily: fonts.sans, fontWeight: run.bold ? '700' : undefined, fontSize: 17 * scale * settings.textScale }}>{main}</Text>
            {extra ? <Text style={{ fontFamily: fonts.sans, color: p.ruby, fontSize: 13 * scale * settings.textScale }}>{extra}</Text> : null}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  token: { flexDirection: 'row' },
  seg: { alignItems: 'center' },
});
