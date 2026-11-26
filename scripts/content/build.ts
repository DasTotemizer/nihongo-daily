/**
 * Compiles /content into src/generated/content-pack.json and checks it.
 * Run: npm run content
 */
import fs from 'node:fs';
import path from 'node:path';

import type { Article, Category, Concept, ContentPack, EditionTemplate, ImageAsset } from '../../src/content/types';
import { readingOf, romajiOf, surfaceOf } from './markup';
import { parseArticle } from './parse-article';

export function buildPack(root: string): { pack: ContentPack; warnings: string[] } {
  const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
  const meta = read<{ contentVersion: number }>('pack.json');
  const categories = read<Category[]>('categories.json');
  const concepts = read<Concept[]>('concepts.json');
  const editions = read<EditionTemplate[]>('editions.json');
  const images = read<ImageAsset[]>('images.json');

  const errors: string[] = [];
  const warnings: string[] = [];
  const articleDir = path.join(root, 'articles');
  const articles: Article[] = [];
  for (const file of fs.readdirSync(articleDir).filter((f) => f.endsWith('.md')).sort()) {
    try {
      articles.push(parseArticle(fs.readFileSync(path.join(articleDir, file), 'utf8'), `articles/${file}`));
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  // Earlier versions: content/articles/history/<id>@<version>.md
  const historyDir = path.join(articleDir, 'history');
  if (fs.existsSync(historyDir)) {
    for (const file of fs.readdirSync(historyDir).filter((f) => f.endsWith('.md'))) {
      try {
        const old = parseArticle(fs.readFileSync(path.join(historyDir, file), 'utf8'), `history/${file}`);
        const cur = articles.find((a) => a.id === old.id);
        if (!cur) errors.push(`history/${file}: no current article "${old.id}"`);
        else cur.history.push(old.current);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
  }

  const byId = new Map(articles.map((a) => [a.id, a]));
  const conceptIds = new Set(concepts.map((c) => c.id));
  const categoryIds = new Set(categories.map((c) => c.id));
  const imageIds = new Set(images.map((i) => i.id));

  if (byId.size !== articles.length) errors.push('Duplicate article ids');
  for (const c of concepts) {
    for (const p of c.prereqs) if (!conceptIds.has(p)) errors.push(`concept ${c.id}: unknown prereq ${p}`);
  }
  for (const img of images) {
    if (!fs.existsSync(path.join(root, '..', img.file))) errors.push(`image ${img.id}: missing file ${img.file}`);
  }

  for (const a of articles) {
    const w = `article ${a.id}`;
    if (!categoryIds.has(a.category)) errors.push(`${w}: unknown category ${a.category}`);
    if (a.image && !imageIds.has(a.image)) errors.push(`${w}: unknown image ${a.image}`);
    for (const c of a.concepts) if (!conceptIds.has(c.id)) errors.push(`${w}: unknown concept ${c.id}`);
    for (const r of a.related) if (!byId.has(r)) errors.push(`${w}: unknown related article ${r}`);
    for (const q of a.quiz) if (!conceptIds.has(q.concept)) errors.push(`${w}: quiz concept ${q.concept} unknown`);
    for (const b of a.current.blocks) {
      if (b.type === 'image' && !imageIds.has(b.image)) errors.push(`${w}: unknown inline image ${b.image}`);
    }
    if (a.kind === 'core') {
      if (a.sequence === undefined) errors.push(`${w}: core articles need "sequence:"`);
      if (a.quiz.length === 0) errors.push(`${w}: core articles need a quiz`);
      if (!a.concepts.some((c) => c.role === 'teaches')) errors.push(`${w}: core articles must teach a concept`);
    }
    for (const h of a.history) {
      if (h.version >= a.current.version) errors.push(`${w}: history version ${h.version} is not older than current`);
    }
  }

  // Prerequisite order: every prereq of a taught concept is taught by an earlier core lesson.
  const taughtAt = new Map<string, number>();
  for (const a of articles.filter((x) => x.kind === 'core')) {
    for (const c of a.concepts.filter((x) => x.role === 'teaches')) {
      const prev = taughtAt.get(c.id);
      if (prev === undefined || a.sequence! < prev) taughtAt.set(c.id, a.sequence!);
    }
  }
  const conceptById = new Map(concepts.map((c) => [c.id, c]));
  for (const [cid, seq] of taughtAt) {
    for (const p of conceptById.get(cid)?.prereqs ?? []) {
      const pseq = taughtAt.get(p);
      if (pseq === undefined) warnings.push(`concept ${cid} needs ${p}, which no core lesson teaches yet`);
      else if (pseq > seq) errors.push(`concept ${cid} (lesson ${seq}) is taught before its prereq ${p} (lesson ${pseq})`);
    }
  }

  const usedInEditions = new Set<string>();
  editions.forEach((e, i) => {
    if (e.number !== i + 1) errors.push(`editions.json: edition ${e.number} out of order`);
    for (const id of e.articles) {
      const a = byId.get(id);
      if (!a) errors.push(`edition ${e.number}: unknown article ${id}`);
      else if (a.kind === 'core') errors.push(`edition ${e.number}: ${id} is a core lesson; lessons are placed by progress, not editions`);
      if (usedInEditions.has(id)) errors.push(`edition ${e.number}: ${id} already appears in an earlier edition`);
      usedInEditions.add(id);
    }
  });
  for (const a of articles) {
    if (a.kind !== 'core' && !usedInEditions.has(a.id)) warnings.push(`article ${a.id} is not in any edition yet`);
  }

  if (errors.length) {
    throw new Error('Content has errors:\n  - ' + errors.join('\n  - '));
  }

  // Vocabulary table from vocab blocks.
  const vocab = new Map<string, ContentPack['vocab'][number]>();
  for (const a of articles) {
    for (const b of a.current.blocks) {
      if (b.type !== 'vocab') continue;
      for (const it of b.items) {
        const written = surfaceOf(it.ja);
        const formLabel = it.pos && /^(present|negative|past|past negative|statement|polite|plain)$/.test(it.pos);
        if (formLabel || written.includes("→") || it.ja.length > 3) continue; // conjugation charts and phrases, not words
        const id = written;
        if (!vocab.has(id)) {
          vocab.set(id, { id, written, reading: readingOf(it.ja), romaji: romajiOf(it.ja), meaning: it.meaning, pos: it.pos });
        }
      }
    }
  }

  return {
    pack: {
      contentVersion: meta.contentVersion,
      builtAt: new Date().toISOString(),
      categories: [...categories].sort((a, b) => a.order - b.order),
      concepts: [...concepts].sort((a, b) => a.order - b.order),
      articles,
      editions,
      images,
      vocab: [...vocab.values()],
    },
    warnings,
  };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../../content');
  try {
    const { pack, warnings } = buildPack(root);
    const out = path.resolve(__dirname, '../../src/generated/content-pack.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(pack));
    // Static require() map so Metro bundles every cover image.
    const imgs = pack.images
      .map((i) => `  ${JSON.stringify(i.id)}: require(${JSON.stringify('../../' + i.file)}),`)
      .join('\n');
    fs.writeFileSync(
      path.resolve(__dirname, '../../src/generated/images.ts'),
      `// Generated by scripts/content/build.ts. Do not edit.\n/* eslint-disable */\nexport const IMAGES: Record<string, number> = {\n${imgs}\n};\n`,
    );
    for (const w of warnings) console.warn('warning:', w);
    const core = pack.articles.filter((a) => a.kind === 'core').length;
    console.log(
      `Built content v${pack.contentVersion}: ${pack.articles.length} articles (${core} core lessons), ` +
        `${pack.editions.length} editions, ${pack.concepts.length} concepts, ${pack.vocab.length} words.`,
    );
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
