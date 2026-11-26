import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlockView } from '@/components/article/blocks';
import { Quiz, type QuizAnswer } from '@/components/article/quiz';
import { Cover } from '@/components/editorial/cover';
import { CategoryLabel, SectionHeading, StoryRow } from '@/components/editorial/stories';
import { Icon, IconButton } from '@/components/ui/icon';
import { T } from '@/components/ui/text';
import type { ArticleCard, ArticleFull } from '@/data/content-repo';
import type { ReadingState } from '@/data/user-repo';
import { currentNextLesson } from '@/domain/edition-service';
import { useApp, usePalette } from '@/state/app';
import { DIFFICULTY, GUTTER, fonts } from '@/theme';

interface Loaded {
  article: ArticleFull;
  state: ReadingState | null;
  saved: boolean;
  related: ArticleCard[];
  next: ArticleCard | null;
  best: { score: number; total: number; attempts: number } | null;
  states: Map<string, ReadingState>;
}

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const { content, user, settings, bump } = app;
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aidsOpen, setAidsOpen] = useState(false);
  const [resumeOffer, setResumeOffer] = useState<{ block: number; progress: number } | null>(null);
  const [finished, setFinished] = useState(false);

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const blockY = useRef<number[]>([]);
  const progress = useRef({ value: 0, anchor: 0, lastSave: 0 });
  const startedAt = useRef(new Date().toISOString());

  const load = useCallback(async () => {
    const article = await content.article(id);
    if (!article) {
      setMissing(true);
      return;
    }
    const state = await user.readingState(id);
    const isSaved = await user.isSaved(id);
    // Related: explicit links first, then other articles on the same concepts.
    const relatedIds = [...article.related];
    for (const c of article.concepts.filter((c) => c.role !== 'mentions').slice(0, 2)) {
      for (const a of await content.articlesForConcept(c.id)) {
        if (a.id !== id && !relatedIds.includes(a.id)) relatedIds.push(a.id);
      }
    }
    const related = await content.cards(relatedIds.slice(0, 4));
    const nextInfo = article.kind === 'core' ? await currentNextLesson(content, user, settings) : null;
    const next = nextInfo && nextInfo.id !== id ? await content.card(nextInfo.id) : null;
    const best = await user.bestAttempt(id);
    const states = await user.readingStates();
    setData({ article, state, saved: isSaved, related, next, best, states });
    setSaved(isSaved);
    setFinished(state?.status === 'read');
    if (state && state.status !== 'read' && state.progress >= 0.05 && state.anchorBlock > 0) {
      setResumeOffer({ block: state.anchorBlock, progress: state.progress });
    }
    await user.open(id, article.version);
  }, [content, user, settings, id]);

  useEffect(() => {
    load();
  }, [load]);

  // Save the reading position when leaving the article.
  useEffect(() => {
    return () => {
      const pr = progress.current;
      if (pr.value > 0) user.saveProgress(id, pr.value, pr.anchor).then(bump);
      else bump();
    };
  }, [id, user, bump]);

  const markRead = useCallback(async () => {
    if (!data || finished) return;
    setFinished(true);
    await user.complete(id, data.article.version);
    // The next lesson may have changed.
    if (data.article.kind === 'core') {
      const n = await currentNextLesson(content, user, settings);
      const next = n && n.id !== id ? await content.card(n.id) : null;
      setData((d) => (d ? { ...d, next } : d));
    }
  }, [content, data, finished, id, settings, user]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = Math.max(1, contentSize.height - layoutMeasurement.height);
    const value = Math.min(1, Math.max(0, contentOffset.y / max));
    const ys = blockY.current;
    let anchor = 0;
    for (let i = 0; i < ys.length; i++) if (ys[i] !== undefined && ys[i] <= contentOffset.y + 80) anchor = i;
    const pr = progress.current;
    pr.value = Math.max(pr.value, value);
    pr.anchor = anchor;
    if (resumeOffer && contentOffset.y > 200) setResumeOffer(null);
    const now = Date.now();
    if (now - pr.lastSave > 3000) {
      pr.lastSave = now;
      user.saveProgress(id, pr.value, anchor);
    }
    // Non-lesson articles count as read when you reach the end.
    if (data && data.article.kind !== 'core' && value > 0.97) markRead();
  };

  const toggleSave = async () => {
    const v = !saved;
    setSaved(v);
    await user.setSaved(id, v);
  };

  const onQuizComplete = async (answers: QuizAnswer[]) => {
    if (!data) return;
    await user.saveAttempt({ articleId: id, version: data.article.version, startedAt: startedAt.current, answers });
    await markRead();
    setData((d) => (d ? { ...d } : d));
  };

  const resume = () => {
    if (!resumeOffer) return;
    const y = blockY.current[resumeOffer.block];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 60), animated: true });
    setResumeOffer(null);
  };

  if (missing) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
        <IconButton name="arrow-back" label="Back" onPress={() => router.back()} />
        <T v="title" style={{ padding: GUTTER }}>
          This article is no longer available.
        </T>
      </View>
    );
  }

  const header = (
    <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: p.bg, borderBottomColor: p.rule }]}>
      <IconButton name="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View style={{ flexDirection: 'row' }}>
        <IconButton name="translate" label="Reading aids: furigana, romaji, translations and text size" onPress={() => setAidsOpen(true)} />
        <IconButton name={saved ? 'bookmark' : 'bookmark-border'} label={saved ? 'Remove from Saved' : 'Save article'} color={saved ? p.brand : undefined} onPress={toggleSave} />
      </View>
    </View>
  );

  if (!data) return <View style={{ flex: 1, backgroundColor: p.bg }}>{header}</View>;
  const a = data.article;
  const quizIndex = a.blocks.findIndex((b) => b.type === 'quiz');
  const teaches = a.concepts.filter((c) => c.role === 'teaches');

  const onBlockLayout = (i: number) => (e: LayoutChangeEvent) => {
    blockY.current[i] = e.nativeEvent.layout.y;
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {header}
      <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={64} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 18 }}>
          <CategoryLabel card={a} kicker={a.kind === 'core' ? `Stage ${a.stage} lesson` : undefined} />
          <T v="headline" style={{ marginTop: 8 }} accessibilityRole="header">
            {a.headline}
          </T>
          {a.headlineJa ? (
            <T v="title" color="secondary" style={{ marginTop: 6, fontFamily: fonts.sans, fontSize: 18 }}>
              {a.headlineJa}
            </T>
          ) : null}
          <T v="standfirst" style={{ marginTop: 12 }}>
            {a.summary}
          </T>
          <View style={styles.metaRow}>
            <T v="meta" color="muted">
              {a.readingMinutes} min read · {DIFFICULTY[a.difficulty]}
            </T>
            {finished ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                <Icon name="check" size={14} color={p.good} />
                <T v="meta" style={{ color: p.good, marginLeft: 2 }}>
                  Read
                </T>
              </View>
            ) : null}
          </View>
        </View>
        <Cover imageId={a.imageId} aspect={16 / 10} style={{ marginTop: 16 }} />

        {resumeOffer ? (
          <Pressable onPress={resume} accessibilityRole="button" style={[styles.resume, { backgroundColor: p.text }]}>
            <Icon name="bookmark" size={18} color={p.bg} />
            <T v="ui" style={{ color: p.bg, marginLeft: 8, flex: 1 }}>
              Continue where you left off ({Math.round(resumeOffer.progress * 100)}%)
            </T>
            <Icon name="arrow-downward" size={18} color={p.bg} />
          </Pressable>
        ) : null}

        {a.blocks.map((b, i) =>
          b.type === 'quiz' ? (
            <View key={i} onLayout={onBlockLayout(i)}>
              <Quiz questions={a.quiz.filter((q) => b.questions.includes(q.id))} onComplete={onQuizComplete} best={data.best} />
            </View>
          ) : (
            <View key={i} onLayout={onBlockLayout(i)}>
              <BlockView block={b} />
            </View>
          ),
        )}
        {quizIndex < 0 && a.quiz.length > 0 ? <Quiz questions={a.quiz} onComplete={onQuizComplete} best={data.best} /> : null}

        {/* End of article */}
        <View style={{ paddingHorizontal: GUTTER, marginTop: 32 }}>
          {!finished ? (
            <Pressable onPress={markRead} accessibilityRole="button" style={[styles.finish, { borderColor: p.text }]}>
              <Icon name="done" size={20} />
              <T v="ui" style={{ marginLeft: 8, fontFamily: fonts.sansMedium }}>
                {a.kind === 'core' ? 'Mark lesson as finished' : 'Mark as read'}
              </T>
            </Pressable>
          ) : (
            <View style={[styles.finish, { backgroundColor: p.goodSoft, borderColor: p.goodSoft }]}>
              <Icon name="check-circle" size={20} color={p.good} />
              <T v="ui" style={{ marginLeft: 8, color: p.good, fontFamily: fonts.sansMedium }}>
                {a.kind === 'core' ? 'Lesson finished. It stays in your Archive.' : 'Read. It stays in your Archive.'}
              </T>
            </View>
          )}
        </View>

        {teaches.length ? (
          <View style={{ paddingHorizontal: GUTTER, marginTop: 24 }}>
            <T v="label" color="muted">
              In this article
            </T>
            <View style={styles.chips}>
              {a.concepts.filter((c) => c.role !== 'mentions').map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => router.push({ pathname: '/concept/[id]', params: { id: c.id } })}
                  accessibilityRole="link"
                  style={[styles.chip, { borderColor: p.rule }]}>
                  <T v="meta">{c.name}</T>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {data.next ? (
          <>
            <SectionHeading title={finished ? 'Your next lesson' : 'Next in your course'} ja="次へ" />
            <StoryRow card={data.next} state={data.states.get(data.next.id)} first />
          </>
        ) : null}
        {data.related.length ? (
          <>
            <SectionHeading title="Related articles" ja="関連記事" />
            {data.related.map((c, i) => (
              <StoryRow key={c.id} card={c} state={data.states.get(c.id)} first={i === 0} />
            ))}
          </>
        ) : null}
      </ScrollView>

      <ReadingAids open={aidsOpen} onClose={() => setAidsOpen(false)} />
    </View>
  );
}

