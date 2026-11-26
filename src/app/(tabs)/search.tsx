import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PageHeader } from '@/components/editorial/masthead';
import { SectionHeading, StoryRow } from '@/components/editorial/stories';
import { Chip } from '@/components/ui/chip';
import { Icon, IconButton } from '@/components/ui/icon';
import { T } from '@/components/ui/text';
import type { ArticleCard, ConceptRow } from '@/data/content-repo';
import type { ReadingState } from '@/data/user-repo';
import { useApp, usePalette } from '@/state/app';
import { GUTTER, fonts } from '@/theme';

const SUGGESTIONS = ['particles', 'は', 'adjectives', 'katakana', 'greetings', 'food'];

interface Results {
  q: string;
  articles: ArticleCard[];
  concepts: ConceptRow[];
  words: { id: string; written: string; reading: string; romaji: string; meaning: string }[];
  states: Map<string, ReadingState>;
}

export default function Search() {
  const p = usePalette();
  const { content, user, rev } = useApp();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults(null);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const hits = await content.search(query);
      const [articles, concepts, words, states] = await Promise.all([
        content.cards(hits.map((h) => h.id)),
        content.searchConcepts(query.toLowerCase()),
        content.searchVocab(query.toLowerCase()),
        user.readingStates(),
      ]);
      if (live) setResults({ q: query, articles, concepts, words, states });
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, content, user, rev]);

  const empty = results && !results.articles.length && !results.concepts.length && !results.words.length;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <PageHeader title="Search" ja="検索" />
      <View style={[styles.box, { borderColor: p.ruleStrong }]}>
        <Icon name="search" color={p.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Articles, grammar, Japanese or English"
          placeholderTextColor={p.textMuted}
          style={[styles.input, { color: p.text }]}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {q ? <IconButton name="close" label="Clear search" onPress={() => setQ('')} size={20} /> : null}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        {!results ? (
          <View style={{ paddingHorizontal: GUTTER, paddingTop: 12 }}>
            <T v="label" color="muted">
              Try
            </T>
            <View style={styles.suggest}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} active={false} onPress={() => setQ(s)} />
              ))}
            </View>
            <T v="meta" color="muted" style={{ marginTop: 16 }}>
              Search covers every article in the paper, including old editions and lessons you have already read.
            </T>
          </View>
        ) : null}

        {empty ? (
          <T v="body" color="secondary" style={{ paddingHorizontal: GUTTER, paddingTop: 16 }}>
            Nothing matches “{results.q}”. Try an English word, a grammar term, or Japanese in kana.
          </T>
        ) : null}

        {results?.concepts.length ? (
          <>
            <SectionHeading title="Grammar" ja="文法" />
            {results.concepts.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: '/concept/[id]', params: { id: c.id } })}
                accessibilityRole="link"
                style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.rule }]}>
                <View style={{ flex: 1 }}>
                  <T v="small">{c.name}</T>
                  <T v="meta" color="muted">
                    Stage {c.stage} · {c.description}
                  </T>
                </View>
                <Icon name="chevron-right" color={p.textMuted} />
              </Pressable>
            ))}
          </>
        ) : null}

        {results?.articles.length ? (
          <>
            <SectionHeading title="Articles" ja="記事" />
            {results.articles.map((c, i) => (
              <StoryRow key={c.id} card={c} state={results.states.get(c.id)} first={i === 0} />
            ))}
          </>
        ) : null}

        {results?.words.length ? (
          <>
            <SectionHeading title="Words" ja="言葉" />
            {results.words.map((w, i) => (
              <View key={w.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.rule }]}>
                <View style={{ width: 120 }}>
                  <T v="ui" style={{ fontSize: 20 }}>
                    {w.written}
                  </T>
                  {w.reading !== w.written ? (
                    <T v="meta" color="muted">
                      {w.reading}
                    </T>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <T v="ui">{w.meaning}</T>
                  <T v="meta" color="muted" style={{ fontFamily: fonts.serifItalic }}>
                    {w.romaji}
                  </T>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', marginHorizontal: GUTTER, marginTop: 8, marginBottom: 4, borderBottomWidth: 2, paddingLeft: 2 },
  input: { flex: 1, fontSize: 18, paddingVertical: 10, paddingHorizontal: 8, fontFamily: fonts.sans },
  suggest: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginHorizontal: GUTTER, paddingVertical: 12 },
});
