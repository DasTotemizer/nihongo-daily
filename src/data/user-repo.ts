import type { Db } from './db';

export type ReadingStatus = 'unread' | 'started' | 'read';

export interface ReadingState {
  articleId: string;
  articleVersion: number;
  status: ReadingStatus;
  progress: number;
  anchorBlock: number;
  firstOpenedAt: string;
  lastOpenedAt: string;
  completedAt: string | null;
}

export interface EditionIssue {
  id: string;
  editionNumber: number;
  issueDate: string;
  templateNumber: number | null;
  title: string;
  leadArticleId: string | null;
  leadIsLesson: boolean;
  articleIds: string[];
  isBackIssue: boolean;
  issuedAt: string;
}

export interface Settings {
  furigana: boolean;
  romaji: boolean;
  translations: boolean;
  textScale: number; // 0.85 – 1.4
  theme: 'system' | 'light' | 'dark';
  notifyAt: string | null; // "07:30" or null
  onboarded: boolean;
  /** "new" starts with kana; "kana" treats Stage 1 lessons as optional. */
  startingPoint: 'new' | 'kana';
}

export const DEFAULT_SETTINGS: Settings = {
  furigana: true,
  romaji: false,
  translations: true,
  textScale: 1,
  theme: 'system',
  notifyAt: null,
  onboarded: false,
  startingPoint: 'new',
};

export function uuid(): string {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else if (i === 19) s += h[(Math.random() * 4) | 8];
    else s += h[(Math.random() * 16) | 0];
  }
  return s;
}

type IssueRow = {
  id: string; edition_number: number; issue_date: string; template_number: number | null; title: string;
  lead_article_id: string | null; lead_is_lesson: number; article_ids_json: string; is_back_issue: number; issued_at: string;
};

const toIssue = (r: IssueRow): EditionIssue => ({
  id: r.id,
  editionNumber: r.edition_number,
  issueDate: r.issue_date,
  templateNumber: r.template_number,
  title: r.title,
  leadArticleId: r.lead_article_id,
  leadIsLesson: !!r.lead_is_lesson,
  articleIds: JSON.parse(r.article_ids_json),
  isBackIssue: !!r.is_back_issue,
  issuedAt: r.issued_at,
});

type StateRow = {
  article_id: string; article_version: number; status: ReadingStatus; progress: number; anchor_block: number;
  first_opened_at: string; last_opened_at: string; completed_at: string | null;
};

const toState = (r: StateRow): ReadingState => ({
  articleId: r.article_id,
  articleVersion: r.article_version,
  status: r.status,
  progress: r.progress,
  anchorBlock: r.anchor_block,
  firstOpenedAt: r.first_opened_at,
  lastOpenedAt: r.last_opened_at,
  completedAt: r.completed_at,
});

export class UserRepo {
  constructor(private db: Db, private now: () => Date = () => new Date()) {}

  private ts() {
    return this.now().toISOString();
  }

  private async outbox(table: string, rowId: string, op: string) {
    await this.db.run('INSERT INTO sync_outbox (table_name, row_id, op, at) VALUES (?,?,?,?)', [table, rowId, op, this.ts()]);
  }

  // ---- settings
  async settings(): Promise<Settings> {
    const rows = await this.db.all<{ key: string; value_json: string }>('SELECT key, value_json FROM setting');
    const s: Settings = { ...DEFAULT_SETTINGS };
    for (const r of rows) {
      if (r.key in s) (s as unknown as Record<string, unknown>)[r.key] = JSON.parse(r.value_json);
    }
    return s;
  }

