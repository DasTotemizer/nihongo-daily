import { Stack, router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SectionHeading, StoryRow } from '@/components/editorial/stories';
import { Icon } from '@/components/ui/icon';
import { T } from '@/components/ui/text';
import { useData, usePalette } from '@/state/app';
import { GUTTER, fonts } from '@/theme';

const GUIDE_URL = 'https://guidetojapanese.org/learn/grammar';

export default function ConceptPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const { data } = useData(
    async ({ content, user }) => {
      const concept = await content.concept(id);
      if (!concept) return null;
      const prereqs = (await Promise.all(concept.prereqs.map((c) => content.concept(c)))).filter((c) => !!c);
      const articles = await content.articlesForConcept(id);
      const mastery = (await user.mastery()).get(id);
      return { concept, prereqs, articles, states: await user.readingStates(), mastery };
    },
    [id],
  );
  if (!data) return <View style={{ flex: 1, backgroundColor: p.bg }} />;
  const { concept, prereqs, articles, states, mastery } = data;
  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Stack.Screen options={{ title: `Stage ${concept.stage}` }} />
      <View style={{ paddingHorizontal: GUTTER }}>
        <T v="label" color="brand">
          Grammar topic
        </T>
        <T v="headline" style={{ marginTop: 6, fontSize: 28, lineHeight: 33 }}>
          {concept.name}
        </T>
        {concept.nameJa ? (
          <T v="ui" color="secondary" style={{ fontSize: 18, marginTop: 4 }}>
            {concept.nameJa}
          </T>
        ) : null}
        <T v="standfirst" style={{ marginTop: 10 }}>
          {concept.description}
        </T>
        {mastery ? (
          <T v="meta" color="muted" style={{ marginTop: 10 }}>
            Quiz answers on this topic: {mastery.seen}. Recent accuracy {Math.round(mastery.rate * 100)}%.
          </T>
        ) : null}

        <View style={[styles.ref, { borderColor: p.rule }]}>
          <T v="label" color="muted">
            In Tae Kim's guide
          </T>
          <T v="ui" style={{ marginTop: 4 }}>
            {concept.taeKimSection}
          </T>
          <T v="meta" color="secondary">
            {concept.taeKimLesson}
          </T>
          <Pressable onPress={() => Linking.openURL(GUIDE_URL)} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <T v="meta" style={{ color: p.brandInk, fontFamily: fonts.sansMedium }}>
              Open the guide
            </T>
            <Icon name="open-in-new" size={14} color={p.brandInk} />
          </Pressable>
        </View>

        {prereqs.length ? (
          <View style={{ marginTop: 18 }}>
            <T v="label" color="muted">
              Builds on
            </T>
            {prereqs.map((c) => (
              <Pressable key={c!.id} onPress={() => router.push({ pathname: '/concept/[id]', params: { id: c!.id } })} accessibilityRole="link" style={{ paddingVertical: 6 }}>
                <T v="ui" style={{ color: p.brandInk }}>
                  {c!.name}
                </T>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <SectionHeading title="Articles on this topic" ja="記事" />
      {articles.length === 0 ? (
        <T v="body" color="secondary" style={{ paddingHorizontal: GUTTER, paddingTop: 8 }}>
          Articles on this topic are coming in a future edition.
        </T>
      ) : (
        articles.map((a, i) => <StoryRow key={a.id} card={a} state={states.get(a.id)} first={i === 0} kicker={a.role === 'teaches' ? 'Lesson' : undefined} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ref: { borderWidth: StyleSheet.hairlineWidth, padding: 12, marginTop: 18 },
});
