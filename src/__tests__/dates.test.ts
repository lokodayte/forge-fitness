import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, addMonths, dateRange, daysBetween, endOfMonth, endOfWeek, isLocalDate, parseLocalDate, startOfWeek, toLocalDate, weekdayIndex } from '../lib/dates';

describe('local date handling', () => {
  const tz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    process.env.TZ = tz;
  });

  it('formats local dates without UTC shifting (late evening)', () => {
    // 23:30 local on Oct 18 is already Oct 19 in UTC — must stay the 18th.
    const d = new Date(2026, 9, 18, 23, 30);
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-19');
    expect(toLocalDate(d)).toBe('2026-10-18');
  });

  it('parses YYYY-MM-DD as local midnight', () => {
    const d = parseLocalDate('2026-03-08');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(0);
  });

  it('adds days across a DST change', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });

  it('handles month and year boundaries and leap years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('uses Monday-start weeks', () => {
    expect(weekdayIndex('2026-10-19')).toBe(0); // Monday
    expect(weekdayIndex('2026-10-18')).toBe(6); // Sunday
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12');
    expect(endOfWeek('2026-10-12')).toBe('2026-10-18');
  });

  it('validates dates strictly', () => {
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-2-3')).toBe(false);
    expect(isLocalDate('2026-10-18')).toBe(true);
    expect(isLocalDate(20261018)).toBe(false);
  });

  it('builds inclusive ranges', () => {
    expect(dateRange('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(dateRange('2026-10-02', '2026-10-01')).toEqual([]);
  });
});