  async setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    await this.db.run(
      'INSERT INTO setting VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at',
      [key, JSON.stringify(value), this.ts()],
    );
    await this.outbox('setting', key, 'upsert');
  }

  // ---- reading
  async readingStates(): Promise<Map<string, ReadingState>> {
    const rows = await this.db.all<StateRow>('SELECT * FROM reading_state');
    return new Map(rows.map((r) => [r.article_id, toState(r)]));
  }

  async readingState(articleId: string): Promise<ReadingState | null> {
    const r = await this.db.first<StateRow>('SELECT * FROM reading_state WHERE article_id = ?', [articleId]);
    return r ? toState(r) : null;
  }

  async readIds(): Promise<Set<string>> {
    const rows = await this.db.all<{ article_id: string }>("SELECT article_id FROM reading_state WHERE status = 'read'");
    return new Set(rows.map((r) => r.article_id));
  }

  /** Called when an article is opened. Never downgrades a finished article. */
  async open(articleId: string, version: number) {
    const at = this.ts();
    await this.db.run(
      `INSERT INTO reading_state (article_id, article_version, status, progress, anchor_block, first_opened_at, last_opened_at, completed_at, updated_at)
       VALUES (?,?,'started',0,0,?,?,NULL,?)
       ON CONFLICT(article_id) DO UPDATE SET last_opened_at = excluded.last_opened_at, updated_at = excluded.updated_at`,
      [articleId, version, at, at, at],
    );
    await this.db.run('INSERT INTO reading_event VALUES (?,?,?,?,?)', [uuid(), articleId, version, 'open', at]);
    await this.outbox('reading_state', articleId, 'upsert');
  }

  async saveProgress(articleId: string, progress: number, anchorBlock: number) {
    await this.db.run(
      `UPDATE reading_state SET progress = max(CASE WHEN status = 'read' THEN 1 ELSE 0 END, ?), anchor_block = ?, updated_at = ?
       WHERE article_id = ?`,
      [Math.max(0, Math.min(1, progress)), anchorBlock, this.ts(), articleId],
    );
  }

  async complete(articleId: string, version: number) {
    const at = this.ts();
    const res = await this.db.run(
      `UPDATE reading_state SET status = 'read', progress = 1, completed_at = coalesce(completed_at, ?), article_version = ?, updated_at = ?
       WHERE article_id = ? AND status != 'read'`,
      [at, version, at, articleId],
    );
    if (res.changes > 0) {
      await this.db.run('INSERT INTO reading_event VALUES (?,?,?,?,?)', [uuid(), articleId, version, 'complete', at]);
      await this.outbox('reading_state', articleId, 'upsert');
    }
  }

  /** Articles started but not finished, most recent first. */
  async inProgress(): Promise<ReadingState[]> {
    const rows = await this.db.all<StateRow>(
      "SELECT * FROM reading_state WHERE status = 'started' AND progress >= 0.05 AND progress < 0.95 ORDER BY last_opened_at DESC",
    );
    return rows.map(toState);
  }

  async history(limit = 50): Promise<ReadingState[]> {
    const rows = await this.db.all<StateRow>('SELECT * FROM reading_state ORDER BY last_opened_at DESC LIMIT ?', [limit]);
    return rows.map(toState);
  }

  // ---- bookmarks
  async isSaved(articleId: string): Promise<boolean> {
    const r = await this.db.first<{ n: number }>(
      "SELECT count(*) AS n FROM bookmark WHERE target_type = 'article' AND target_id = ? AND deleted_at IS NULL",
      [articleId],
    );
    return (r?.n ?? 0) > 0;
  }

  async setSaved(articleId: string, saved: boolean, type: 'article' | 'vocab' = 'article') {
    const at = this.ts();
    if (saved) {
      await this.db.run(
        `INSERT INTO bookmark VALUES (?,?,?,?,NULL,?)
         ON CONFLICT(target_type, target_id) DO UPDATE SET deleted_at = NULL, saved_at = excluded.saved_at, updated_at = excluded.updated_at`,
        [uuid(), type, articleId, at, at],
      );
    } else {
      await this.db.run('UPDATE bookmark SET deleted_at = ?, updated_at = ? WHERE target_type = ? AND target_id = ?', [at, at, type, articleId]);
    }
    await this.outbox('bookmark', `${type}:${articleId}`, 'upsert');
  }

  async savedArticles(): Promise<{ articleId: string; savedAt: string }[]> {
    return this.db.all(
      "SELECT target_id AS articleId, saved_at AS savedAt FROM bookmark WHERE target_type = 'article' AND deleted_at IS NULL ORDER BY saved_at DESC",
    );
  }

  // ---- quizzes
  async saveAttempt(args: {
    articleId: string;
    version: number;
    startedAt: string;
    answers: { questionId: string; conceptId: string; given: unknown; correct: boolean }[];
  }) {
    const id = uuid();
    const at = this.ts();
    const score = args.answers.filter((a) => a.correct).length;
    await this.db.transaction(async () => {
      await this.db.run('INSERT INTO quiz_attempt VALUES (?,?,?,?,?,?,?)', [
        id, args.articleId, args.version, score, args.answers.length, args.startedAt, at,
      ]);
      for (const a of args.answers) {
        await this.db.run('INSERT INTO quiz_answer VALUES (?,?,?,?,?,?)', [
          id, a.questionId, a.conceptId, JSON.stringify(a.given), a.correct ? 1 : 0, at,
        ]);
      }
      const concepts = Array.from(new Set(args.answers.map((a) => a.conceptId)));
      for (const c of concepts) await this.refreshMastery(c);
    });
    await this.outbox('quiz_attempt', id, 'insert');
    return { id, score, total: args.answers.length };
  }

  async bestAttempt(articleId: string): Promise<{ score: number; total: number; attempts: number } | null> {
    const r = await this.db.first<{ score: number; total: number; attempts: number }>(
      'SELECT max(score) AS score, max(total) AS total, count(*) AS attempts FROM quiz_attempt WHERE article_id = ?',
      [articleId],
    );
    return r && r.attempts > 0 ? r : null;
  }

  async recentAnswers(): Promise<{ conceptId: string; correct: boolean; at: string }[]> {
    const rows = await this.db.all<{ concept_id: string; correct: number; answered_at: string }>(
      'SELECT concept_id, correct, answered_at FROM quiz_answer ORDER BY answered_at DESC LIMIT 500',
    );
    return rows.map((r) => ({ conceptId: r.concept_id, correct: !!r.correct, at: r.answered_at }));
  }

  /** Mastery is the correct rate over the last five answers, with a review date for later spaced repetition. */
  private async refreshMastery(conceptId: string) {
    const rows = await this.db.all<{ correct: number }>(
      'SELECT correct FROM quiz_answer WHERE concept_id = ? ORDER BY answered_at DESC LIMIT 5',
      [conceptId],
    );
    const total = await this.db.first<{ n: number }>('SELECT count(*) AS n FROM quiz_answer WHERE concept_id = ?', [conceptId]);
    const rate = rows.length ? rows.filter((r) => r.correct).length / rows.length : 0;
    const days = rate >= 0.8 ? 7 : rate >= 0.6 ? 3 : 1;
    const now = this.now();
    const next = new Date(now.getTime() + days * 86400_000).toISOString();
    await this.db.run(
      `INSERT INTO concept_mastery VALUES (?,?,?,?,?,?)
       ON CONFLICT(concept_id) DO UPDATE SET seen_count = excluded.seen_count, correct_rate = excluded.correct_rate,
         last_practised_at = excluded.last_practised_at, next_review_at = excluded.next_review_at, updated_at = excluded.updated_at`,
      [conceptId, total?.n ?? 0, rate, now.toISOString(), next, now.toISOString()],
    );
  }

  async mastery(): Promise<Map<string, { seen: number; rate: number }>> {
    const rows = await this.db.all<{ concept_id: string; seen_count: number; correct_rate: number }>('SELECT * FROM concept_mastery');
    return new Map(rows.map((r) => [r.concept_id, { seen: r.seen_count, rate: r.correct_rate }]));
  }

  // ---- editions
  async lastIssue(): Promise<EditionIssue | null> {
    const r = await this.db.first<IssueRow>('SELECT * FROM edition_issue ORDER BY edition_number DESC LIMIT 1');
    return r ? toIssue(r) : null;
  }

  async issues(): Promise<EditionIssue[]> {
    const rows = await this.db.all<IssueRow>('SELECT * FROM edition_issue ORDER BY edition_number DESC');
    return rows.map(toIssue);
  }

  async issue(id: string): Promise<EditionIssue | null> {
    const r = await this.db.first<IssueRow>('SELECT * FROM edition_issue WHERE id = ?', [id]);
    return r ? toIssue(r) : null;
  }

  async maxTemplateUsed(): Promise<number> {
    return (await this.db.first<{ n: number | null }>('SELECT max(template_number) AS n FROM edition_issue'))?.n ?? 0;
  }

  async issuedArticleIds(): Promise<Set<string>> {
    const rows = await this.db.all<{ article_ids_json: string }>('SELECT article_ids_json FROM edition_issue');
    return new Set(rows.flatMap((r) => JSON.parse(r.article_ids_json) as string[]));
  }

  async insertIssue(i: Omit<EditionIssue, 'id' | 'issuedAt'>) {
    const id = uuid();
    await this.db.run('INSERT INTO edition_issue VALUES (?,?,?,?,?,?,?,?,?,?)', [
      id, i.editionNumber, i.issueDate, i.templateNumber, i.title, i.leadArticleId, i.leadIsLesson ? 1 : 0,
      JSON.stringify(i.articleIds), i.isBackIssue ? 1 : 0, this.ts(),
    ]);
    await this.outbox('edition_issue', id, 'insert');
    return id;
  }

  // ---- backup
  async exportAll(): Promise<Record<string, unknown[]>> {
    const out: Record<string, unknown[]> = {};
    for (const t of ['reading_state', 'reading_event', 'bookmark', 'quiz_attempt', 'quiz_answer', 'concept_mastery', 'edition_issue', 'setting']) {
      out[t] = await this.db.all(`SELECT * FROM ${t}`);
    }
    return out;
  }
}
