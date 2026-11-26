/**
 * Parses one article file from /content/articles.
 *
 * File layout:
 *   ---
 *   key: value          (front matter, one per line)
 *   ---
 *   Body: "## Heading", blank-line separated paragraphs, and fenced blocks:
 *   ::: example | breakdown | vocab | dialogue | mistake | callout | quote | image | quiz
 *   ...
 *   :::
 */
import type { Article, ArticleKind, Block, Inline, QuizQuestion } from '../../src/content/types';
import { MarkupError, inlinePlain, parseInline, parseJaLine, readingOf, romajiOf, surfaceOf } from './markup';

const KINDS: ArticleKind[] = ['core', 'feature', 'vocab', 'everyday', 'japan_today', 'revision'];

function fields(lines: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z]+):\s?(.*)$/);
    if (m) map.set(m[1], m[2].trim());
  }
  return map;
}

/** Plain-text fields can't show furigana, so {漢字|かんじ} is shown as its base text. */
export function plainText(s: string): string {
  return s.replace(/\{([^|}]+)\|[^}]*\}/g, '$1');
}

function need(map: Map<string, string>, key: string, where: string): string {
  const v = map.get(key);
  if (!v) throw new MarkupError(`${where}: missing "${key}:"`);
  return v;
}

export function parseArticle(src: string, file: string): Article {
  const fm = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fm) throw new MarkupError(`${file}: missing front matter`);
  const meta = fields(fm[1].split('\n'));
  const where = file;
  const id = need(meta, 'id', where);
  const kind = need(meta, 'kind', where) as ArticleKind;
  if (!KINDS.includes(kind)) throw new MarkupError(`${where}: unknown kind "${kind}"`);

  const concepts: Article['concepts'] = [];
  for (const part of (meta.get('concepts') ?? '').split(';').map((s) => s.trim()).filter(Boolean)) {
    const [role, ...ids] = part.split(/[\s,]+/);
    if (!['teaches', 'practises', 'mentions'].includes(role)) {
      throw new MarkupError(`${where}: concepts must start with teaches/practises/mentions`);
    }
    for (const cid of ids) concepts.push({ id: cid, role: role as 'teaches' });
  }

  const quiz: QuizQuestion[] = [];
  const blocks = parseBody(fm[2], where, quiz, id);

  const headline = need(meta, 'headline', where);
  const summary = need(meta, 'summary', where);

  // Search text
  const en: string[] = [headline, summary];
  const ja: string[] = [];
  const terms: string[] = [];
  const addInline = (i: Inline) => {
    const p = inlinePlain(i);
    en.push(p.en);
    ja.push(p.ja);
    terms.push(...p.terms);
  };
  const addLine = (l: ReturnType<typeof parseJaLine>) => {
    ja.push(surfaceOf(l), readingOf(l));
    terms.push(...romajiOf(l).split(' '));
  };
  addInline(parseInline(headline, where));
  addInline(parseInline(summary, where));
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
      case 'paragraph':
      case 'callout':
        addInline(b.text);
        break;
      case 'list':
        b.items.forEach(addInline);
        break;
      case 'example':
      case 'quote':
        addLine(b.ja);
        en.push(b.en);
        break;
      case 'breakdown':
        addLine(b.ja);
        en.push(b.en);
        b.parts.forEach((p) => addInline(p.gloss));
        break;
      case 'vocab':
        b.items.forEach((it) => {
          addLine(it.ja);
          en.push(it.meaning);
        });
        break;
      case 'dialogue':
        b.lines.forEach((l) => {
          addLine(l.ja);
          en.push(l.en);
        });
        break;
      case 'mistake':
        addLine(b.right);
        addInline(b.explain);
        break;
    }
  }
  const headlineJa = meta.get('headlineJa');
  if (headlineJa) ja.push(headlineJa);

  const version = Number(meta.get('version') ?? '1');
  return {
    id,
    kind,
    category: need(meta, 'category', where),
    stage: Number(need(meta, 'stage', where)),
    difficulty: Number(meta.get('difficulty') ?? '1'),
    readingMinutes: Number(meta.get('minutes') ?? '4'),
    image: meta.get('image') || undefined,
    concepts,
    related: (meta.get('related') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    sequence: meta.has('sequence') ? Number(meta.get('sequence')) : undefined,
    current: {
      version,
      headline,
      headlineJa,
      summary,
      blocks,
      publishedAt: need(meta, 'published', where),
      changeNote: meta.get('changeNote'),
    },
    history: [],
    quiz,
    searchText: {
      en: en.join(' ').replace(/\s+/g, ' ').toLowerCase(),
      ja: ja.join(' ').replace(/\s+/g, ' '),
      terms: ' ' + Array.from(new Set(terms.filter(Boolean).map((t) => t.toLowerCase()))).join(' ') + ' ',
    },
  };
}

