import type { LocalDate } from '../db/types';

/**
 * Local-date helpers. All dates in FORGE are stored as YYYY-MM-DD strings in the
 * user's local time zone. We never use toISOString() for calendar dates because
 * it converts to UTC and can shift the day near midnight.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalDate(d: Date): LocalDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = parseLocalDate(value);
  return toLocalDate(d) === value;
}

/** Parse YYYY-MM-DD as local midnight (not UTC). */
export function parseLocalDate(s: LocalDate): Date {
  const m = DATE_RE.exec(s);
  if (!m) throw new Error(`Invalid local date: ${s}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

export function addDays(s: LocalDate, days: number): LocalDate {
  const d = parseLocalDate(s);
  d.setDate(d.getDate() + days);
  return toLocalDate(d);
}

/** Whole calendar days from a to b (b − a). DST-safe because it uses UTC of local components. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(s: LocalDate): number {
  return (parseLocalDate(s).getDay() + 6) % 7;
}

/** Monday of the week containing s. */
export function startOfWeek(s: LocalDate): LocalDate {
  return addDays(s, -weekdayIndex(s));
}

export function endOfWeek(s: LocalDate): LocalDate {
  return addDays(startOfWeek(s), 6);
}

export function startOfMonth(s: LocalDate): LocalDate {
  return `${s.slice(0, 7)}-01`;
}

export function endOfMonth(s: LocalDate): LocalDate {
  const d = parseLocalDate(startOfMonth(s));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toLocalDate(d);
}

export function monthKey(s: LocalDate): string {
  return s.slice(0, 7);
}

export function addMonths(s: LocalDate, months: number): LocalDate {
  const d = parseLocalDate(startOfMonth(s));
  d.setMonth(d.getMonth() + months);
  return toLocalDate(d);
}

/** Inclusive list of dates from a to b. */
export function dateRange(a: LocalDate, b: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  const n = daysBetween(a, b);
  for (let i = 0; i <= n; i++) out.push(addDays(a, i));
  return out;
}

export function inRange(s: LocalDate, a: LocalDate, b: LocalDate): boolean {
  return s >= a && s <= b;
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function formatDate(s: LocalDate, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return parseLocalDate(s).toLocaleDateString(undefined, opts);
}

export function formatLongDate(s: LocalDate): string {
  return formatDate(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatMonth(s: LocalDate): string {
  return formatDate(s, { month: 'long', year: 'numeric' });
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
