/**
 * Content model shared by the content build script and the app.
 * Content is authored in /content and compiled into a ContentPack (JSON),
 * which the app loads into content.db. Nothing here is user state.
 */

/** One piece of a Japanese word: a base string with an optional reading (furigana). */
export interface RubySegment {
  /** Base text as written, e.g. "学生" or "べる". */
  b: string;
  /** Reading in kana, only present when the base contains kanji. */
  r?: string;
}

/** One Japanese word (or punctuation mark) in a sentence. */
export interface JaToken {
  /** Segments that make up the word, e.g. [{b:"食",r:"た"},{b:"べる"}]. */
  s: RubySegment[];
  /** Romaji for the whole token (absent for punctuation). */
  rm?: string;
  /** Optional link to a vocab entry, used by tap-to-translate later. */
  v?: string;
  /** True for punctuation, which takes no spacing in romaji. */
  p?: boolean;
}

export type JaLine = JaToken[];

/** Inline run inside an English paragraph. */
export type InlineRun =
  | { k: 'text'; t: string; bold?: boolean; italic?: boolean }
  | { k: 'ja'; tokens: JaLine; bold?: boolean };

export type Inline = InlineRun[];

export type QuizQuestion =
  | {
      id: string;
      type: 'choice';
      concept: string;
      prompt: Inline;
      promptJa?: JaLine;
      options: { label: Inline; ja?: JaLine }[];
      answer: number;
      why: Inline;
    }
  | {
      id: string;
      type: 'order';
      concept: string;
      prompt: Inline;
      /** Tokens in the correct order; shuffled at runtime. */
      words: JaLine[];
      en: string;
      why: Inline;
    }
  | {
      id: string;
      type: 'match';
      concept: string;
      prompt: Inline;
      pairs: { ja: JaLine; en: string }[];
      why: Inline;
    };

export type Block =
  | { type: 'heading'; text: Inline }
  | { type: 'paragraph'; text: Inline }
  | { type: 'list'; items: Inline[]; ordered?: boolean }
  | { type: 'example'; ja: JaLine; en: string; note?: Inline }
  | { type: 'breakdown'; ja: JaLine; en: string; parts: { ja: JaLine; gloss: Inline }[] }
  | { type: 'vocab'; items: { ja: JaLine; meaning: string; pos?: string }[] }
  | { type: 'dialogue'; lines: { speaker: string; ja: JaLine; en: string }[] }
  | { type: 'mistake'; wrong: JaLine; right: JaLine; explain: Inline }
  | { type: 'callout'; title?: string; text: Inline }
  | { type: 'quote'; ja: JaLine; en: string; source?: string }
  | { type: 'image'; image: string; caption?: string }
  /** A grid of kana with romaji; empty cells are null. */
  | { type: 'kana'; title?: string; rows: ({ k: string; r: string } | null)[][] }
  | { type: 'quiz'; questions: string[] };

export type ArticleKind = 'core' | 'feature' | 'vocab' | 'everyday' | 'japan_today' | 'revision';

export interface ArticleVersion {
  version: number;
  headline: string;
  headlineJa?: string;
  summary: string;
  blocks: Block[];
  publishedAt: string; // ISO date the version was written
  changeNote?: string;
}

export interface Article {
  id: string;
  kind: ArticleKind;
  category: string;
  stage: number;
  difficulty: number; // 1–5
  readingMinutes: number;
  image?: string;
  /** Concepts this article teaches (core lessons), practises or mentions. */
  concepts: { id: string; role: 'teaches' | 'practises' | 'mentions' }[];
  related: string[];
  /** For core lessons: order within the curriculum (lower comes first). */
  sequence?: number;
  current: ArticleVersion;
  /** Earlier versions kept so reading history stays meaningful. */
  history: ArticleVersion[];
  quiz: QuizQuestion[];
  /** Plain text used for search (headline, summary, body, Japanese, readings). */
  searchText: { en: string; ja: string; terms: string };
}

export interface Concept {
  id: string;
  name: string;
  nameJa?: string;
  description: string;
  stage: number;
  taeKimSection: string;
  taeKimLesson: string;
  taeKimUrl?: string;
  prereqs: string[];
  order: number;
}

export interface Category {
  id: string;
  name: string;
  nameJa: string;
  description: string;
  accent: string; // hex used only for the category label
  order: number;
}

export interface EditionTemplate {
  number: number;
  title?: string;
  /** Supporting article ids, in display order. The first is the lead for back issues. */
  articles: string[];
}

export interface ImageAsset {
  id: string;
  file: string;
  width: number;
  height: number;
  alt: string;
  credit: string;
  licence: string;
}

export interface ContentPack {
  contentVersion: number;
  builtAt: string;
  categories: Category[];
  concepts: Concept[];
  articles: Article[];
  editions: EditionTemplate[];
  images: ImageAsset[];
  vocab: { id: string; written: string; reading: string; romaji: string; meaning: string; pos?: string }[];
}
