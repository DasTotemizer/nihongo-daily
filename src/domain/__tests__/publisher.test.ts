import { addDays, daysBetween, issueDateFor } from '../dates';
import { MAX_BACK_ISSUES, nextLesson, planIssues, weakConcepts } from '../publisher';

describe('issueDateFor', () => {
  it('rolls the day over at 4 am local time', () => {
    expect(issueDateFor(new Date(2026, 10, 26, 3, 59))).toBe('2026-11-25');
    expect(issueDateFor(new Date(2026, 10, 26, 4, 0))).toBe('2026-11-26');
    expect(issueDateFor(new Date(2026, 10, 26, 23, 30))).toBe('2026-11-26');
  });
  it('handles month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(daysBetween('2026-11-26', '2026-12-03')).toBe(7);
  });
});

describe('planIssues', () => {
  const base = { nextTemplate: 1, templateCount: 30 };

  it('issues edition 1 on first launch', () => {
    expect(planIssues({ ...base, today: '2026-11-26', last: null })).toEqual([
      { editionNumber: 1, issueDate: '2026-11-26', isBackIssue: false, templateNumber: 1 },
    ]);
  });

  it('issues nothing when today already has an edition', () => {
    expect(planIssues({ ...base, today: '2026-11-26', last: { editionNumber: 1, issueDate: '2026-11-26' } })).toEqual([]);
  });

  it('issues nothing when the clock goes backwards', () => {
    expect(planIssues({ ...base, today: '2026-11-20', last: { editionNumber: 5, issueDate: '2026-11-26' } })).toEqual([]);
  });

  it('issues just today after a normal day', () => {
    const p = planIssues({ ...base, nextTemplate: 2, today: '2026-11-27', last: { editionNumber: 1, issueDate: '2026-11-26' } });
    expect(p).toEqual([{ editionNumber: 2, issueDate: '2026-11-27', isBackIssue: false, templateNumber: 2 }]);
  });

  it('turns two missed days into back issues (Monday to Thursday)', () => {
    const p = planIssues({ ...base, nextTemplate: 2, today: '2026-11-26', last: { editionNumber: 1, issueDate: '2026-11-23' } });
    expect(p.map((x) => [x.editionNumber, x.issueDate, x.isBackIssue])).toEqual([
      [2, '2026-11-24', true],
      [3, '2026-11-25', true],
      [4, '2026-11-26', false],
    ]);
  });

  it('caps back issues after a long absence', () => {
    const p = planIssues({ ...base, nextTemplate: 2, today: '2026-12-26', last: { editionNumber: 1, issueDate: '2026-11-26' } });
    expect(p.filter((x) => x.isBackIssue)).toHaveLength(MAX_BACK_ISSUES);
    expect(p[0].issueDate).toBe('2026-12-19');
    expect(p.at(-1)).toMatchObject({ issueDate: '2026-12-26', isBackIssue: false, editionNumber: 9 });
  });

  it('skips empty back issues but still prints today when templates run out', () => {
    const p = planIssues({ today: '2026-11-26', last: { editionNumber: 4, issueDate: '2026-11-22' }, nextTemplate: 5, templateCount: 5 });
    expect(p).toEqual([
      { editionNumber: 5, issueDate: '2026-11-23', isBackIssue: true, templateNumber: 5 },
      { editionNumber: 6, issueDate: '2026-11-26', isBackIssue: false, templateNumber: null },
    ]);
  });
});

describe('nextLesson', () => {
  const lessons = [
    { id: 'hiragana', sequence: 20, stage: 1, teaches: ['hiragana'] },
    { id: 'da', sequence: 100, stage: 2, teaches: ['da'] },
    { id: 'wa', sequence: 120, stage: 2, teaches: ['wa'] },
    { id: 'ga', sequence: 140, stage: 2, teaches: ['ga'] },
  ];
  const prereqs = new Map([
    ['hiragana', []],
    ['da', ['hiragana']],
    ['wa', ['da']],
    ['ga', ['wa']],
  ]);

  it('starts at the beginning', () => {
    expect(nextLesson({ lessons, read: new Set(), prereqs })?.id).toBe('hiragana');
  });
  it('continues from where the reader left off, not from the date', () => {
    expect(nextLesson({ lessons, read: new Set(['hiragana', 'da']), prereqs })?.id).toBe('wa');
  });
  it('never offers a lesson before its prerequisites', () => {
    // Read ga out of order (from search, say): wa is still next, because ga needs wa.
    expect(nextLesson({ lessons, read: new Set(['hiragana', 'da', 'ga']), prereqs })?.id).toBe('wa');
  });
  it('lets returning learners skip kana', () => {
    expect(nextLesson({ lessons, read: new Set(), prereqs, skipped: new Set(['hiragana']) })?.id).toBe('da');
  });
  it('returns null when every lesson is read', () => {
    expect(nextLesson({ lessons, read: new Set(lessons.map((l) => l.id)), prereqs })).toBeNull();
  });
});

describe('weakConcepts', () => {
  it('flags concepts under 60% over the last five answers', () => {
    const a = (conceptId: string, correct: boolean, at: string) => ({ conceptId, correct, at });
    const answers = [
      a('wa', false, '1'), a('wa', false, '2'), a('wa', true, '3'),
      a('ga', true, '1'), a('ga', true, '2'), a('ga', false, '3'),
      a('mo', false, '1'),
    ];
    expect(weakConcepts(answers)).toEqual(['wa']);
  });
});
