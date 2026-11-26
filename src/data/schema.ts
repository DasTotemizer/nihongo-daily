import type { Db } from './db';

/**
 * content.db is rebuilt from the bundled content pack whenever its version
 * changes. It holds no user data, so dropping it is always safe.
 */
export const CONTENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS category (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, name_ja TEXT NOT NULL, description TEXT NOT NULL,
  accent TEXT NOT NULL, sort_order INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS concept (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, name_ja TEXT, description TEXT NOT NULL, stage INTEGER NOT NULL,
  tk_section TEXT NOT NULL, tk_lesson TEXT NOT NULL, sort_order INTEGER NOT NULL, prereqs_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS article (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, category_id TEXT NOT NULL, stage INTEGER NOT NULL,
  difficulty INTEGER NOT NULL, reading_minutes INTEGER NOT NULL, image_id TEXT, sequence INTEGER,
  current_version INTEGER NOT NULL, headline TEXT NOT NULL, headline_ja TEXT, summary TEXT NOT NULL,
  published_at TEXT NOT NULL, related_json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS article_category ON article (category_id);
CREATE INDEX IF NOT EXISTS article_sequence ON article (kind, sequence);
CREATE TABLE IF NOT EXISTS article_version (
  article_id TEXT NOT NULL, version INTEGER NOT NULL, headline TEXT NOT NULL, headline_ja TEXT,
  summary TEXT NOT NULL, blocks_json TEXT NOT NULL, published_at TEXT NOT NULL, change_note TEXT,
  PRIMARY KEY (article_id, version));
CREATE TABLE IF NOT EXISTS article_concept (
  article_id TEXT NOT NULL, concept_id TEXT NOT NULL, role TEXT NOT NULL,
  PRIMARY KEY (article_id, concept_id));
CREATE INDEX IF NOT EXISTS article_concept_by_concept ON article_concept (concept_id);
CREATE TABLE IF NOT EXISTS quiz_question (
  id TEXT PRIMARY KEY, article_id TEXT NOT NULL, concept_id TEXT NOT NULL, sort INTEGER NOT NULL, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS edition_template (number INTEGER PRIMARY KEY, title TEXT, articles_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS image (
  id TEXT PRIMARY KEY, file TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
  alt TEXT NOT NULL, credit TEXT NOT NULL, licence TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS vocab (
  id TEXT PRIMARY KEY, written TEXT NOT NULL, reading TEXT NOT NULL, romaji TEXT NOT NULL,
  meaning TEXT NOT NULL, pos TEXT);
CREATE TABLE IF NOT EXISTS search_doc (
  article_id TEXT PRIMARY KEY, headline TEXT NOT NULL, concepts TEXT NOT NULL, category TEXT NOT NULL,
  summary TEXT NOT NULL, en TEXT NOT NULL, ja TEXT NOT NULL, terms TEXT NOT NULL);
`;

export const CONTENT_TABLES = [
  'meta', 'category', 'concept', 'article', 'article_version', 'article_concept',
  'quiz_question', 'edition_template', 'image', 'vocab', 'search_doc',
];

/**
 * user.db only ever changes through these numbered migrations. Never edit a
 * migration that has shipped; add a new one. Every user row is sync-ready:
 * stable ids plus updated_at, and soft deletes where rows can be removed.
 */
export const USER_MIGRATIONS: string[] = [
  // 1: initial schema
  `
  CREATE TABLE reading_state (
    article_id TEXT PRIMARY KEY, article_version INTEGER NOT NULL, status TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0, anchor_block INTEGER NOT NULL DEFAULT 0,
    first_opened_at TEXT NOT NULL, last_opened_at TEXT NOT NULL, completed_at TEXT,
    updated_at TEXT NOT NULL);
  CREATE TABLE reading_event (
    id TEXT PRIMARY KEY, article_id TEXT NOT NULL, article_version INTEGER NOT NULL,
    event TEXT NOT NULL, at TEXT NOT NULL);
  CREATE INDEX reading_event_at ON reading_event (at);
  CREATE TABLE bookmark (
    id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
    saved_at TEXT NOT NULL, deleted_at TEXT, updated_at TEXT NOT NULL,
    UNIQUE (target_type, target_id));
  CREATE TABLE quiz_attempt (
    id TEXT PRIMARY KEY, article_id TEXT NOT NULL, article_version INTEGER NOT NULL,
    score INTEGER NOT NULL, total INTEGER NOT NULL, started_at TEXT NOT NULL, completed_at TEXT NOT NULL);
  CREATE INDEX quiz_attempt_article ON quiz_attempt (article_id);
  CREATE TABLE quiz_answer (
    attempt_id TEXT NOT NULL, question_id TEXT NOT NULL, concept_id TEXT NOT NULL,
    given_json TEXT NOT NULL, correct INTEGER NOT NULL, answered_at TEXT NOT NULL,
    PRIMARY KEY (attempt_id, question_id));
  CREATE INDEX quiz_answer_concept ON quiz_answer (concept_id, answered_at);
  CREATE TABLE concept_mastery (
    concept_id TEXT PRIMARY KEY, seen_count INTEGER NOT NULL, correct_rate REAL NOT NULL,
    last_practised_at TEXT NOT NULL, next_review_at TEXT, updated_at TEXT NOT NULL);
  CREATE TABLE edition_issue (
    id TEXT PRIMARY KEY, edition_number INTEGER NOT NULL UNIQUE, issue_date TEXT NOT NULL UNIQUE,
    template_number INTEGER, title TEXT NOT NULL, lead_article_id TEXT, lead_is_lesson INTEGER NOT NULL,
    article_ids_json TEXT NOT NULL, is_back_issue INTEGER NOT NULL, issued_at TEXT NOT NULL);
  CREATE TABLE setting (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE sync_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, row_id TEXT NOT NULL,
    op TEXT NOT NULL, at TEXT NOT NULL);
  `,
];

export async function migrateUserDb(db: Db): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < USER_MIGRATIONS.length) {
    const sql = USER_MIGRATIONS[version];
    await db.transaction(async () => {
      await db.exec(sql);
    });
    version++;
    await db.exec(`PRAGMA user_version = ${version}`);
  }
  return version;
}
