import type { ContentRepo } from '@/data/content-repo';
import type { EditionIssue, Settings, UserRepo } from '@/data/user-repo';

import { issueDateFor } from './dates';
import { editionTitle, nextLesson, planIssues, weakConcepts, type LessonInfo } from './publisher';

/** Most supporting pieces an edition takes from the "waiting" pile. */
const MAX_HELD_PER_EDITION = 2;

export async function lessonSkips(content: ContentRepo, settings: Settings): Promise<Set<string>> {
  if (settings.startingPoint !== 'kana') return new Set();
  const lessons = await content.lessons();
  return new Set(lessons.filter((l) => l.stage === 1).map((l) => l.id));
}

async function progress(content: ContentRepo, user: UserRepo, settings: Settings) {
  const [lessons, read, prereqs, skipped] = await Promise.all([
    content.lessons(),
    user.readIds(),
    content.prereqs(),
    lessonSkips(content, settings),
  ]);
  const done = (l: LessonInfo) => read.has(l.id) || skipped.has(l.id);
  const covered = new Set(lessons.filter(done).flatMap((l) => l.teaches));
  const taughtSomewhere = new Set(lessons.flatMap((l) => l.teaches));
  return { lessons, read, prereqs, skipped, covered, taughtSomewhere };
}

export async function currentNextLesson(content: ContentRepo, user: UserRepo, settings: Settings): Promise<LessonInfo | null> {
  const { lessons, read, prereqs, skipped } = await progress(content, user, settings);
  return nextLesson({ lessons, read, prereqs, skipped });
}

/**
 * Issues any editions that are due (back issues for missed days, then today's).
 * Safe to call on every app start and every time the app comes to the foreground.
 *
 * Supporting pieces only appear once the reader has met the grammar they use:
 * a piece that is not ready yet waits, and joins a later edition when it is.
 */
export async function issueDueEditions(content: ContentRepo, user: UserRepo, settings: Settings, now: Date): Promise<EditionIssue[]> {
  const today = issueDateFor(now);
  const last = await user.lastIssue();
  const maxTemplate = await user.maxTemplateUsed();
  const plan = planIssues({
    today,
    last: last ? { editionNumber: last.editionNumber, issueDate: last.issueDate } : null,
    nextTemplate: maxTemplate + 1,
    templateCount: await content.templateCount(),
  });
  if (plan.length === 0) return [];

  const { lessons, read, prereqs, skipped, covered, taughtSomewhere } = await progress(content, user, settings);
  const lesson = nextLesson({ lessons, read, prereqs, skipped });
  const weak = weakConcepts(await user.recentAnswers());
  const issued = await user.issuedArticleIds();

  // Pieces from templates already used that were held back because the reader was not ready.
  const held: string[] = [];
  for (let n = 1; n <= maxTemplate; n++) {
    for (const id of (await content.template(n))?.articles ?? []) if (!issued.has(id)) held.push(id);
  }

  const isReady = async (ids: string[]) => {
    const needs = await content.practised(ids);
    return ids.filter((id) => (needs.get(id) ?? []).every((c) => covered.has(c) || !taughtSomewhere.has(c)));
  };

  const created: EditionIssue[] = [];
  let number = last?.editionNumber ?? 0;

  for (const p of plan) {
    const template = p.templateNumber ? await content.template(p.templateNumber) : null;
    const fresh = template ? template.articles.filter((id) => !issued.has(id)) : [];
    const ready = await isReady(fresh);
    held.push(...fresh.filter((id) => !ready.includes(id)));
    let ids = [...ready];
    let leadId: string | null = null;
    let leadIsLesson = false;

    if (p.isBackIssue) {
      if (ids.length === 0) continue; // nothing ready for this day: no empty back issue
      leadId = ids[0];
    } else {
      // Held pieces that are ready now.
      const nowReady = (await isReady(held)).filter((id) => !ids.includes(id)).slice(0, MAX_HELD_PER_EDITION);
      ids.push(...nowReady);
      for (const id of nowReady) held.splice(held.indexOf(id), 1);

      if (lesson) {
        leadId = lesson.id;
        leadIsLesson = true;
        ids = [lesson.id, ...ids.filter((id) => id !== lesson.id)];
      }
      // One revision piece for the weakest concept, if there is one worth reading.
      for (const c of weak.slice(0, 1)) {
        const pick = (await content.revisionFor(c)).find((id) => !ids.includes(id) && id !== lesson?.id);
        if (pick) ids.splice(Math.min(ids.length, 2), 0, pick);
      }
      // Out of fresh content: bring back unread pieces from earlier editions.
      if (!template) {
        const earlier = await user.issues();
        const unread = earlier
          .flatMap((e) => e.articleIds)
          .filter((id, i, all) => all.indexOf(id) === i && !read.has(id) && !ids.includes(id));
        ids.push(...unread.slice(0, 4));
      }
      if (!leadId) leadId = ids[0] ?? null;
    }

    const issue = {
      editionNumber: ++number,
      issueDate: p.issueDate,
      templateNumber: p.templateNumber,
      title: editionTitle(p.issueDate, template?.title),
      leadArticleId: leadId,
      leadIsLesson,
      articleIds: ids,
      isBackIssue: p.isBackIssue,
    };
    const id = await user.insertIssue(issue);
    ids.forEach((a) => issued.add(a));
    created.push({ ...issue, id, issuedAt: now.toISOString() });
  }
  return created;
}
