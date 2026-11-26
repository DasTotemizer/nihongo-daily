import Constants from 'expo-constants';
import React from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { Wordmark } from '@/components/editorial/masthead';
import { T } from '@/components/ui/text';
import { useData, usePalette } from '@/state/app';
import { GUTTER } from '@/theme';

function LinkText({ url, children }: { url: string; children: string }) {
  const p = usePalette();
  return (
    <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="link">
      <T v="ui" style={{ color: p.brandInk, marginTop: 6 }}>
        {children}
      </T>
    </Pressable>
  );
}

export default function About() {
  const p = usePalette();
  const { data } = useData(async ({ content }) => content.contentVersion());
  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ padding: GUTTER, paddingBottom: 40 }}>
      <Wordmark size={34} />
      <T v="standfirst" color="secondary" style={{ marginTop: 8 }}>
        Your daily Japanese newspaper.
      </T>
      <T v="meta" color="muted" style={{ marginTop: 8 }}>
        App {Constants.expoConfig?.version ?? '1.0.0'} · Content edition {data ?? ''}
      </T>

      <View style={{ height: 3, backgroundColor: p.ruleStrong, marginTop: 24, marginBottom: 12 }} />
      <T v="heading">Curriculum</T>
      <T v="body" color="secondary" style={{ marginTop: 6 }}>
        Lessons follow the order of topics in Tae Kim's Guide to Japanese Grammar. The guide is released under a Creative Commons Attribution-NonCommercial-ShareAlike 3.0 licence. Every explanation, example sentence, translation and quiz in this app is original writing; none of the guide's text is reproduced.
      </T>
      <LinkText url="https://guidetojapanese.org/learn/grammar">Tae Kim's Guide to Japanese Grammar</LinkText>
      <LinkText url="https://creativecommons.org/licenses/by-nc-sa/3.0/us/">The guide's licence</LinkText>

      <View style={{ height: 3, backgroundColor: p.ruleStrong, marginTop: 24, marginBottom: 12 }} />
      <T v="heading">Type and artwork</T>
      <T v="body" color="secondary" style={{ marginTop: 6 }}>
        Headlines are set in Newsreader and the masthead in Noto Serif JP, both under the SIL Open Font Licence. Article illustrations are original artwork made for 日本語 Daily.
      </T>

      <View style={{ height: 3, backgroundColor: p.ruleStrong, marginTop: 24, marginBottom: 12 }} />
      <T v="heading">Your data</T>
      <T v="body" color="secondary" style={{ marginTop: 6 }}>
        Reading history, bookmarks and quiz results are stored only on this phone. Content updates never touch them.
      </T>
    </ScrollView>
  );
}
