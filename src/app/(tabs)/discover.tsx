import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Cover } from '@/components/editorial/cover';
import { PageHeader } from '@/components/editorial/masthead';
import { Icon } from '@/components/ui/icon';
import { T } from '@/components/ui/text';
import { useData, usePalette } from '@/state/app';
import { GUTTER } from '@/theme';

export default function Discover() {
  const p = usePalette();
  const { data } = useData(async ({ content }) => {
    const cats = await content.categories();
    const counts = await content.countsByCategory();
    const firsts = await Promise.all(cats.map(async (c) => (await content.inCategory(c.id))[0] ?? null));
    return cats.map((c, i) => ({ ...c, count: counts.get(c.id) ?? 0, first: firsts[i] }));
  });

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <PageHeader title="Discover" ja="探す" />
      <T v="standfirst" color="secondary" style={{ paddingHorizontal: GUTTER, fontSize: 16, lineHeight: 22, marginBottom: 10 }}>
        Browse every section of the paper.
      </T>
      {data?.map((c, i) => (
        <Pressable
          key={c.id}
          onPress={() => router.push({ pathname: '/category/[id]', params: { id: c.id } })}
          android_ripple={{ color: p.rule }}
          accessibilityRole="link"
          accessibilityLabel={`${c.name}, ${c.count} articles`}
          style={[styles.row, { borderTopColor: i === 0 ? p.ruleStrong : p.rule, borderTopWidth: i === 0 ? 2 : StyleSheet.hairlineWidth }]}>
          <View style={[styles.swatch, { backgroundColor: c.accent }]} />
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <T v="title">{c.name}</T>
              <T v="meta" color="muted" style={{ marginLeft: 8 }}>
                {c.nameJa}
              </T>
            </View>
            <T v="meta" color="secondary" style={{ marginTop: 2, fontSize: 14 }} numberOfLines={2}>
              {c.count > 0 ? c.description : 'New articles in this section are on their way.'}
            </T>
            <T v="meta" color="muted" style={{ marginTop: 4 }}>
              {c.count} {c.count === 1 ? 'article' : 'articles'}
            </T>
          </View>
          {c.first?.imageId ? <Cover imageId={c.first.imageId} aspect={1} style={{ width: 64, marginRight: 8 }} /> : null}
          <Icon name="chevron-right" color={p.textMuted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginHorizontal: GUTTER, paddingVertical: 14 },
  swatch: { width: 4, alignSelf: 'stretch', marginRight: 12 },
});
