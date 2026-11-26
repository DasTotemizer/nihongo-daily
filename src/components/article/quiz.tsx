import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { JaLine, QuizQuestion } from '@/content/types';
import { usePalette, useSettings } from '@/state/app';
import { GUTTER, fonts } from '@/theme';

import { Icon } from '../ui/icon';
import { T } from '../ui/text';
import { InlineText, JaText, surface } from './japanese';

export interface QuizAnswer {
  questionId: string;
  conceptId: string;
  given: unknown;
  correct: boolean;
}

/** Shuffle that is stable for a given seed, and never returns the original order when it can avoid it. */
function shuffled<T>(items: T[], seed: string): T[] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const rand = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  const out = items.map((x, i) => ({ x, i }));
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.length < 2 || out.some((o, k) => o.i !== k)) break;
  }
  return out.map((o) => o.x);
}

function Button({ label, onPress, primary, icon }: { label: string; onPress: () => void; primary?: boolean; icon?: React.ComponentProps<typeof Icon>['name'] }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: p.rule }}
      style={[styles.button, primary ? { backgroundColor: p.text } : { borderColor: p.text, borderWidth: 1 }]}>
      {icon ? <Icon name={icon} size={18} color={primary ? p.bg : p.text} /> : null}
      <T v="ui" style={{ color: primary ? p.bg : p.text, fontFamily: fonts.sansMedium, marginLeft: icon ? 6 : 0 }}>
        {label}
      </T>
    </Pressable>
  );
}

