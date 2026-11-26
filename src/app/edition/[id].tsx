import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { LeadStory, StoryRow } from '@/components/editorial/stories';
import { T } from '@/components/ui/text';
import { japaneseDate, longDate } from '@/domain/dates';
import { useData, usePalette } from '@/state/app';
import { GUTTER } from '@/theme';

export default function EditionPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const { data } = useData(
    async ({ content, user }) => {
      const issue = await user.issue(id);
      if (!issue) return null;
      return { issue, cards: await content.cards(issue.articleIds), states: await user.readingStates() };
    },
    [id],
  );
  if (!data) return <View style={{ flex: 1, backgroundColor: p.bg }} />;
  const { issue, cards, states } = data;
  const lead = cards.find((c) => c.id === issue.leadArticleId) ?? cards[0];
  const rest = cards.filter((c) => c !== lead);
  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: `No. ${issue.editionNumber}` }} />
      <View style={{ paddingHorizontal: GUTTER, paddingBottom: 14 }}>
        <T v="meta" color="muted">
          {longDate(issue.issueDate)} · {japaneseDate(issue.issueDate)}
        </T>
        <T v="display" style={{ marginTop: 4 }}>
          {issue.title}
        </T>
        <T v="meta" color="secondary" style={{ marginTop: 4 }}>
          Edition {issue.editionNumber}
          {issue.isBackIssue ? ', printed while you were away' : ''}
        </T>
      </View>
      {lead ? <LeadStory card={lead} state={states.get(lead.id)} kicker={issue.leadIsLesson ? 'Lesson' : 'Featured'} /> : null}
      <View style={{ height: 1, backgroundColor: p.ruleStrong, marginHorizontal: GUTTER }} />
      {rest.map((c, i) => (
        <StoryRow key={c.id} card={c} state={states.get(c.id)} first={i === 0} />
      ))}
    </ScrollView>
  );
}