function parseBody(body: string, where: string, quiz: QuizQuestion[], articleId: string): Block[] {
  const blocks: Block[] = [];
  const lines = body.split('\n');
  let para: string[] = [];
  let list: string[] = [];
  let ordered = false;
  const flush = () => {
    const text = para.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', text: parseInline(text, where) });
    para = [];
    if (list.length) blocks.push({ type: 'list', items: list.map((l) => parseInline(l, where)), ...(ordered ? { ordered } : {}) });
    list = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^:::\s*(\w+)\s*$/);
    if (fence) {
      flush();
      const inner: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ':::') inner.push(lines[i++]);
      if (i >= lines.length) throw new MarkupError(`${where}: unclosed ::: ${fence[1]}`);
      blocks.push(parseFenced(fence[1], inner, `${where} (::: ${fence[1]} near line ${i})`, quiz, articleId));
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      blocks.push({ type: 'heading', text: parseInline(line.slice(3).trim(), where) });
      continue;
    }
    const item = line.match(/^(-|\d+\.)\s+(.*)$/);
    if (item) {
      if (para.length) {
        const keep = list;
        list = [];
        flush();
        list = keep;
      }
      ordered = item[1] !== '-';
      list.push(item[2]);
    } else if (line.trim() === '') flush();
    else if (list.length) list[list.length - 1] += ' ' + line.trim();
    else para.push(line.trim());
  }
  flush();
  return blocks;
}

function listItems(inner: string[]): string[] {
  return inner.filter((l) => l.trim().startsWith('- ')).map((l) => l.trim().slice(2));
}

