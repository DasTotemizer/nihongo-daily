import type { ContentRepo } from '@/data/content-repo';
import type { EditionIssue, Settings, UserRepo } from '@/data/user-repo';

import { issueDateFor } from './dates';
import { editionTitle, nextLesson, planIssues, weakConcepts, type LessonInfo } from './publisher';

export async function lessonSkips(content: ContentRepo, settings: Settings): Promise<Set<string>> {
  if (settings.startingPoint !== 'kana') return new Set();
  const lessons = await content.lessons();
  return new Set(lessons.filter((l) => l.stage === 1).map((l) => l.id));
}

export async function currentNextLesson(content: ContentRepo, user: UserRepo, settings: Settings): Promise<LessonInfo | null> {
  const [lessons, read, prereqs, skipped] = await Promise.all([
    content.lessons(),
    user.readIds(),
    content.prereqs(),
    lessonSkips(content, settings),
  ]);
  return nextLesson({ lessons, read, prereqs, skipped });
}

/**
 * Issues any editions that are due (back issues for missed days, then today's).
 * Safe to call on every app start and every time the app comes to the foreground.
 */
export async function issueDueEditions(content: ContentRepo, user: UserRepo, settings: Settings, now: Date): Promise<EditionIssue[]> {
  const today = issueDateFor(now);
  const last = await user.lastIssue();
  const plan = planIssues({
    today,
    last: last ? { editionNumber: last.editionNumber, issueDate: last.issueDate } : null,
    nextTemplate: (await user.maxTemplateUsed()) + 1,
    templateCount: await content.templateCount(),
  });
  if (plan.length === 0) return [];

  const lesson = await currentNextLesson(content, user, settings);
  const read = await user.readIds();
  const weak = weakConcepts(await user.recentAnswers());
  const created: EditionIssue[] = [];

  for (const p of plan) {
    const template = p.templateNumber ? await content.template(p.templateNumber) : null;
    let ids = template ? [...template.articles] : [];
    let leadId: string | null = null;
    let leadIsLesson = false;

    if (p.isBackIssue) {
      leadId = ids[0] ?? null;
    } else {
      if (lesson) {
        leadId = lesson.id;
        leadIsLesson = true;
        ids = [lesson.id, ...ids.filter((id) => id !== lesson.id)];
      }
      // One revision piece for the weakest concept, if there is one worth reading.
      for (const c of weak.slice(0, 1)) {
        const pick = (await content.revisionFor(c)).find((id) => !ids.includes(id));
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
      editionNumber: p.editionNumber,
      issueDate: p.issueDate,
      templateNumber: p.templateNumber,
      title: editionTitle(p.issueDate, template?.title),
      leadArticleId: leadId,
      leadIsLesson,
      articleIds: ids,
      isBackIssue: p.isBackIssue,
    };
    const id = await user.insertIssue(issue);
    created.push({ ...issue, id, issuedAt: now.toISOString() });
  }
  return created;
}
