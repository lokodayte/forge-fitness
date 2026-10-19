import { describe, expect, it } from 'vitest';
import type { BodyWeightEntry, CardioEntry, FoodEntry, RecoveryEntry } from '../db/types';
import { averageLoggedDays, caloriesPerServing, calorieTarget, cardioMinutes, cardioProgression, clampDeficit, dailyTotalsRange, dayTotals, formulaMaintenance, logsMaintenance, mifflinStJeor, monthlyCardio, movingAverage7, recoveryAverages, recoveryIndex, waterForDate, weeklyCardio, weeklyWeightChange } from '../lib/metrics';
import { addDays } from '../lib/dates';

const w = (date: string, weightKg: number): BodyWeightEntry => ({ id: date, date, weightKg, note: '', createdAt: 0 });
const food = (date: string, p: Partial<FoodEntry> = {}): FoodEntry => ({ id: `${date}-${Math.random()}`, date, meal: 'lunch', name: 'x', servings: 1, calories: 500, proteinG: 30, carbsG: 50, fatG: 15, createdAt: 0, ...p });
const cardio = (date: string, durationMin: number): CardioEntry => ({ id: `${date}-${durationMin}-${Math.random()}`, date, type: 'walking', durationMin, distanceKm: null, avgHr: null, effort: null, notes: '', createdAt: 0 });

describe('7-day moving average', () => {
  it('averages entries within the trailing 7 calendar days', () => {
    const pts = movingAverage7([w('2026-10-01', 88), w('2026-10-02', 87), w('2026-10-04', 86), w('2026-10-09', 85)]);
    expect(pts.map((p) => p.avg7Kg)).toEqual([88, 87.5, 87, 85.5]);
    // Oct 9 window = Oct 3..9 → only Oct 4 (86) and Oct 9 (85)
    expect(pts[3].avgCount).toBe(2);
  });

  it('sorts unsorted input and never interpolates missing days', () => {
    const pts = movingAverage7([w('2026-10-10', 80), w('2026-10-01', 90)]);
    expect(pts.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-10']);
    expect(pts[1].avg7Kg).toBe(80);
  });

  it('computes weekly trend change only with enough span', () => {
    const entries = Array.from({ length: 21 }, (_, i) => w(addDays('2026-10-01', i), 90 - i * 0.1));
    const change = weeklyWeightChange(movingAverage7(entries))!;
    expect(change).toBeCloseTo(-0.7, 5);
    expect(weeklyWeightChange(movingAverage7(entries.slice(0, 3)))).toBeNull();
  });
});

describe('nutrition calculations', () => {
  it('uses entered calories or derives 4/4/9 from macros', () => {
    expect(caloriesPerServing({ calories: 300, proteinG: 10, carbsG: 10, fatG: 10 })).toBe(300);
    expect(caloriesPerServing({ calories: null, proteinG: 35, carbsG: 50, fatG: 8 })).toBe(412);
  });

  it('totals a day including servings', () => {
    const entries = [food('2026-10-18', { servings: 2 }), food('2026-10-18', { calories: null, proteinG: 20, carbsG: 0, fatG: 0 }), food('2026-10-17')];
    const t = dayTotals(entries, '2026-10-18');
    expect(t.calories).toBe(1080);
    expect(t.proteinG).toBe(80);
    expect(t.entries).toBe(2);
    expect(t.derived).toBe(true);
  });

  it('averages only days that were logged', () => {
    const days = dailyTotalsRange([food('2026-10-12'), food('2026-10-14', { calories: 700 })], '2026-10-12', '2026-10-18');
    expect(days).toHaveLength(7);
    expect(averageLoggedDays(days)!.calories).toBe(600);
    expect(averageLoggedDays(dailyTotalsRange([], '2026-10-12', '2026-10-18'))).toBeNull();
  });

  it('sums water per day', () => {
    expect(waterForDate([{ id: '1', date: '2026-10-18', ml: 500, createdAt: 0 }, { id: '2', date: '2026-10-18', ml: 250, createdAt: 0 }, { id: '3', date: '2026-10-17', ml: 900, createdAt: 0 }], '2026-10-18')).toBe(750);
  });

  it('implements Mifflin–St Jeor', () => {
    // 10×87 + 6.25×181 − 5×19 + 5 = 1911.25
    expect(mifflinStJeor(87, 181, 19, 'male').bmr).toBeCloseTo(1911.25);
    expect(mifflinStJeor(87, 181, 19, 'female').bmr).toBeCloseTo(1745.25);
    const u = mifflinStJeor(87, 181, 19, 'unspecified');
    expect(u.low).toBeCloseTo(1745.25);
    expect(u.high).toBeCloseTo(1911.25);
    const f = formulaMaintenance(87, 181, 19, 'male', 'moderate');
    expect(f.estimate).toBeCloseTo(1911.25 * 1.55);
    expect(f.low).toBeCloseTo(1911.25 * 1.55 * 0.9);
  });

  it('estimates maintenance from logs only with sufficient data', () => {
    const end = '2026-10-28';
    const start = addDays(end, -27);
    const foods = Array.from({ length: 28 }, (_, i) => food(addDays(start, i), { calories: 2500 }));
    // trend falls 0.5 kg over the period (first-week avg 88, last-week avg 87.5)
    const weights = [...Array.from({ length: 4 }, (_, i) => w(addDays(start, i), 88)), ...Array.from({ length: 4 }, (_, i) => w(addDays(end, -i), 87.5))];
    const r = logsMaintenance(foods, weights, end);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.weightChangeKg).toBeCloseTo(-0.5);
      expect(r.days).toBe(27);
      expect(r.estimate).toBeCloseTo(2500 + (0.5 * 7700) / 27, 5);
    }
    const insufficient = logsMaintenance(foods.slice(0, 5), weights, end);
    expect(insufficient.ok).toBe(false);
  });

  it('does not invent a calorie target and clamps the deficit to 250–400', () => {
    expect(calorieTarget({ maintenance: null, deficitEnabled: true, deficitKcal: 300 })).toBeNull();
    expect(calorieTarget({ maintenance: { method: 'manual', kcal: 2800, setOn: '2026-10-18' }, deficitEnabled: false, deficitKcal: 300 })).toBe(2800);
    expect(calorieTarget({ maintenance: { method: 'manual', kcal: 2800, setOn: '2026-10-18' }, deficitEnabled: true, deficitKcal: 900 })).toBe(2400);
    expect(clampDeficit(100)).toBe(250);
  });
});

