import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { LeadStory, SectionHeading, StoryRow } from '@/components/editorial/stories';
import { T } from '@/components/ui/text';
import { useData, usePalette } from '@/state/app';
import { GUTTER } from '@/theme';

export default function CategoryPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const { data } = useData(
    async ({ content, user }) => ({
      category: await content.category(id),
      cards: await content.inCategory(id),
      states: await user.readingStates(),
    }),
    [id],
  );
  if (!data?.category) return <View style={{ flex: 1, backgroundColor: p.bg }} />;
  const { category, cards, states } = data;
  const stages = Array.from(new Set(cards.slice(1).map((c) => c.stage)));

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: category.name }} />
      <View style={{ paddingHorizontal: GUTTER, paddingBottom: 14 }}>
        <View style={{ height: 4, width: 40, backgroundColor: category.accent, marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <T v="display">{category.name}</T>
          <T v="meta" color="muted" style={{ marginLeft: 10, fontSize: 15 }}>
            {category.nameJa}
          </T>
        </View>
        <T v="standfirst" color="secondary" style={{ fontSize: 16, lineHeight: 22, marginTop: 4 }}>
          {category.description}
        </T>
      </View>
      {cards.length === 0 ? (
        <T v="body" color="secondary" style={{ paddingHorizontal: GUTTER }}>
          Nothing has been published in this section yet. New articles arrive with future content updates.
        </T>
      ) : (
        <>
          <LeadStory card={cards[0]} state={states.get(cards[0].id)} />
          {stages.map((stage) => {
            const items = cards.slice(1).filter((c) => c.stage === stage);
            return (
              <View key={stage}>
                {stages.length > 1 ? <SectionHeading title={`Stage ${stage}`} /> : <View style={{ height: 1, backgroundColor: p.ruleStrong, marginHorizontal: GUTTER }} />}
                {items.map((c, i) => (
                  <StoryRow key={c.id} card={c} state={states.get(c.id)} first={i === 0} />
                ))}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}
