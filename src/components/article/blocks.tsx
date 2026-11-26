import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Block, Inline, JaLine } from '@/content/types';
import { IMAGES } from '@/generated/images';
import { usePalette, useSettings } from '@/state/app';
import { GUTTER, fonts } from '@/theme';

import { Icon } from '../ui/icon';
import { T } from '../ui/text';
import { InlineText, JaText } from './japanese';

/** English translation that respects the "show translations" setting, with tap-to-reveal. */
export function Translation({ en, style }: { en: string; style?: object }) {
  const settings = useSettings();
  const p = usePalette();
  const [shown, setShown] = useState(false);
  if (settings.translations || shown) {
    return (
      <T v="body" color="secondary" scale={settings.textScale} style={[{ fontSize: 16, lineHeight: 23, marginTop: 6 }, style]}>
        {en}
      </T>
    );
  }
  return (
    <Pressable onPress={() => setShown(true)} hitSlop={8} accessibilityRole="button" style={{ marginTop: 6, alignSelf: 'flex-start' }}>
      <T v="meta" style={{ color: p.brand }}>
        Show translation
      </T>
    </Pressable>
  );
}

function Example({ ja, en, note }: { ja: JaLine; en: string; note?: Inline }) {
  const p = usePalette();
  const s = useSettings();
  return (
    <View style={[styles.example, { borderLeftColor: p.brand, backgroundColor: p.surface }]}>
      <JaText line={ja} size={22} />
      <Translation en={en} />
      {note ? (
        <InlineText text={note} style={{ fontFamily: fonts.serif, fontSize: 15 * s.textScale, lineHeight: 22 * s.textScale, color: p.textMuted, marginTop: 8 }} />
      ) : null}
    </View>
  );
}

