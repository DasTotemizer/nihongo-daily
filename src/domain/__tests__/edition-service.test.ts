import type { Article, ContentPack } from '@/content/types';
import { ensureContent } from '@/data/content-loader';
import { ContentRepo } from '@/data/content-repo';
import { migrateUserDb } from '@/data/schema';
import { DEFAULT_SETTINGS, UserRepo } from '@/data/user-repo';
import { openNodeDb } from '@/test/node-db';

import { currentNextLesson, issueDueEditions } from '../edition-service';

const art = (id: string, kind: Article['kind'], extra: Partial<Article> = {}): Article => ({
  id,
  kind,
  category: kind === 'core' ? 'grammar' : 'culture',
  stage: 2,
  difficulty: 1,
  readingMinutes: 4,
  concepts: [],
  related: [],
  current: { version: 1, headline: `Headline ${id}`, summary: `Summary about ${id}`, blocks: [], publishedAt: '2026-11-01' },
  history: [],
  quiz: [],
  searchText: { en: `summary about ${id}`, ja: '', terms: ' ' },
  ...extra,
});

function pack(): ContentPack {
  const lessons = [1, 2, 3, 4, 5, 6].map((n) =>
    art(`lesson-${n}`, 'core', {
      sequence: n * 10,
      concepts: [{ id: `c${n}`, role: 'teaches' }],
      quiz: [
        { id: `lesson-${n}-q1`, type: 'choice', concept: `c${n}`, prompt: [{ k: 'text', t: 'Q' }], options: [{ label: [{ k: 'text', t: 'a' }] }, { label: [{ k: 'text', t: 'b' }] }], answer: 0, why: [] },
      ],
    }),
  );
  lessons[1].current.headline = 'Understanding particles';
  const extras = Array.from({ length: 12 }, (_, i) => art(`extra-${i + 1}`, i % 3 === 0 ? 'revision' : 'japan_today', i % 3 === 0 ? { concepts: [{ id: 'c1', role: 'practises' }] } : {}));
  return {
    contentVersion: 1,
    builtAt: 'test',
    categories: [
      { id: 'grammar', name: 'Grammar', nameJa: '文法', description: '', accent: '#000', order: 1 },
      { id: 'culture', name: 'Japanese Culture', nameJa: '文化', description: '', accent: '#000', order: 2 },
    ],
    concepts: [1, 2, 3, 4, 5, 6].map((n) => ({
      id: `c${n}`, name: `Concept ${n}`, description: '', stage: 2, taeKimSection: 'Basic', taeKimLesson: 'x', order: n,
      prereqs: n > 1 ? [`c${n - 1}`] : [],
    })),
    articles: [...lessons, ...extras],
    editions: [0, 1, 2, 3, 4].map((i) => ({ number: i + 1, articles: [`extra-${i * 2 + 1}`, `extra-${i * 2 + 2}`] })),
    images: [],
    vocab: [],
  };
}

async function setup() {
  const cdb = openNodeDb();
  const udb = openNodeDb();
  await ensureContent(cdb, pack());
  await migrateUserDb(udb);
  let now = new Date(2026, 10, 23, 8, 0); // Monday 23 Nov 2026, 8 am
  const content = new ContentRepo(cdb);
  const user = new UserRepo(udb, () => now);
  return { content, user, udb, setNow: (d: Date) => (now = d) };
}