function parseFenced(
  type: string,
  inner: string[],
  where: string,
  quiz: QuizQuestion[],
  articleId: string,
): Block {
  const f = fields(inner);
  switch (type) {
    case 'example':
      return {
        type: 'example',
        ja: parseJaLine(need(f, 'ja', where), where),
        en: plainText(need(f, 'en', where)),
        ...(f.get('note') ? { note: parseInline(f.get('note')!, where) } : {}),
      };
    case 'breakdown':
      return {
        type: 'breakdown',
        ja: parseJaLine(need(f, 'ja', where), where),
        en: plainText(need(f, 'en', where)),
        parts: listItems(inner).map((item) => {
          const [ja, gloss] = item.split(/\s=\s/);
          if (!gloss) throw new MarkupError(`${where}: breakdown items are "- word = meaning"`);
          return { ja: parseJaLine(ja, where), gloss: parseInline(gloss, where) };
        }),
      };
    case 'vocab':
      return {
        type: 'vocab',
        items: listItems(inner).map((item) => {
          const [ja, meaning, pos] = item.split(/\s+\|\s+/).map((s) => s.trim());
          if (!meaning) throw new MarkupError(`${where}: vocab items are "- word | meaning | part of speech"`);
          return { ja: parseJaLine(ja, where), meaning: plainText(meaning), ...(pos ? { pos: plainText(pos) } : {}) };
        }),
      };
    case 'dialogue':
      return {
        type: 'dialogue',
        lines: inner
          .filter((l) => l.trim())
          .map((l) => {
            const m = l.trim().match(/^([^:]+):\s*(.+?)\s*\/\/\s*(.+)$/);
            if (!m) throw new MarkupError(`${where}: dialogue lines are "Name: Japanese // English"`);
            return { speaker: plainText(m[1].trim()), ja: parseJaLine(m[2], where), en: plainText(m[3].trim()) };
          }),
      };
    case 'mistake':
      return {
        type: 'mistake',
        wrong: parseJaLine(need(f, 'wrong', where), where),
        right: parseJaLine(need(f, 'right', where), where),
        explain: parseInline(need(f, 'why', where), where),
      };
    case 'callout': {
      const title = f.get('title');
      const text = inner.filter((l) => !l.startsWith('title:')).join(' ').trim();
      return { type: 'callout', ...(title ? { title: plainText(title) } : {}), text: parseInline(text, where) };
    }
    case 'quote':
      return {
        type: 'quote',
        ja: parseJaLine(need(f, 'ja', where), where),
        en: plainText(need(f, 'en', where)),
        ...(f.get('source') ? { source: f.get('source') } : {}),
      };
    case 'image':
      return { type: 'image', image: need(f, 'id', where), ...(f.get('caption') ? { caption: f.get('caption') } : {}) };
    case 'kana': {
      const title = f.get('title');
      const rows = inner
        .filter((l) => l.trim() && !l.startsWith('title:'))
        .map((l) =>
          l.split('|').map((cell) => {
            const c = cell.trim();
            if (c === '' || c === '-') return null;
            const [k, r] = c.split(/\s+/);
            if (!r) throw new MarkupError(`${where}: kana cells are "か ka"`);
            return { k, r };
          }),
        );
      return { type: 'kana', ...(title ? { title } : {}), rows };
    }
    case 'quiz':
      return { type: 'quiz', questions: parseQuiz(inner, where, quiz, articleId) };
    default:
      throw new MarkupError(`${where}: unknown block type "${type}"`);
  }
}

function parseQuiz(inner: string[], where: string, quiz: QuizQuestion[], articleId: string): string[] {
  const groups: string[][] = [];
  for (const line of inner) {
    if (line.startsWith('? ')) groups.push([line]);
    else if (groups.length) groups[groups.length - 1].push(line);
  }
  const ids: string[] = [];
  groups.forEach((g, n) => {
    const [, type, concept] = g[0].split(/\s+/);
    const f = fields(g.slice(1));
    const id = `${articleId}-q${quiz.length + 1}`;
    const w = `${where} question ${n + 1}`;
    if (!concept) throw new MarkupError(`${w}: "? type concept-id"`);
    const prompt = parseInline(need(f, 'q', w), w);
    const why = parseInline(need(f, 'why', w), w);
    if (type === 'choice') {
      const opts = listItems(g);
      const answer = opts.findIndex((o) => o.endsWith(' *'));
      if (answer < 0) throw new MarkupError(`${w}: mark the right option with " *"`);
      quiz.push({
        id,
        type: 'choice',
        concept,
        prompt,
        ...(f.get('ja') ? { promptJa: parseJaLine(f.get('ja')!, w) } : {}),
        options: opts.map((o) => ({ label: parseInline(o.replace(/ \*$/, ''), w) })),
        answer,
        why,
      });
    } else if (type === 'order') {
      const words = need(f, 'words', w)
        .split(/\s+/)
        .map((x) => parseJaLine(x, w));
      quiz.push({ id, type: 'order', concept, prompt, words, en: plainText(need(f, 'en', w)), why });
    } else if (type === 'match') {
      const pairs = listItems(g).map((item) => {
        const [ja, en] = item.split(/\s=\s/);
        if (!en) throw new MarkupError(`${w}: match items are "- Japanese = English"`);
        return { ja: parseJaLine(ja, w), en: plainText(en.trim()) };
      });
      quiz.push({ id, type: 'match', concept, prompt, pairs, why });
    } else {
      throw new MarkupError(`${w}: unknown question type "${type}"`);
    }
    ids.push(id);
  });
  return ids;
}