export function BlockView({ block }: { block: Block }) {
  const p = usePalette();
  const s = useSettings();
  const body = { fontFamily: fonts.serif, fontSize: 18 * s.textScale, lineHeight: 28 * s.textScale, color: p.text };

  switch (block.type) {
    case 'heading':
      return (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 30, marginBottom: 2 }}>
          <InlineText text={block.text} style={{ fontFamily: fonts.headlineBold, fontSize: 23 * s.textScale, lineHeight: 29 * s.textScale, color: p.text }} scale={1.25} />
        </View>
      );
    case 'paragraph':
      return (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 14 }}>
          <InlineText text={block.text} style={body} />
        </View>
      );
    case 'list':
      return (
        <View style={{ paddingHorizontal: GUTTER, marginTop: 12 }}>
          {block.items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', marginTop: 6 }}>
              {block.ordered ? (
                <T v="body" style={{ width: 26, fontFamily: fonts.headlineBold }} scale={s.textScale}>
                  {i + 1}.
                </T>
              ) : (
                <View style={{ width: 6, height: 6, backgroundColor: p.brand, marginTop: 11 * s.textScale, marginRight: 14 }} />
              )}
              <InlineText text={item} style={[body, { flex: 1 }]} />
            </View>
          ))}
        </View>
      );
    case 'example':
      return (
        <View style={{ marginHorizontal: GUTTER, marginTop: 18 }}>
          <Example ja={block.ja} en={block.en} note={block.note} />
        </View>
      );
    case 'breakdown':
      return (
        <View style={{ marginHorizontal: GUTTER, marginTop: 18, borderColor: p.rule, borderWidth: StyleSheet.hairlineWidth }}>
          <View style={{ padding: 14, backgroundColor: p.surface }}>
            <T v="label" color="muted" style={{ marginBottom: 8 }}>
              Sentence breakdown
            </T>
            <JaText line={block.ja} size={24} />
            <Translation en={block.en} />
          </View>
          {block.parts.map((part, i) => (
            <View key={i} style={[styles.part, { borderTopColor: p.rule }]}>
              <View style={{ minWidth: 92, paddingRight: 12 }}>
                <JaText line={part.ja} size={19} />
              </View>
              <InlineText text={part.gloss} style={{ flex: 1, fontFamily: fonts.serif, fontSize: 16 * s.textScale, lineHeight: 23 * s.textScale, color: p.textSecondary }} />
            </View>
          ))}
        </View>
      );
    case 'vocab':
      return (
        <View style={{ marginHorizontal: GUTTER, marginTop: 18 }}>
          <View style={{ height: 2, backgroundColor: p.ruleStrong }} />
          {block.items.map((it, i) => (
            <View key={i} style={[styles.vocab, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.rule }]}>
              <View style={{ minWidth: 110, paddingRight: 12 }}>
                <JaText line={it.ja} size={21} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="ui" scale={s.textScale}>
                  {it.meaning}
                </T>
                {it.pos ? (
                  <T v="meta" color="muted" style={{ fontStyle: 'italic' }}>
                    {it.pos}
                  </T>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      );
    case 'dialogue':
      return (
        <View style={{ marginHorizontal: GUTTER, marginTop: 18, backgroundColor: p.surface, padding: 14 }}>
          <T v="label" color="muted" style={{ marginBottom: 4 }}>
            Conversation
          </T>
          {block.lines.map((l, i) => (
            <View key={i} style={{ flexDirection: 'row', marginTop: 12 }}>
              <T v="meta" style={{ width: 58, fontFamily: fonts.sansMedium, color: i % 2 ? p.brand : p.text, paddingTop: s.furigana ? 14 : 4 }}>
                {l.speaker}
              </T>
              <View style={{ flex: 1 }}>
                <JaText line={l.ja} size={20} />
                <Translation en={l.en} style={{ marginTop: 2, fontSize: 15 }} />
              </View>
            </View>
          ))}
        </View>
      );
    case 'mistake':
      return (
        <View style={{ marginHorizontal: GUTTER, marginTop: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: p.rule }}>
          <View style={[styles.mistakeRow, { backgroundColor: p.badSoft }]}>
            <Icon name="close" size={20} color={p.bad} />
            <View style={{ flex: 1, marginLeft: 8, opacity: 0.85 }}>
              <JaText line={block.wrong} size={20} />
            </View>
          </View>
          <View style={[styles.mistakeRow, { backgroundColor: p.goodSoft }]}>
            <Icon name="check" size={20} color={p.good} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <JaText line={block.right} size={20} />
            </View>
          </View>
          <View style={{ padding: 12 }}>
            <InlineText text={block.explain} style={{ fontFamily: fonts.serif, fontSize: 16 * s.textScale, lineHeight: 23 * s.textScale, color: p.textSecondary }} />
          </View>
        </View>
      );
    case 'callout':
      return (
        <View style={{ marginHorizontal: GUTTER, marginTop: 18, borderTopWidth: 3, borderTopColor: p.brand, paddingTop: 10 }}>
          {block.title ? (
            <T v="label" color="brand" style={{ marginBottom: 4 }}>
              {block.title}
            </T>
          ) : null}
          <InlineText text={block.text} style={{ fontFamily: fonts.serif, fontSize: 16 * s.textScale, lineHeight: 24 * s.textScale, color: p.text }} />
        </View>
      );
    case 'quote':
      return (
        <View style={{ marginHorizontal: GUTTER, marginTop: 22, alignItems: 'center', paddingVertical: 8 }}>
          <JaText line={block.ja} size={26} center />
          <Translation en={block.en} style={{ textAlign: 'center', fontFamily: fonts.serifItalic }} />
          {block.source ? (
            <T v="meta" color="muted" style={{ marginTop: 6 }}>
              {block.source}
            </T>
          ) : null}
        </View>
      );
    case 'image': {
      const src = IMAGES[block.image];
      if (!src) return null;
      return (
        <View style={{ marginTop: 20 }}>
          <Image source={src} style={{ width: '100%', aspectRatio: 16 / 10 }} contentFit="cover" />
          {block.caption ? (
            <T v="meta" color="muted" style={{ paddingHorizontal: GUTTER, marginTop: 6 }}>
              {block.caption}
            </T>
          ) : null}
        </View>
      );
    }
    case 'kana':
      return (
        <View style={{ marginHorizontal: GUTTER, marginTop: 18 }}>
          {block.title ? (
            <T v="label" color="muted" style={{ marginBottom: 6 }}>
              {block.title}
            </T>
          ) : null}
          <View style={{ borderTopWidth: 2, borderTopColor: p.ruleStrong }}>
            {block.rows.map((row, r) => (
              <View key={r} style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.rule }}>
                {row.map((cell, c) => (
                  <View key={c} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }} accessible={!!cell} accessibilityLabel={cell ? `${cell.k}, ${cell.r}` : undefined}>
                    {cell ? (
                      <>
                        <T v="ui" style={{ fontSize: 26 * s.textScale, lineHeight: 34 * s.textScale }}>
                          {cell.k}
                        </T>
                        <T v="meta" color="muted" style={{ fontFamily: fonts.serifItalic }}>
                          {cell.r}
                        </T>
                      </>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    case 'quiz':
      return null; // rendered by the article screen, which owns quiz state
  }
}

const styles = StyleSheet.create({
  example: { borderLeftWidth: 3, paddingVertical: 12, paddingHorizontal: 14 },
  part: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  vocab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  mistakeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
});
