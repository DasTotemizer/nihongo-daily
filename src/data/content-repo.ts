import type { ArticleKind, Block, QuizQuestion } from '@/content/types';
import type { LessonInfo } from '@/domain/publisher';

import type { Db } from './db';

export interface ArticleCard {
  id: string;
  kind: ArticleKind;
  categoryId: string;
  categoryName: string;
  accent: string;
  headline: string;
  headlineJa: string | null;
  summary: string;
  readingMinutes: number;
  difficulty: number;
  stage: number;
  imageId: string | null;
  sequence: number | null;
  version: number;
}

export interface ArticleFull extends ArticleCard {
  blocks: Block[];
  quiz: QuizQuestion[];
  related: string[];
  concepts: { id: string; name: string; nameJa: string | null; role: string }[];
  publishedAt: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  nameJa: string;
  description: string;
  accent: string;
}

export interface ConceptRow {
  id: string;
  name: string;
  nameJa: string | null;
  description: string;
  stage: number;
  taeKimSection: string;
  taeKimLesson: string;
  prereqs: string[];
}

const CARD_SQL = `
SELECT a.id, a.kind, a.category_id AS categoryId, c.name AS categoryName, c.accent, a.headline,
  a.headline_ja AS headlineJa, a.summary, a.reading_minutes AS readingMinutes, a.difficulty, a.stage,
  a.image_id AS imageId, a.sequence, a.current_version AS version
FROM article a JOIN category c ON c.id = a.category_id`;

export class ContentRepo {
  constructor(private db: Db) {}