function ReadingAids({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSetting } = useApp();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const Row = ({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={[styles.aidRow, { borderTopColor: p.rule }]}>
      <View style={{ flex: 1 }}>
        <T v="ui">{label}</T>
        <T v="meta" color="muted">
          {hint}
        </T>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: p.brand, false: p.rule }} thumbColor={p.raised} accessibilityLabel={label} />
    </View>
  );
  const sizes = [0.9, 1, 1.15, 1.3];
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: p.overlay }} onPress={onClose} accessibilityLabel="Close reading aids" />
      <View style={[styles.sheet, { backgroundColor: p.bg, paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <T v="heading" style={{ fontSize: 21 }}>
            Reading aids
          </T>
          <IconButton name="close" label="Close" onPress={onClose} />
        </View>
        <Row label="Furigana" hint="Readings above kanji" value={settings.furigana} onChange={(v) => setSetting('furigana', v)} />
        <Row label="Romaji" hint="Latin letters under Japanese. Try reading without them." value={settings.romaji} onChange={(v) => setSetting('romaji', v)} />
        <Row label="English translations" hint="When off, tap to reveal each one" value={settings.translations} onChange={(v) => setSetting('translations', v)} />
        <View style={[styles.aidRow, { borderTopColor: p.rule }]}>
          <T v="ui" style={{ flex: 1 }}>
            Japanese text size
          </T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {sizes.map((s) => (
              <Pressable
                key={s}
                onPress={() => setSetting('textScale', s)}
                accessibilityRole="button"
                accessibilityState={{ selected: settings.textScale === s }}
                accessibilityLabel={`Text size ${Math.round(s * 100)}%`}
                style={[styles.size, { borderColor: settings.textScale === s ? p.text : p.rule, borderWidth: settings.textScale === s ? 2 : 1 }]}>
                <T v="ui" style={{ fontSize: 13 + (s - 0.9) * 20 }}>
                  あ
                </T>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  resume: { flexDirection: 'row', alignItems: 'center', marginHorizontal: GUTTER, marginTop: 16, paddingHorizontal: 14, paddingVertical: 12 },
  finish: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingVertical: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  aidRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  sheet: { paddingHorizontal: GUTTER, paddingTop: 12 },
  size: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
