/** Dates are local calendar days written as YYYY-MM-DD. */
export type IsoDate = string;

/** The paper's day starts at 4 am, so reading after midnight still counts as the same day. */
export const ROLLOVER_HOUR = 4;

export function issueDateFor(now: Date, rolloverHour = ROLLOVER_HOUR): IsoDate {
  const shifted = new Date(now.getTime() - rolloverHour * 3600_000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toUtc(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: IsoDate, n: number): IsoDate {
  return new Date(toUtc(date) + n * 86400_000).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86400_000);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_JA = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function weekday(date: IsoDate): string {
  return WEEKDAYS[new Date(toUtc(date)).getUTCDay()];
}

export function weekdayJa(date: IsoDate): string {
  return WEEKDAYS_JA[new Date(toUtc(date)).getUTCDay()];
}

/** "Thursday 26 November 2026" */
export function longDate(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${weekday(date)} ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "26 Nov" */
export function shortDate(date: IsoDate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

export function monthLabel(date: IsoDate): string {
  const [y, m] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2026年11月26日" */
export function japaneseDate(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}
