/**
 * The daily publishing rules, as pure functions with no database or clock.
 *
 * Editions follow the calendar; lessons follow the reader.
 * - Every calendar day gets an edition, issued lazily the next time the app opens.
 * - Missed days (at most MAX_BACK_ISSUES of them) become back issues in the archive.
 *   They carry supporting pieces only, never lessons, so lessons never pile up.
 * - Today's edition is led by the reader's next unread core lesson.
 * - Issue dates only move forward: winding the clock back issues nothing.
 */
import { addDays, daysBetween, weekday, type IsoDate } from './dates';

export const MAX_BACK_ISSUES = 7;

export interface LastIssue {
  editionNumber: number;
  issueDate: IsoDate;
}

export interface PlannedIssue {
  editionNumber: number;
  issueDate: IsoDate;
  isBackIssue: boolean;
  /** Edition template to draw supporting pieces from, or null if templates have run out. */
  templateNumber: number | null;
}

export function planIssues(args: {
  today: IsoDate;
  last: LastIssue | null;
  /** Number of the next unused edition template (1-based). */
  nextTemplate: number;
  templateCount: number;
}): PlannedIssue[] {
  const { today, last, templateCount } = args;
  let nextTemplate = args.nextTemplate;
  const takeTemplate = () => (nextTemplate <= templateCount ? nextTemplate++ : null);

  if (!last) {
    return [{ editionNumber: 1, issueDate: today, isBackIssue: false, templateNumber: takeTemplate() }];
  }
  if (daysBetween(last.issueDate, today) <= 0) return [];

  const issues: PlannedIssue[] = [];
  let number = last.editionNumber;
  const gap = daysBetween(last.issueDate, today) - 1; // days with no edition
  const backDays = Math.min(gap, MAX_BACK_ISSUES);
  for (let i = backDays; i >= 1; i--) {
    const templateNumber = takeTemplate();
    // A back issue with nothing in it is not worth printing.
    if (templateNumber === null) continue;
    issues.push({ editionNumber: ++number, issueDate: addDays(today, -i), isBackIssue: true, templateNumber });
  }
  issues.push({ editionNumber: ++number, issueDate: today, isBackIssue: false, templateNumber: takeTemplate() });
  return issues;
}

export interface LessonInfo {
  id: string;
  sequence: number;
  stage: number;
  teaches: string[];
}

/**
 * The next core lesson: the first unread lesson (by curriculum order) whose
 * prerequisite concepts have all been taught by lessons already read.
 * Concepts that no lesson teaches yet do not block anything.
 */
export function nextLesson(args: {
  lessons: LessonInfo[];
  read: Set<string>;
  prereqs: Map<string, string[]>;
  /** Lessons the reader chose to skip (for example kana, for returning learners). */
  skipped?: Set<string>;
}): LessonInfo | null {
  const lessons = [...args.lessons].sort((a, b) => a.sequence - b.sequence);
  const done = (l: LessonInfo) => args.read.has(l.id) || args.skipped?.has(l.id);
  const taughtBySomeLesson = new Set(lessons.flatMap((l) => l.teaches));
  const covered = new Set(lessons.filter(done).flatMap((l) => l.teaches));
  const pending = lessons.filter((l) => !done(l));
  for (const l of pending) {
    const needs = l.teaches.flatMap((c) => args.prereqs.get(c) ?? []);
    const ready = needs.every((p) => covered.has(p) || !taughtBySomeLesson.has(p) || l.teaches.includes(p));
    if (ready) return l;
  }
  return pending[0] ?? null;
}

/** "Thursday's Japanese Daily" */
export function editionTitle(date: IsoDate, templateTitle?: string | null): string {
  return templateTitle || `${weekday(date)}'s Japanese Daily`;
}

/**
 * Concepts that need more practice: correct rate below 60% over the last five
 * answers, with at least three answers recorded.
 */
export function weakConcepts(answers: { conceptId: string; correct: boolean; at: string }[]): string[] {
  const byConcept = new Map<string, { correct: boolean; at: string }[]>();
  for (const a of answers) {
    const list = byConcept.get(a.conceptId) ?? [];
    list.push(a);
    byConcept.set(a.conceptId, list);
  }
  const weak: { id: string; rate: number }[] = [];
  for (const [id, list] of byConcept) {
    const recent = list.sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 5);
    if (recent.length < 3) continue;
    const rate = recent.filter((r) => r.correct).length / recent.length;
    if (rate < 0.6) weak.push({ id, rate });
  }
  return weak.sort((a, b) => a.rate - b.rate).map((w) => w.id);
}