describe('cardio', () => {
  const entries = [cardio('2026-10-05', 30), cardio('2026-10-07', 40), cardio('2026-10-12', 35), cardio('2026-10-14', 35), cardio('2026-09-28', 60)];
  it('sums weekly and monthly minutes', () => {
    expect(cardioMinutes(entries, '2026-10-05', '2026-10-11')).toBe(70);
    expect(weeklyCardio(entries, 3, '2026-10-18').map((x) => x.minutes)).toEqual([60, 70, 70]);
    expect(monthlyCardio(entries, 2, '2026-10-18')).toEqual([
      { month: '2026-09', minutes: 60, sessions: 1 },
      { month: '2026-10', minutes: 140, sessions: 4 },
    ]);
  });
  it('offers gentle progression only after medical clearance', () => {
    expect(cardioProgression(entries, '2026-10-19', false).nextWeekMin).toBeNull();
    const p = cardioProgression(entries, '2026-10-19', true);
    expect(p.baselineMin).toBe(70);
    expect(p.nextWeekMin).toBe(77);
    const lots = Array.from({ length: 14 }, (_, i) => cardio(addDays('2026-10-05', i), 30));
    expect(cardioProgression(lots, '2026-10-19', true).nextWeekMin).toBeNull();
  });
});

describe('recovery', () => {
  const r = (date: string, p: Partial<RecoveryEntry>): RecoveryEntry => ({ id: date, date, sleepHours: null, sleepQuality: null, fatigue: null, soreness: null, stress: null, readiness: null, notes: '', createdAt: 0, ...p });
  it('averages sleep over a window using only entered values', () => {
    const a = recoveryAverages([r('2026-10-17', { sleepHours: 7 }), r('2026-10-18', { sleepHours: 8.5, readiness: 4 }), r('2026-10-01', { sleepHours: 3 })], '2026-10-12', '2026-10-18');
    expect(a.days).toBe(2);
    expect(a.sleepHours).toBe(7.75);
    expect(a.readiness).toBe(4);
    expect(a.stress).toBeNull();
  });
  it('computes a transparent recovery index', () => {
    expect(recoveryIndex(r('x', { sleepQuality: 5, readiness: 5, fatigue: 1, soreness: 1, stress: 1 }))).toBe(100);
    expect(recoveryIndex(r('x', { sleepQuality: 1, fatigue: 5 }))).toBe(0);
    expect(recoveryIndex(r('x', {}))).toBeNull();
  });
});
