import React from 'react';
import { ScrollView, View } from 'react-native';

import { PageHeader } from '@/components/editorial/masthead';
import { StoryRow } from '@/components/editorial/stories';
import { Icon } from '@/components/ui/icon';
import { T } from '@/components/ui/text';
import { useData, usePalette } from '@/state/app';
import { GUTTER } from '@/theme';

export default function Saved() {
  const p = usePalette();
  const { data } = useData(async ({ content, user }) => {
    const saved = await user.savedArticles();
    return { cards: await content.cards(saved.map((s) => s.articleId)), states: await user.readingStates() };
  });
  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <PageHeader title="Saved" ja="保存済み" />
      {data && data.cards.length === 0 ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 24, alignItems: 'flex-start' }}>
          <Icon name="bookmark-border" size={32} color={p.textMuted} />
          <T v="title" style={{ marginTop: 10 }}>
            Nothing saved yet
          </T>
          <T v="body" color="secondary" style={{ marginTop: 6, fontSize: 16, lineHeight: 23 }}>
            Tap the bookmark at the top of any article to keep it here. Saved articles stay until you remove them.
          </T>
        </View>
      ) : (
        <>
          <T v="meta" color="muted" style={{ paddingHorizontal: GUTTER, marginBottom: 4 }}>
            {data?.cards.length ?? 0} saved, newest first
          </T>
          <View style={{ height: 2, backgroundColor: p.ruleStrong, marginHorizontal: GUTTER }} />
          {data?.cards.map((c, i) => <StoryRow key={c.id} card={c} state={data.states.get(c.id)} first={i === 0} />)}
        </>
      )}
    </ScrollView>
  );
}
