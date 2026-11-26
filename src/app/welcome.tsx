import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/editorial/masthead';
import { Icon } from '@/components/ui/icon';
import { T } from '@/components/ui/text';
import { useApp, usePalette } from '@/state/app';
import { GUTTER } from '@/theme';

export default function Welcome() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { setSetting } = useApp();

  const start = async (point: 'new' | 'kana') => {
    await setSetting('startingPoint', point);
    await setSetting('onboarded', true);
    router.replace('/');
  };

  const Choice = ({ point, title, body }: { point: 'new' | 'kana'; title: string; body: string }) => (
    <Pressable
      onPress={() => start(point)}
      android_ripple={{ color: p.rule }}
      accessibilityRole="button"
      style={[styles.choice, { borderTopColor: p.rule }]}>
      <View style={{ flex: 1 }}>
        <T v="title">{title}</T>
        <T v="meta" color="secondary" style={{ marginTop: 4, fontSize: 14, lineHeight: 20 }}>
          {body}
        </T>
      </View>
      <Icon name="arrow-forward" color={p.brand} />
    </Pressable>
  );

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32, paddingHorizontal: GUTTER }}>
      <Wordmark size={44} />
      <View style={{ height: 4, backgroundColor: p.brand, marginTop: 12, width: 72 }} />
      <T v="standfirst" style={{ marginTop: 20, fontSize: 22, lineHeight: 30 }}>
        Your daily Japanese newspaper.
      </T>
      <T v="body" color="secondary" style={{ marginTop: 16 }}>
        A new edition arrives every morning, led by your next lesson. Miss a few days and nothing is lost: your place is kept, and earlier editions wait in the Archive.
      </T>
      <T v="body" color="secondary" style={{ marginTop: 12 }}>
        Lessons follow the order of Tae Kim's Guide to Japanese Grammar, with original articles, examples and quizzes.
      </T>

      <T v="label" color="muted" style={{ marginTop: 36, marginBottom: 6 }}>
        Where would you like to start?
      </T>
      <Choice point="new" title="I'm new to Japanese" body="Start with the writing system: hiragana, katakana and kanji." />
      <Choice point="kana" title="I can already read kana" body="Start at basic grammar. The kana lessons stay available whenever you want them." />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth },
});