  async cards(ids: string[]): Promise<ArticleCard[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.all<ArticleCard>(
      `${CARD_SQL} WHERE a.id IN (${ids.map(() => '?').join(',')})`,
      ids,
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((x): x is ArticleCard => !!x);
  }

  async card(id: string): Promise<ArticleCard | null> {
    return (await this.cards([id]))[0] ?? null;
  }

  async article(id: string, version?: number): Promise<ArticleFull | null> {
    const card = await this.card(id);
    if (!card) return null;
    const v = await this.db.first<{ headline: string; headline_ja: string | null; summary: string; blocks_json: string; published_at: string; version: number }>(
      'SELECT * FROM article_version WHERE article_id = ? AND version = ?',
      [id, version ?? card.version],
    );
    if (!v) return null;
    const quiz = await this.db.all<{ json: string }>('SELECT json FROM quiz_question WHERE article_id = ? ORDER BY sort', [id]);
    const rel = await this.db.first<{ related_json: string }>('SELECT related_json FROM article WHERE id = ?', [id]);
    const concepts = await this.db.all<{ id: string; name: string; nameJa: string | null; role: string }>(
      `SELECT c.id, c.name, c.name_ja AS nameJa, ac.role FROM article_concept ac JOIN concept c ON c.id = ac.concept_id
       WHERE ac.article_id = ? ORDER BY CASE ac.role WHEN 'teaches' THEN 0 WHEN 'practises' THEN 1 ELSE 2 END, c.sort_order`,
      [id],
    );
    return {
      ...card,
      headline: v.headline,
      headlineJa: v.headline_ja,
      summary: v.summary,
      version: v.version,
      blocks: JSON.parse(v.blocks_json),
      quiz: quiz.map((q) => JSON.parse(q.json)),
      related: JSON.parse(rel?.related_json ?? '[]'),
      concepts,
      publishedAt: v.published_at,
    };
  }

  async lessons(): Promise<LessonInfo[]> {
    const rows = await this.db.all<{ id: string; sequence: number; stage: number; teaches: string | null }>(
      `SELECT a.id, a.sequence, a.stage, group_concat(ac.concept_id) AS teaches FROM article a
       LEFT JOIN article_concept ac ON ac.article_id = a.id AND ac.role = 'teaches'
       WHERE a.kind = 'core' GROUP BY a.id ORDER BY a.sequence`,
    );
    return rows.map((r) => ({ id: r.id, sequence: r.sequence, stage: r.stage, teaches: r.teaches ? r.teaches.split(',') : [] }));
  }

  async prereqs(): Promise<Map<string, string[]>> {
    const rows = await this.db.all<{ id: string; prereqs_json: string }>('SELECT id, prereqs_json FROM concept');
    return new Map(rows.map((r) => [r.id, JSON.parse(r.prereqs_json)]));
  }

  async templateCount(): Promise<number> {
    return (await this.db.first<{ n: number }>('SELECT count(*) AS n FROM edition_template'))?.n ?? 0;
  }

  async template(n: number): Promise<{ title: string | null; articles: string[] } | null> {
    const r = await this.db.first<{ title: string | null; articles_json: string }>('SELECT * FROM edition_template WHERE number = ?', [n]);
    return r ? { title: r.title, articles: JSON.parse(r.articles_json) } : null;
  }

  async categories(): Promise<CategoryRow[]> {
    return this.db.all<CategoryRow>(
      'SELECT id, name, name_ja AS nameJa, description, accent FROM category ORDER BY sort_order',
    );
  }

  async category(id: string): Promise<CategoryRow | null> {
    return this.db.first<CategoryRow>('SELECT id, name, name_ja AS nameJa, description, accent FROM category WHERE id = ?', [id]);
  }

  /** Every article in a category, lessons in curriculum order, others newest first. */
  async inCategory(id: string): Promise<ArticleCard[]> {
    return this.db.all<ArticleCard>(`${CARD_SQL} WHERE a.category_id = ? ORDER BY a.stage, coalesce(a.sequence, 9999), a.published_at DESC`, [id]);
  }

  async countsByCategory(): Promise<Map<string, number>> {
    const rows = await this.db.all<{ id: string; n: number }>('SELECT category_id AS id, count(*) AS n FROM article GROUP BY category_id');
    return new Map(rows.map((r) => [r.id, r.n]));
  }

  async allCards(): Promise<ArticleCard[]> {
    return this.db.all<ArticleCard>(`${CARD_SQL} ORDER BY a.stage, coalesce(a.sequence, 9999)`);
  }

  async concept(id: string): Promise<ConceptRow | null> {
    const r = await this.db.first<ConceptRow & { prereqs_json: string }>(
      `SELECT id, name, name_ja AS nameJa, description, stage, tk_section AS taeKimSection, tk_lesson AS taeKimLesson, prereqs_json
       FROM concept WHERE id = ?`,
      [id],
    );
    return r ? { ...r, prereqs: JSON.parse(r.prereqs_json) } : null;
  }

  async concepts(): Promise<ConceptRow[]> {
    const rows = await this.db.all<ConceptRow & { prereqs_json: string }>(
      `SELECT id, name, name_ja AS nameJa, description, stage, tk_section AS taeKimSection, tk_lesson AS taeKimLesson, prereqs_json
       FROM concept ORDER BY sort_order`,
    );
    return rows.map((r) => ({ ...r, prereqs: JSON.parse(r.prereqs_json) }));
  }

  async articlesForConcept(conceptId: string): Promise<(ArticleCard & { role: string })[]> {
    return this.db.all(
      `${CARD_SQL} JOIN article_concept ac ON ac.article_id = a.id WHERE ac.concept_id = ?
       ORDER BY CASE ac.role WHEN 'teaches' THEN 0 WHEN 'practises' THEN 1 ELSE 2 END, coalesce(a.sequence, 9999)`,
      [conceptId],
    );
  }

  /** Articles that practise or teach a concept, other than core lessons first. */
  async revisionFor(conceptId: string): Promise<string[]> {
    const rows = await this.db.all<{ id: string }>(
      `SELECT a.id FROM article a JOIN article_concept ac ON ac.article_id = a.id
       WHERE ac.concept_id = ? AND ac.role IN ('teaches','practises')
       ORDER BY CASE a.kind WHEN 'revision' THEN 0 WHEN 'feature' THEN 1 WHEN 'core' THEN 3 ELSE 2 END`,
      [conceptId],
    );
    return rows.map((r) => r.id);
  }

  async image(id: string): Promise<{ id: string; width: number; height: number; alt: string; credit: string } | null> {
    return this.db.first('SELECT id, width, height, alt, credit FROM image WHERE id = ?', [id]);
  }

  async contentVersion(): Promise<number> {
    const r = await this.db.first<{ value: string }>("SELECT value FROM meta WHERE key = 'content_version'");
    return Number(r?.value ?? 0);
  }

  /**
   * Weighted search across every article, archived or not. Headlines count most,
   * then concepts and categories, summaries, and finally body text. Japanese is
   * matched on surface text and kana readings; romaji only matches whole words,
   * so "wa" finds the は lesson without matching "water".
   */
  async search(query: string, limit = 40): Promise<{ id: string; score: number }[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const isLatin = /^[a-z0-9\s'-]+$/.test(q);
    // Light stemming so "particles" finds "particle".
    const stem = isLatin && q.length > 3 && q.endsWith('s') && !q.endsWith('ss') ? q.slice(0, -1) : q;
    const like = `%${stem}%`;
    const word = `% ${q} %`;
    const rows = await this.db.all<{ id: string; score: number }>(
      `SELECT article_id AS id,
         (CASE WHEN headline LIKE ? THEN 10 ELSE 0 END) +
         (CASE WHEN concepts LIKE ? THEN 6 ELSE 0 END) +
         (CASE WHEN category LIKE ? THEN 5 ELSE 0 END) +
         (CASE WHEN summary LIKE ? THEN 4 ELSE 0 END) +
         (CASE WHEN ${isLatin ? 'terms LIKE ?' : 'ja LIKE ?'} THEN 3 ELSE 0 END) +
         (CASE WHEN en LIKE ? THEN 1 ELSE 0 END) AS score
       FROM search_doc WHERE score > 0 ORDER BY score DESC LIMIT ?`,
      [like, like, like, like, isLatin ? word : like, like, limit],
    );
    return rows;
  }

  async searchConcepts(q: string): Promise<ConceptRow[]> {
    const like = `%${q}%`;
    const rows = await this.db.all<ConceptRow & { prereqs_json: string }>(
      `SELECT id, name, name_ja AS nameJa, description, stage, tk_section AS taeKimSection, tk_lesson AS taeKimLesson, prereqs_json
       FROM concept WHERE lower(name) LIKE ? OR name_ja LIKE ? OR lower(description) LIKE ? ORDER BY sort_order LIMIT 8`,
      [like, like, like],
    );
    return rows.map((r) => ({ ...r, prereqs: JSON.parse(r.prereqs_json) }));
  }

  async searchVocab(q: string): Promise<{ id: string; written: string; reading: string; romaji: string; meaning: string }[]> {
    const like = `%${q}%`;
    return this.db.all(
      `SELECT id, written, reading, romaji, meaning FROM vocab
       WHERE written LIKE ? OR reading LIKE ? OR romaji = ? OR lower(meaning) LIKE ?
       ORDER BY (written = ? OR reading = ? OR romaji = ?) DESC, length(written) LIMIT 12`,
      [like, like, q, like, q, q, q],
    );
  }
}