function Feedback({ correct, why, onRetry }: { correct: boolean; why: QuizQuestion['why']; onRetry?: () => void }) {
  const p = usePalette();
  const s = useSettings();
  return (
    <View style={[styles.feedback, { backgroundColor: correct ? p.goodSoft : p.badSoft }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name={correct ? 'check-circle' : 'info'} size={20} color={correct ? p.good : p.bad} />
        <T v="ui" style={{ marginLeft: 6, fontFamily: fonts.sansMedium, color: correct ? p.good : p.bad }}>
          {correct ? 'Correct' : 'Not quite'}
        </T>
      </View>
      <InlineText text={why} style={{ fontFamily: fonts.serif, fontSize: 16 * s.textScale, lineHeight: 23 * s.textScale, color: p.text, marginTop: 6 }} />
      {!correct && onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'flex-start' }} hitSlop={8}>
          <T v="meta" style={{ color: p.brand, fontFamily: fonts.sansMedium }}>
            Try this one again
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

function ChoiceQuestion({ q, onAnswered }: { q: Extract<QuizQuestion, { type: 'choice' }>; onAnswered: (correct: boolean, given: unknown) => void }) {
  const p = usePalette();
  const s = useSettings();
  const [picked, setPicked] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const done = picked !== null;
  return (
    <View>
      {q.promptJa ? (
        <View style={{ marginBottom: 12 }}>
          <JaText line={q.promptJa} size={22} />
        </View>
      ) : null}
      {q.options.map((o, i) => {
        const isAnswer = i === q.answer;
        const isPicked = i === picked;
        const bg = done && isAnswer ? p.goodSoft : done && isPicked ? p.badSoft : p.raised;
        const border = done && isAnswer ? p.good : done && isPicked ? p.bad : p.rule;
        return (
          <Pressable
            key={i}
            disabled={done}
            onPress={() => {
              setPicked(i);
              if (tries === 0) onAnswered(i === q.answer, i);
              setTries((t) => t + 1);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: isPicked, disabled: done }}
            android_ripple={{ color: p.rule }}
            style={[styles.option, { backgroundColor: bg, borderColor: border }]}>
            <InlineText text={o.label} style={{ flex: 1, fontFamily: fonts.sans, fontSize: 17 * s.textScale, lineHeight: 24 * s.textScale, color: p.text }} />
            {done && isAnswer ? <Icon name="check" size={20} color={p.good} /> : null}
            {done && isPicked && !isAnswer ? <Icon name="close" size={20} color={p.bad} /> : null}
          </Pressable>
        );
      })}
      {done ? <Feedback correct={picked === q.answer} why={q.why} onRetry={() => setPicked(null)} /> : null}
    </View>
  );
}

function Tile({ line, onPress, faded, label }: { line: JaLine; onPress: () => void; faded?: boolean; label?: string }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={faded}
      accessibilityRole="button"
      accessibilityLabel={label ?? surface(line)}
      style={[styles.tile, { borderColor: p.rule, backgroundColor: p.raised, opacity: faded ? 0.25 : 1 }]}>
      <JaText line={line} size={19} romaji={false} />
    </Pressable>
  );
}

function OrderQuestion({ q, onAnswered }: { q: Extract<QuizQuestion, { type: 'order' }>; onAnswered: (correct: boolean, given: unknown) => void }) {
  const p = usePalette();
  const pool = useMemo(() => shuffled(q.words.map((w, i) => ({ w, i })), q.id), [q]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [tries, setTries] = useState(0);
  const check = () => {
    const ok = chosen.every((c, k) => surface(q.words[c]) === surface(q.words[k]));
    setChecked(ok);
    if (tries === 0) onAnswered(ok, chosen);
    setTries((t) => t + 1);
  };
  return (
    <View>
      <T v="meta" color="secondary" style={{ marginBottom: 8, fontStyle: 'italic' }}>
        “{q.en}”
      </T>
      <View style={[styles.answerLine, { borderBottomColor: p.ruleStrong }]}>
        {chosen.length === 0 ? (
          <T v="meta" color="muted">
            Tap the words below in order
          </T>
        ) : (
          chosen.map((c, k) => <Tile key={k} line={q.words[c]} onPress={() => checked === null && setChosen(chosen.filter((_, j) => j !== k))} />)
        )}
      </View>
      <View style={styles.pool}>
        {pool.map(({ w, i }) => (
          <Tile key={i} line={w} faded={chosen.includes(i)} onPress={() => setChosen([...chosen, i])} />
        ))}
      </View>
      {checked === null ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          {chosen.length === q.words.length ? <Button label="Check" primary onPress={check} /> : null}
          {chosen.length > 0 ? <Button label="Clear" onPress={() => setChosen([])} /> : null}
        </View>
      ) : (
        <Feedback
          correct={checked}
          why={q.why}
          onRetry={() => {
            setChosen([]);
            setChecked(null);
          }}
        />
      )}
    </View>
  );
}

function MatchQuestion({ q, onAnswered }: { q: Extract<QuizQuestion, { type: 'match' }>; onAnswered: (correct: boolean, given: unknown) => void }) {
  const p = usePalette();
  const s = useSettings();
  const right = useMemo(() => shuffled(q.pairs.map((x, i) => ({ en: x.en, i })), q.id), [q]);
  const [sel, setSel] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const done = matched.size === q.pairs.length;

  const pickRight = (i: number) => {
    if (sel === null) return;
    if (sel === i) {
      const m = new Set(matched).add(i);
      setMatched(m);
      setSel(null);
      setWrong(null);
      if (m.size === q.pairs.length) onAnswered(mistakes === 0, { mistakes });
    } else {
      setWrong(i);
      setMistakes((n) => n + 1);
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, gap: 8 }}>
          {q.pairs.map((pair, i) => (
            <Pressable
              key={i}
              disabled={matched.has(i)}
              onPress={() => {
                setSel(i);
                setWrong(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: sel === i }}
              style={[
                styles.matchCell,
                { borderColor: sel === i ? p.text : p.rule, backgroundColor: matched.has(i) ? p.goodSoft : p.raised, borderWidth: sel === i ? 2 : 1 },
              ]}>
              <JaText line={pair.ja} size={19} romaji={false} />
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          {right.map(({ en, i }) => (
            <Pressable
              key={i}
              disabled={matched.has(i)}
              onPress={() => pickRight(i)}
              accessibilityRole="button"
              style={[
                styles.matchCell,
                { borderColor: wrong === i ? p.bad : p.rule, backgroundColor: matched.has(i) ? p.goodSoft : wrong === i ? p.badSoft : p.raised },
              ]}>
              <T v="ui" scale={s.textScale} style={{ fontSize: 15 }}>
                {en}
              </T>
            </Pressable>
          ))}
        </View>
      </View>
      {!done ? (
        <T v="meta" color="muted" style={{ marginTop: 8 }}>
          {sel === null ? 'Tap a Japanese word, then its meaning.' : 'Now tap its meaning.'}
        </T>
      ) : (
        <Feedback correct={mistakes === 0} why={q.why} />
      )}
    </View>
  );
}

/** A short knowledge check. Records the first answer to each question; retries are always allowed. */
export function Quiz({ questions, onComplete, best }: {
  questions: QuizQuestion[];
  onComplete: (answers: QuizAnswer[]) => Promise<void> | void;
  best?: { score: number; total: number; attempts: number } | null;
}) {
  const p = usePalette();
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [finished, setFinished] = useState(false);
  const q = questions[index];
  const answered = answers.some((a) => a.questionId === q?.id);

  const record = (correct: boolean, given: unknown) => {
    setAnswers((prev) => (prev.some((a) => a.questionId === q.id) ? prev : [...prev, { questionId: q.id, conceptId: q.concept, given, correct }]));
  };

  const next = async () => {
    if (index + 1 < questions.length) setIndex(index + 1);
    else {
      setFinished(true);
      await onComplete(answers);
    }
  };

  const restart = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setAnswers([]);
    setFinished(false);
  };

  const score = answers.filter((a) => a.correct).length;

  return (
    <View style={[styles.quiz, { backgroundColor: p.surface, borderTopColor: p.ruleStrong }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T v="heading" style={{ fontSize: 22 }}>
          Knowledge check
        </T>
        {!finished ? (
          <T v="meta" color="muted">
            {index + 1} of {questions.length}
          </T>
        ) : null}
      </View>
      {best && !finished && round === 0 && index === 0 ? (
        <T v="meta" color="muted" style={{ marginTop: 2 }}>
          Your best so far: {best.score} of {best.total}
        </T>
      ) : null}

      {finished ? (
        <View style={{ marginTop: 12 }}>
          <T v="lead" style={{ fontSize: 26 }}>
            {score} of {questions.length}
          </T>
          <T v="body" color="secondary" style={{ marginTop: 6, fontSize: 16, lineHeight: 23 }}>
            {score === questions.length
              ? 'Every answer right first time.'
              : score >= questions.length / 2
                ? 'Good work. The explanations above are there whenever you want another look.'
                : 'This one is worth another look. Mistakes here only help choose what to revise next.'}
          </T>
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            <Button label="Try the quiz again" icon="refresh" onPress={restart} />
          </View>
        </View>
      ) : q ? (
        <View key={`${round}-${index}`} style={{ marginTop: 14 }}>
          <InlineText text={q.prompt} style={{ fontFamily: fonts.headline, fontSize: 19, lineHeight: 26, color: p.text, marginBottom: 12 }} />
          {q.type === 'choice' ? <ChoiceQuestion q={q} onAnswered={record} /> : null}
          {q.type === 'order' ? <OrderQuestion q={q} onAnswered={record} /> : null}
          {q.type === 'match' ? <MatchQuestion q={q} onAnswered={record} /> : null}
          {answered ? (
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <Button label={index + 1 < questions.length ? 'Next question' : 'See your result'} primary onPress={next} icon="arrow-forward" />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  quiz: { marginTop: 32, paddingHorizontal: GUTTER, paddingVertical: 20, borderTopWidth: 3 },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  feedback: { padding: 12, marginTop: 6 },
  button: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  tile: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  answerLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 52, alignItems: 'flex-end', paddingBottom: 8, borderBottomWidth: 1 },
  pool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  matchCell: { paddingHorizontal: 10, paddingVertical: 10, minHeight: 52, justifyContent: 'center' },
});
