import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ArticleCard } from '@/data/content-repo';
import type { ReadingState } from '@/data/user-repo';
import { usePalette } from '@/state/app';
import { DIFFICULTY, GUTTER, fonts } from '@/theme';

import { Icon } from '../ui/icon';
import { T } from '../ui/text';
import { Cover } from './cover';

export function openArticle(id: string) {
  router.push({ pathname: '/article/[id]', params: { id } });
}

export function CategoryLabel({ card, kicker }: { card: Pick<ArticleCard, 'categoryName' | 'accent'>; kicker?: string }) {
  const p = usePalette();
  // Category accents are tuned for light backgrounds; lighten them a touch in dark mode.
  return (
    <View style={styles.labelRow}>
      {kicker ? (
        <>
          <View style={{ width: 8, height: 8, backgroundColor: p.brand, marginRight: 6 }} />
          <T v="label" style={{ color: p.text, marginRight: 10 }}>
            {kicker}
          </T>
        </>
      ) : null}
      <T v="label" style={{ color: p.scheme === 'dark' ? p.textSecondary : card.accent }}>
        {card.categoryName}
      </T>
    </View>
  );
}

export function StoryMeta({ card, state, showDifficulty = false }: { card: ArticleCard; state?: ReadingState; showDifficulty?: boolean }) {
  const p = usePalette();
  const read = state?.status === 'read';
  const started = state?.status === 'started' && state.progress >= 0.05;
  return (
    <View style={styles.meta}>
      <T v="meta" color="muted">
        {card.readingMinutes} min read{showDifficulty ? ` · ${DIFFICULTY[card.difficulty]}` : ''}
      </T>
      {read ? (
        <View style={styles.status} accessibilityLabel="Read">
          <Icon name="check" size={14} color={p.good} />
          <T v="meta" style={{ color: p.good, marginLeft: 2 }}>
            Read
          </T>
        </View>
      ) : started ? (
        <T v="meta" style={{ color: p.brand, marginLeft: 10 }}>
          {Math.round(state!.progress * 100)}% read
        </T>
      ) : (
        <View style={[styles.dot, { backgroundColor: p.brand }]} accessibilityLabel="Unread" />
      )}
    </View>
  );
}

/** The big story at the top of an edition. */
export function LeadStory({ card, state, kicker }: { card: ArticleCard; state?: ReadingState; kicker?: string }) {
  const p = usePalette();
  return (
    <Pressable onPress={() => openArticle(card.id)} android_ripple={{ color: p.rule }} accessibilityRole="link">
      <Cover imageId={card.imageId} aspect={16 / 10} fallbackText={card.headline} accent={card.accent} />
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 18 }}>
        <CategoryLabel card={card} kicker={kicker} />
        <T v="lead" style={{ marginTop: 6 }}>
          {card.headline}
        </T>
        {card.headlineJa ? (
          <T v="ui" color="secondary" style={{ marginTop: 4, fontSize: 16 }}>
            {card.headlineJa}
          </T>
        ) : null}
        <T v="standfirst" color="secondary" style={{ marginTop: 8, fontSize: 17, lineHeight: 24 }} numberOfLines={3}>
          {card.summary}
        </T>
        <StoryMeta card={card} state={state} showDifficulty />
      </View>
    </Pressable>
  );
}

/** A supporting story: headline left, thumbnail right. */
export function StoryRow({ card, state, first, kicker }: { card: ArticleCard; state?: ReadingState; first?: boolean; kicker?: string }) {
  const p = usePalette();
  const read = state?.status === 'read';
  return (
    <Pressable
      onPress={() => openArticle(card.id)}
      android_ripple={{ color: p.rule }}
      accessibilityRole="link"
      style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.rule }]}>
      <View style={{ flex: 1, paddingRight: 14 }}>
        <CategoryLabel card={card} kicker={kicker} />
        <T v="title" style={{ marginTop: 4, opacity: read ? 0.72 : 1 }} numberOfLines={3}>
          {card.headline}
        </T>
        <T v="meta" color="secondary" style={{ marginTop: 4, fontSize: 14, lineHeight: 19 }} numberOfLines={2}>
          {card.summary}
        </T>
        <StoryMeta card={card} state={state} />
      </View>
      <Cover imageId={card.imageId} aspect={1} style={{ width: 96 }} accent={card.accent} />
    </Pressable>
  );
}

/** Two stories side by side, for lighter sections. */
export function StoryPair({ cards, states }: { cards: ArticleCard[]; states: Map<string, ReadingState> }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: GUTTER, gap: 14 }}>
      {cards.map((c) => (
        <Pressable key={c.id} style={{ flex: 1 }} onPress={() => openArticle(c.id)} android_ripple={{ color: p.rule }} accessibilityRole="link">
          <Cover imageId={c.imageId} aspect={4 / 3} fallbackText={c.headline} accent={c.accent} />
          <View style={{ paddingTop: 8 }}>
            <CategoryLabel card={c} />
            <T v="small" style={{ marginTop: 4 }} numberOfLines={4}>
              {c.headline}
            </T>
            <StoryMeta card={c} state={states.get(c.id)} />
          </View>
        </Pressable>
      ))}
      {cards.length === 1 ? <View style={{ flex: 1 }} /> : null}
    </View>
  );
}

/** Section heading: a heavy rule, an English title and an optional Japanese title. */
export function SectionHeading({ title, ja, action }: { title: string; ja?: string; action?: { label: string; onPress: () => void } }) {
  const p = usePalette();
  return (
    <View style={{ paddingHorizontal: GUTTER, marginTop: 28, marginBottom: 4 }}>
      <View style={{ height: 3, backgroundColor: p.ruleStrong, marginBottom: 10 }} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexShrink: 1 }}>
          <T v="heading" style={{ fontSize: 21 }}>
            {title}
          </T>
          {ja ? (
            <T v="meta" color="muted" style={{ marginLeft: 8, fontSize: 14 }}>
              {ja}
            </T>
          ) : null}
        </View>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
            <T v="meta" style={{ color: p.brand, fontFamily: fonts.sansMedium }}>
              {action.label}
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Rule({ inset = true, strong = false }: { inset?: boolean; strong?: boolean }) {
  const p = usePalette();
  return (
    <View
      style={{
        height: strong ? 1 : StyleSheet.hairlineWidth,
        backgroundColor: strong ? p.ruleStrong : p.rule,
        marginHorizontal: inset ? GUTTER : 0,
      }}
    />
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  status: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, marginLeft: 10 },
  row: { flexDirection: 'row', paddingVertical: 16, marginHorizontal: GUTTER },
});
