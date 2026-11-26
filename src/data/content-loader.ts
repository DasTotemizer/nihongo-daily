import type { ContentPack } from '@/content/types';

import type { Db } from './db';
import { CONTENT_SCHEMA, CONTENT_TABLES } from './schema';

/**
 * Loads a content pack into content.db if it is not already there.
 * Returns true when content was (re)loaded.
 */
export async function ensureContent(db: Db, pack: ContentPack): Promise<boolean> {
  await db.exec(CONTENT_SCHEMA);
  const stamp = `${pack.contentVersion}:${pack.builtAt}`;
  const cur = await db.first<{ value: string }>("SELECT value FROM meta WHERE key = 'stamp'");
  if (cur?.value === stamp) return false;

  await db.transaction(async () => {
    for (const t of CONTENT_TABLES) await db.exec(`DELETE FROM ${t}`);
    for (const c of pack.categories) {
      await db.run('INSERT INTO category VALUES (?,?,?,?,?,?)', [c.id, c.name, c.nameJa, c.description, c.accent, c.order]);
    }
    for (const c of pack.concepts) {
      await db.run('INSERT INTO concept VALUES (?,?,?,?,?,?,?,?,?)', [
        c.id, c.name, c.nameJa ?? null, c.description, c.stage, c.taeKimSection, c.taeKimLesson, c.order,
        JSON.stringify(c.prereqs),
      ]);
    }
    const conceptName = new Map(pack.concepts.map((c) => [c.id, `${c.name} ${c.nameJa ?? ''}`]));
    const categoryName = new Map(pack.categories.map((c) => [c.id, `${c.name} ${c.nameJa}`]));
    for (const a of pack.articles) {
      const v = a.current;
      await db.run('INSERT INTO article VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        a.id, a.kind, a.category, a.stage, a.difficulty, a.readingMinutes, a.image ?? null, a.sequence ?? null,
        v.version, v.headline, v.headlineJa ?? null, v.summary, v.publishedAt, JSON.stringify(a.related),
      ]);
      for (const ver of [v, ...a.history]) {
        await db.run('INSERT INTO article_version VALUES (?,?,?,?,?,?,?,?)', [
          a.id, ver.version, ver.headline, ver.headlineJa ?? null, ver.summary, JSON.stringify(ver.blocks),
          ver.publishedAt, ver.changeNote ?? null,
        ]);
      }
      for (const c of a.concepts) {
        await db.run('INSERT OR IGNORE INTO article_concept VALUES (?,?,?)', [a.id, c.id, c.role]);
      }
      for (let i = 0; i < a.quiz.length; i++) {
        const q = a.quiz[i];
        await db.run('INSERT INTO quiz_question VALUES (?,?,?,?,?)', [q.id, a.id, q.concept, i, JSON.stringify(q)]);
      }
      await db.run('INSERT INTO search_doc VALUES (?,?,?,?,?,?,?,?)', [
        a.id,
        `${v.headline} ${v.headlineJa ?? ''}`.toLowerCase(),
        a.concepts.map((c) => conceptName.get(c.id) ?? '').join(' ').toLowerCase(),
        (categoryName.get(a.category) ?? '').toLowerCase(),
        v.summary.toLowerCase(),
        a.searchText.en,
        a.searchText.ja,
        a.searchText.terms,
      ]);
    }
    for (const e of pack.editions) {
      await db.run('INSERT INTO edition_template VALUES (?,?,?)', [e.number, e.title ?? null, JSON.stringify(e.articles)]);
    }
    for (const i of pack.images) {
      await db.run('INSERT INTO image VALUES (?,?,?,?,?,?,?)', [i.id, i.file, i.width, i.height, i.alt, i.credit, i.licence]);
    }
    for (const w of pack.vocab) {
      await db.run('INSERT OR IGNORE INTO vocab VALUES (?,?,?,?,?,?)', [w.id, w.written, w.reading, w.romaji, w.meaning, w.pos ?? null]);
    }
    await db.run("INSERT INTO meta VALUES ('stamp', ?)", [stamp]);
    await db.run("INSERT INTO meta VALUES ('content_version', ?)", [String(pack.contentVersion)]);
  });
  return true;
}