describe('daily publishing with a real database', () => {
  it('runs the Monday-to-Thursday scenario from the spec', async () => {
    const { content, user, setNow } = await setup();
    const s = DEFAULT_SETTINGS;

    // Monday: first launch issues edition 1, led by lesson 1.
    const mon = await issueDueEditions(content, user, s, new Date(2026, 10, 23, 8, 0));
    expect(mon).toHaveLength(1);
    expect(mon[0]).toMatchObject({ editionNumber: 1, leadArticleId: 'lesson-1', leadIsLesson: true, title: "Monday's Japanese Daily" });

    // Opening the app again on Monday issues nothing new.
    expect(await issueDueEditions(content, user, s, new Date(2026, 10, 23, 21, 0))).toHaveLength(0);

    // The reader finishes lessons 1, 2 and 3 on Monday.
    for (const id of ['lesson-1', 'lesson-2', 'lesson-3']) {
      await user.open(id, 1);
      await user.complete(id, 1);
    }

    // Away Tuesday and Wednesday. Thursday morning:
    setNow(new Date(2026, 10, 26, 7, 30));
    const thu = await issueDueEditions(content, user, s, new Date(2026, 10, 26, 7, 30));
    expect(thu.map((e) => [e.editionNumber, e.issueDate, e.isBackIssue, e.leadIsLesson])).toEqual([
      [2, '2026-11-24', true, false],
      [3, '2026-11-25', true, false],
      [4, '2026-11-26', false, true],
    ]);
    // Back issues hold supporting pieces only; today's edition is led by lesson 4.
    expect(thu[0].articleIds.some((id) => id.startsWith('lesson'))).toBe(false);
    expect(thu[2].leadArticleId).toBe('lesson-4');

    // Nothing was lost: all four editions are in the archive, and lessons 1–3 are still read.
    expect((await user.issues()).map((i) => i.editionNumber)).toEqual([4, 3, 2, 1]);
    expect(await user.readIds()).toEqual(new Set(['lesson-1', 'lesson-2', 'lesson-3']));
  });

  it('remembers a half-read article and never un-reads a finished one', async () => {
    const { user } = await setup();
    await user.open('lesson-1', 1);
    await user.saveProgress('lesson-1', 0.5, 7);
    expect(await user.inProgress()).toHaveLength(1);
    expect((await user.readingState('lesson-1'))?.anchorBlock).toBe(7);
    await user.complete('lesson-1', 1);
    await user.open('lesson-1', 1);
    await user.saveProgress('lesson-1', 0.2, 1);
    const st = await user.readingState('lesson-1');
    expect(st?.status).toBe('read');
    expect(st?.progress).toBe(1);
    expect(await user.inProgress()).toHaveLength(0);
  });

  it('keeps bookmarks separate from reading state', async () => {
    const { user } = await setup();
    await user.setSaved('extra-1', true);
    await user.setSaved('lesson-2', true);
    await user.setSaved('extra-1', false);
    expect((await user.savedArticles()).map((s) => s.articleId)).toEqual(['lesson-2']);
    await user.setSaved('extra-1', true);
    expect(await user.isSaved('extra-1')).toBe(true);
  });

  it('adds a revision piece when a concept keeps going wrong', async () => {
    const { content, user } = await setup();
    await issueDueEditions(content, user, DEFAULT_SETTINGS, new Date(2026, 10, 23, 8, 0));
    for (let i = 0; i < 3; i++) {
      await user.saveAttempt({ articleId: 'lesson-1', version: 1, startedAt: 'x', answers: [{ questionId: 'lesson-1-q1', conceptId: 'c1', given: 1, correct: false }] });
    }
    const [tue] = await issueDueEditions(content, user, DEFAULT_SETTINGS, new Date(2026, 10, 24, 8, 0));
    expect(tue.articleIds).toContain('extra-1'); // the revision article for c1
    expect((await user.mastery()).get('c1')?.rate).toBe(0);
  });

  it('keeps printing editions after the editorial templates run out', async () => {
    const { content, user } = await setup();
    for (let d = 23; d <= 30; d++) await issueDueEditions(content, user, DEFAULT_SETTINGS, new Date(2026, 10, d, 8, 0));
    const issues = await user.issues();
    expect(issues).toHaveLength(8);
    expect(issues[0].templateNumber).toBeNull();
    expect(issues[0].articleIds.length).toBeGreaterThan(1);
  });

  it('finds articles by summary text, plurals and concept names', async () => {
    const { content } = await setup();
    expect((await content.search('particles')).map((r) => r.id)).toContain('lesson-2');
    expect((await content.search('concept 3')).map((r) => r.id)).toContain('lesson-3');
    expect((await content.search('summary about extra-12')).map((r) => r.id)).toEqual(['extra-12']);
  });

  it('holds back supporting pieces until their grammar has been taught', async () => {
    const { content, user } = await setup();
    const [mon] = await issueDueEditions(content, user, DEFAULT_SETTINGS, new Date(2026, 10, 23, 8, 0));
    // extra-1 practises concept 1, which lesson-1 teaches and the reader has not read yet.
    expect(mon.articleIds).not.toContain('extra-1');
    expect(mon.articleIds).toContain('extra-2');
    await user.open('lesson-1', 1);
    await user.complete('lesson-1', 1);
    const [tue] = await issueDueEditions(content, user, DEFAULT_SETTINGS, new Date(2026, 10, 24, 8, 0));
    expect(tue.articleIds).toContain('extra-1');
  });

  it('lets kana readers skip Stage 1', async () => {
    const { content, user } = await setup();
    expect((await currentNextLesson(content, user, { ...DEFAULT_SETTINGS, startingPoint: 'kana' }))?.id).toBe('lesson-1');
  });

  it('reloads content without touching user data', async () => {
    const { content, user, udb } = await setup();
    await user.setSaved('lesson-1', true);
    const cdb2 = openNodeDb();
    await ensureContent(cdb2, { ...pack(), builtAt: 'v2' });
    expect(await user.isSaved('lesson-1')).toBe(true);
    expect(await migrateUserDb(udb)).toBe(1);
    expect(await content.templateCount()).toBe(5);
  });
});
