import { Redirect, router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Cover } from '@/components/editorial/cover';
import { Masthead } from '@/components/editorial/masthead';
import { LeadStory, SectionHeading, StoryPair, StoryRow, openArticle } from '@/components/editorial/stories';
import { Icon } from '@/components/ui/icon';
import { T } from '@/components/ui/text';
import type { ArticleCard } from '@/data/content-repo';
import { issueDateFor } from '@/domain/dates';
import { currentNextLesson } from '@/domain/edition-service';
import { useData, usePalette, useSettings } from '@/state/app';
import { GUTTER } from '@/theme';

const SECTIONS: { kind: ArticleCard['kind']; title: string; ja: string; layout: 'rows' | 'pair' }[] = [
  { kind: 'core', title: 'More lessons', ja: 'レッスン', layout: 'rows' },
  { kind: 'feature', title: 'Grammar Explained', ja: '文法解説', layout: 'rows' },
  { kind: 'vocab', title: 'Vocabulary of the Day', ja: '今日の言葉', layout: 'rows' },
  { kind: 'everyday', title: 'Everyday Japanese', ja: '日常の日本語', layout: 'rows' },
  { kind: 'japan_today', title: 'Japan Today', ja: '今日の日本', layout: 'pair' },
  { kind: 'revision', title: 'Revision and Recap', ja: '復習', layout: 'rows' },
];

export default function Home() {
  const settings = useSettings();
  const p = usePalette();
  const { data } = useData(async ({ content, user, settings }) => {
    const issue = await user.lastIssue();
    if (!issue) return null;
    const cards = await content.cards(issue.articleIds);
    const states = await user.readingStates();
    const inProgress = (await user.inProgress()).filter((s) => s.articleId !== issue.leadArticleId);
    const continueCard = inProgress[0] ? await content.card(inProgress[0].articleId) : null;
    const next = await currentNextLesson(content, user, settings);
    const leadRead = issue.leadArticleId ? states.get(issue.leadArticleId)?.status === 'read' : false;
    const upNext = next && next.id !== issue.leadArticleId && (leadRead || !issue.leadIsLesson) ? await content.card(next.id) : null;
    const backIssues = (await user.issues()).filter((i) => i.editionNumber < issue.editionNumber).length;
    return { issue, cards, states, continueCard, continueState: inProgress[0], upNext, backIssues };
  });

  if (!settings.onboarded) return <Redirect href="/welcome" />;
  const today = issueDateFor(new Date());

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <Masthead date={today} />
      </View>
    );
  }

  const { issue, cards, states, continueCard, continueState, upNext } = data;
  const lead = cards.find((c) => c.id === issue.leadArticleId) ?? cards[0];
  const rest = cards.filter((c) => c.id !== lead?.id && c.id !== upNext?.id);

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Masthead date={issue.issueDate} editionNumber={issue.editionNumber} />

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: 14 }}>
        <T v="display">{issue.title}</T>
        <T v="standfirst" color="secondary" style={{ fontSize: 16, lineHeight: 22, marginTop: 4 }}>
          {issue.issueDate === today ? 'Your daily Japanese newspaper.' : 'Your latest edition.'}
        </T>
      </View>

      {continueCard && continueState ? (
        <Pressable
          onPress={() => openArticle(continueCard.id)}
          android_ripple={{ color: p.rule }}
          accessibilityRole="link"
          accessibilityLabel={`Continue reading ${continueCard.headline}`}
          style={[styles.continue, { backgroundColor: p.surface }]}>
          <Cover imageId={continueCard.imageId} aspect={1} style={{ width: 52 }} accent={continueCard.accent} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <T v="label" color="brand">
              Continue reading
            </T>
            <T v="small" numberOfLines={1} style={{ marginTop: 2 }}>
              {continueCard.headline}
            </T>
            <View style={[styles.bar, { backgroundColor: p.rule }]}>
              <View style={{ width: `${Math.round(continueState.progress * 100)}%`, height: 3, backgroundColor: p.brand }} />
            </View>
          </View>
          <Icon name="chevron-right" color={p.textMuted} />
        </Pressable>
      ) : null}

      {lead ? <LeadStory card={lead} state={states.get(lead.id)} kicker={issue.leadIsLesson ? "Today's lesson" : 'Featured'} /> : null}

      {upNext ? (
        <>
          <SectionHeading title="Next in your course" ja="次のレッスン" />
          <StoryRow card={upNext} state={states.get(upNext.id)} first kicker="Up next" />
        </>
      ) : null}

      {SECTIONS.map((s) => {
        const items = rest.filter((c) => c.kind === s.kind);
        if (items.length === 0) return null;
        return (
          <View key={s.kind}>
            <SectionHeading title={s.title} ja={s.ja} />
            {s.layout === 'pair' && items.length > 1
              ? chunk(items, 2).map((pair, i) => (
                  <View key={i} style={{ marginTop: i ? 20 : 12 }}>
                    <StoryPair cards={pair} states={states} />
                  </View>
                ))
              : items.map((c, i) => <StoryRow key={c.id} card={c} state={states.get(c.id)} first={i === 0} />)}
          </View>
        );
      })}

      <SectionHeading title="Earlier editions" ja="過去の号" />
      <Pressable onPress={() => router.navigate('/archive')} accessibilityRole="link" style={[styles.archive, { borderColor: p.rule }]}>
        <Icon name="inventory-2" color={p.textSecondary} />
        <T v="ui" color="secondary" style={{ flex: 1, marginLeft: 12 }}>
          {data.backIssues > 0
            ? `${data.backIssues} earlier ${data.backIssues === 1 ? 'edition is' : 'editions are'} kept in the Archive, read or not.`
            : 'Every edition you receive is kept in the Archive.'}
        </T>
        <Icon name="chevron-right" color={p.textMuted} />
      </Pressable>
    </ScrollView>
  );
}

function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

const styles = StyleSheet.create({
  continue: { flexDirection: 'row', alignItems: 'center', marginHorizontal: GUTTER, marginBottom: 16, padding: 10 },
  bar: { height: 3, marginTop: 6 },
  archive: { flexDirection: 'row', alignItems: 'center', marginHorizontal: GUTTER, marginTop: 10, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
