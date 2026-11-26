import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SectionHeading, StoryRow } from '@/components/editorial/stories';
import { Icon, type IconName } from '@/components/ui/icon';
import { T } from '@/components/ui/text';
import { weakConcepts } from '@/domain/publisher';
import { useData, usePalette } from '@/state/app';
import { GUTTER } from '@/theme';

const STAGE_NAMES = ['', 'Foundations', 'Basic Grammar', 'Essential Grammar', 'Intermediate', 'Advanced'];

export default function Profile() {
  const p = usePalette();
  const { data } = useData(async ({ content, user }) => {
    const lessons = await content.lessons();
    const read = await user.readIds();
    const weak = weakConcepts(await user.recentAnswers());
    const concepts = await content.concepts();
    const weakNames = weak.map((id) => concepts.find((c) => c.id === id)).filter((c) => !!c);
    const history = await user.history(15);
    const cards = await content.cards(history.map((h) => h.articleId));
    const attempts = (await user.recentAnswers()).length;
    const totalRead = read.size;
    return { lessons, read, weakNames, cards, states: await user.readingStates(), attempts, totalRead };
  });
  if (!data) return <View style={{ flex: 1, backgroundColor: p.bg }} />;
  const stages = [1, 2, 3, 4, 5]
    .map((s) => ({ s, total: data.lessons.filter((l) => l.stage === s).length, done: data.lessons.filter((l) => l.stage === s && data.read.has(l.id)).length }))
    .filter((x) => x.total > 0);

  const Link = ({ icon, label, to }: { icon: IconName; label: string; to: '/settings' | '/about' }) => (
    <Pressable onPress={() => router.push(to)} accessibilityRole="link" android_ripple={{ color: p.rule }} style={[styles.link, { borderTopColor: p.rule }]}>
      <Icon name={icon} color={p.textSecondary} />
      <T v="ui" style={{ flex: 1, marginLeft: 12 }}>
        {label}
      </T>
      <Icon name="chevron-right" color={p.textMuted} />
    </Pressable>
  );

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ paddingHorizontal: GUTTER }}>
        <T v="standfirst" color="secondary" style={{ fontSize: 16, lineHeight: 22 }}>
          {data.totalRead} {data.totalRead === 1 ? 'article' : 'articles'} read · {data.attempts} quiz answers
        </T>
      </View>

      <SectionHeading title="Your course" ja="進み具合" />
      {stages.map(({ s, total, done }) => (
        <View key={s} style={[styles.stage, { borderTopColor: p.rule }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T v="ui">
              Stage {s}: {STAGE_NAMES[s]}
            </T>
            <T v="meta" color="muted">
              {done} of {total} lessons
            </T>
          </View>
          <View style={[styles.track, { backgroundColor: p.rule }]}>
            <View style={{ width: `${(done / total) * 100}%`, height: 4, backgroundColor: p.text }} />
          </View>
        </View>
      ))}

      {data.weakNames.length ? (
        <>
          <SectionHeading title="Worth revisiting" ja="復習" />
          <T v="meta" color="secondary" style={{ paddingHorizontal: GUTTER, marginBottom: 6 }}>
            Topics where recent quiz answers were mixed. The paper will slip in a revision piece for these.
          </T>
          {data.weakNames.map((c) => (
            <Pressable key={c!.id} onPress={() => router.push({ pathname: '/concept/[id]', params: { id: c!.id } })} accessibilityRole="link" style={[styles.link, { borderTopColor: p.rule }]}>
              <T v="ui" style={{ flex: 1 }}>
                {c!.name}
              </T>
              <Icon name="chevron-right" color={p.textMuted} />
            </Pressable>
          ))}
        </>
      ) : null}

      <SectionHeading title="Recently read" ja="履歴" />
      {data.cards.length === 0 ? (
        <T v="meta" color="muted" style={{ paddingHorizontal: GUTTER, paddingTop: 6 }}>
          Articles you open will appear here.
        </T>
      ) : (
        data.cards.slice(0, 8).map((c, i) => <StoryRow key={c.id} card={c} state={data.states.get(c.id)} first={i === 0} />)
      )}

      <View style={{ marginTop: 28 }}>
        <Link icon="tune" label="Settings" to="/settings" />
        <Link icon="info-outline" label="About 日本語 Daily" to="/about" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stage: { marginHorizontal: GUTTER, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  track: { height: 4, marginTop: 8 },
  link: { flexDirection: 'row', alignItems: 'center', marginHorizontal: GUTTER, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
