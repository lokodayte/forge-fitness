import type { ActivityLevel, BodyWeightEntry, CardioEntry, FoodEntry, LocalDate, Profile, RecoveryEntry, Sex, WaterEntry } from '../db/types';
import { addDays, addMonths, daysBetween, monthKey, startOfMonth, startOfWeek } from './dates';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/* =================== Body weight =================== */

export interface WeightPoint {
  date: LocalDate;
  weightKg: number;
  /** Trailing 7-calendar-day mean of all entries dated within [date − 6, date]. */
  avg7Kg: number;
  /** Number of entries contributing to avg7Kg. */
  avgCount: number;
}

/**
 * 7-day moving average (trailing, calendar-based). For each logged date d, the average
 * is the mean of every entry whose date is between d−6 and d inclusive. Missing days
 * are simply absent — they are never interpolated or invented.
 */
export function movingAverage7(entries: Pick<BodyWeightEntry, 'date' | 'weightKg'>[]): WeightPoint[] {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return sorted.map((e) => {
    const from = addDays(e.date, -6);
    const window = sorted.filter((x) => x.date >= from && x.date <= e.date);
    return { date: e.date, weightKg: e.weightKg, avg7Kg: avg(window.map((x) => x.weightKg))!, avgCount: window.length };
  });
}

/** Average weekly change of the 7-day average over the last `days` days (kg/week), if enough data. */
export function weeklyWeightChange(points: WeightPoint[], days = 14): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const target = addDays(last.date, -days);
  const earlier = [...points].reverse().find((p) => p.date <= target);
  if (!earlier) return null;
  const span = daysBetween(earlier.date, last.date);
  if (span < 7) return null;
  return ((last.avg7Kg - earlier.avg7Kg) / span) * 7;
}

/* =================== Nutrition =================== */

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Calories per serving: as entered, or derived from macros (4/4/9) when left blank. */
export function caloriesPerServing(e: Pick<FoodEntry, 'calories' | 'proteinG' | 'carbsG' | 'fatG'>): number {
  if (e.calories != null && Number.isFinite(e.calories)) return e.calories;
  return e.proteinG * KCAL_PER_G.protein + e.carbsG * KCAL_PER_G.carbs + e.fatG * KCAL_PER_G.fat;
}

export interface DayTotals {
  date: LocalDate;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  entries: number;
  /** True when at least one entry's calories were derived from macros. */
  derived: boolean;
}

export function dayTotals(entries: FoodEntry[], date: LocalDate): DayTotals {
  const list = entries.filter((e) => e.date === date);
  const t: DayTotals = { date, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, entries: list.length, derived: false };
  for (const e of list) {
    const s = e.servings > 0 ? e.servings : 0;
    t.calories += caloriesPerServing(e) * s;
    t.proteinG += e.proteinG * s;
    t.carbsG += e.carbsG * s;
    t.fatG += e.fatG * s;
    if (e.calories == null) t.derived = true;
  }
  return t;
}

export function dailyTotalsRange(entries: FoodEntry[], from: LocalDate, to: LocalDate): DayTotals[] {
  const out: DayTotals[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(dayTotals(entries, d));
  return out;
}

/** Averages over days that have at least one food entry (unlogged days are excluded, not counted as zero). */
export function averageLoggedDays(days: DayTotals[]): { calories: number; proteinG: number; carbsG: number; fatG: number; days: number } | null {
  const logged = days.filter((d) => d.entries > 0);
  if (!logged.length) return null;
  return {
    calories: avg(logged.map((d) => d.calories))!,
    proteinG: avg(logged.map((d) => d.proteinG))!,
    carbsG: avg(logged.map((d) => d.carbsG))!,
    fatG: avg(logged.map((d) => d.fatG))!,
    days: logged.length,
  };
}

export function waterForDate(entries: WaterEntry[], date: LocalDate): number {
  return entries.filter((w) => w.date === date).reduce((s, w) => s + w.ml, 0);
}

export const ACTIVITY_FACTORS: Record<ActivityLevel, { factor: number; label: string }> = {
  sedentary: { factor: 1.2, label: 'Sedentary — little or no exercise' },
  light: { factor: 1.375, label: 'Lightly active — light exercise 1–3 days/week' },
  moderate: { factor: 1.55, label: 'Moderately active — exercise 3–5 days/week' },
  active: { factor: 1.725, label: 'Very active — hard exercise 6–7 days/week' },
  very_active: { factor: 1.9, label: 'Extremely active — physical job plus training' },
};

/**
 * Mifflin–St Jeor resting energy expenditure (kcal/day):
 *   male:   10 × kg + 6.25 × cm − 5 × age + 5
 *   female: 10 × kg + 6.25 × cm − 5 × age − 161
 * For 'unspecified' we return the midpoint and widen the range to include both equations.
 */
export function mifflinStJeor(weightKg: number, heightCm: number, age: number, sex: Sex): { bmr: number; low: number; high: number } {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const male = base + 5;
  const female = base - 161;
  if (sex === 'male') return { bmr: male, low: male, high: male };
  if (sex === 'female') return { bmr: female, low: female, high: female };
  return { bmr: (male + female) / 2, low: female, high: male };
}

export interface MaintenanceFormulaResult {
  bmr: number;
  factor: number;
  estimate: number;
  /** ±10% individual-variation band, widened for 'unspecified' sex. */
  low: number;
  high: number;
}

export function formulaMaintenance(weightKg: number, heightCm: number, age: number, sex: Sex, activity: ActivityLevel): MaintenanceFormulaResult {
  const m = mifflinStJeor(weightKg, heightCm, age, sex);
  const factor = ACTIVITY_FACTORS[activity].factor;
  const estimate = m.bmr * factor;
  return { bmr: m.bmr, factor, estimate, low: m.low * factor * 0.9, high: m.high * factor * 1.1 };
}

/** Approximate energy content of 1 kg of body-mass change (kcal). A commonly used rule of thumb. */
export const KCAL_PER_KG = 7700;

export type LogMaintenanceResult =
  | { ok: true; estimate: number; avgIntake: number; weightChangeKg: number; days: number; loggedFoodDays: number; weighIns: number }
  | { ok: false; reason: string; loggedFoodDays: number; weighIns: number };

/**
 * Maintenance from your own logs over the last `windowDays` days:
 *   maintenance ≈ average daily intake (logged days) − (Δ trend weight kg × 7700) ÷ days
 * Δ trend weight = mean of weigh-ins in the final 7 days − mean of weigh-ins in the first 7 days.
 * Requires ≥ 14 days of span, ≥ 10 days with food logs and ≥ 3 weigh-ins in each end-week.
 */
export function logsMaintenance(foods: FoodEntry[], weights: BodyWeightEntry[], endDate: LocalDate, windowDays = 28): LogMaintenanceResult {
  const start = addDays(endDate, -(windowDays - 1));
  const days = dailyTotalsRange(foods, start, endDate);
  const logged = days.filter((d) => d.entries > 0);
  const w = weights.filter((x) => x.date >= start && x.date <= endDate).sort((a, b) => (a.date < b.date ? -1 : 1));
  const base = { loggedFoodDays: logged.length, weighIns: w.length };
  if (logged.length < 10) return { ok: false, reason: `Needs at least 10 days with food logs in the last ${windowDays} days (have ${logged.length}).`, ...base };
  if (w.length < 6) return { ok: false, reason: `Needs at least 6 weigh-ins in the last ${windowDays} days (have ${w.length}).`, ...base };
  const first = w[0].date;
  const last = w[w.length - 1].date;
  const span = daysBetween(first, last);
  if (span < 14) return { ok: false, reason: `Weigh-ins must span at least 14 days (currently ${span}).`, ...base };
  const head = w.filter((x) => x.date <= addDays(first, 6));
  const tail = w.filter((x) => x.date >= addDays(last, -6));
  if (head.length < 3 || tail.length < 3) return { ok: false, reason: 'Needs at least 3 weigh-ins in both the first and the last week of the period.', ...base };
  const change = avg(tail.map((x) => x.weightKg))! - avg(head.map((x) => x.weightKg))!;
  const avgIntake = avg(logged.map((d) => d.calories))!;
  const estimate = avgIntake - (change * KCAL_PER_KG) / span;
  return { ok: true, estimate, avgIntake, weightChangeKg: change, days: span, ...base };
}

export function clampDeficit(kcal: number): number {
  return Math.min(400, Math.max(250, Math.round(kcal)));
}

/** Daily calorie target, or null when no maintenance estimate has been established. */
export function calorieTarget(p: Pick<Profile, 'maintenance' | 'deficitEnabled' | 'deficitKcal'>): number | null {
  if (!p.maintenance) return null;
  return Math.round(p.maintenance.kcal - (p.deficitEnabled ? clampDeficit(p.deficitKcal) : 0));
}

/* =================== Cardio =================== */

/** WHO general guideline for adults: 150–300 min/week of moderate-intensity activity. */
export const WEEKLY_ACTIVITY_GUIDELINE_MIN = 150;

export function cardioMinutes(entries: CardioEntry[], from: LocalDate, to: LocalDate): number {
  return entries.filter((c) => c.date >= from && c.date <= to).reduce((s, c) => s + c.durationMin, 0);
}

export function weeklyCardio(entries: CardioEntry[], weeks: number, todayDate: LocalDate): { weekStart: LocalDate; minutes: number; sessions: number }[] {
  const ws0 = startOfWeek(todayDate);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(ws0, -7 * i);
    const we = addDays(ws, 6);
    const list = entries.filter((c) => c.date >= ws && c.date <= we);
    out.push({ weekStart: ws, minutes: list.reduce((s, c) => s + c.durationMin, 0), sessions: list.length });
  }
  return out;
}

export function monthlyCardio(entries: CardioEntry[], months: number, todayDate: LocalDate): { month: string; minutes: number; sessions: number }[] {
  const m0 = startOfMonth(todayDate);
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = monthKey(addMonths(m0, -i));
    const list = entries.filter((c) => monthKey(c.date) === key);
    out.push({ month: key, minutes: list.reduce((s, c) => s + c.durationMin, 0), sessions: list.length });
  }
  return out;
}

export interface CardioSuggestion {
  baselineMin: number | null;
  nextWeekMin: number | null;
  message: string;
}

/**
 * Gentle progression: baseline = mean of the last two complete weeks; next-week target =
 * baseline × 1.10 (≈10% increase), capped at the 150-min guideline. Only offered once the
 * user has recorded medical clearance.
 */
export function cardioProgression(entries: CardioEntry[], todayDate: LocalDate, cleared: boolean): CardioSuggestion {
  const ws = startOfWeek(todayDate);
  const w1 = cardioMinutes(entries, addDays(ws, -7), addDays(ws, -1));
  const w2 = cardioMinutes(entries, addDays(ws, -14), addDays(ws, -8));
  const hasData = entries.some((c) => c.date >= addDays(ws, -14) && c.date < ws);
  if (!cleared) {
    return { baselineMin: hasData ? (w1 + w2) / 2 : null, nextWeekMin: null, message: 'Progression suggestions are paused until you record medical clearance in Settings. Keep to comfortable, conversational-pace walking that your clinician is happy with.' };
  }
  if (!hasData) return { baselineMin: null, nextWeekMin: null, message: 'Log at least one cardio session in the previous two weeks to get a gentle progression suggestion.' };
  const baseline = (w1 + w2) / 2;
  if (baseline >= WEEKLY_ACTIVITY_GUIDELINE_MIN) {
    return { baselineMin: baseline, nextWeekMin: null, message: `Your recent average (${Math.round(baseline)} min/week) meets the general 150 min/week moderate-activity guideline. No increase needed.` };
  }
  const next = Math.min(WEEKLY_ACTIVITY_GUIDELINE_MIN, Math.round(baseline * 1.1 + 0.0001));
  return { baselineMin: baseline, nextWeekMin: Math.max(next, Math.round(baseline)), message: `A gentle option is about ${Math.max(next, Math.round(baseline))} min next week (≈10% above your ${Math.round(baseline)} min average), at a conversational pace. Only increase if you feel well.` };
}

/* =================== Recovery =================== */

export interface RecoveryAverages {
  days: number;
  sleepHours: number | null;
  sleepQuality: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  readiness: number | null;
}

export function recoveryAverages(entries: RecoveryEntry[], from: LocalDate, to: LocalDate): RecoveryAverages {
  const list = entries.filter((r) => r.date >= from && r.date <= to);
  const pick = (k: keyof RecoveryEntry) => avg(list.map((r) => r[k]).filter((v): v is number => typeof v === 'number'));
  return {
    days: list.length,
    sleepHours: pick('sleepHours'),
    sleepQuality: pick('sleepQuality'),
    fatigue: pick('fatigue'),
    soreness: pick('soreness'),
    stress: pick('stress'),
    readiness: pick('readiness'),
  };
}

/**
 * Recovery index (0–100) for a single day — a transparent summary, not a medical score:
 * mean of available 1–5 ratings after inverting fatigue, soreness and stress (6 − x),
 * rescaled from 1–5 to 0–100. Returns null if no ratings were entered.
 */
export function recoveryIndex(r: RecoveryEntry): number | null {
  const parts: number[] = [];
  if (r.sleepQuality != null) parts.push(r.sleepQuality);
  if (r.readiness != null) parts.push(r.readiness);
  if (r.fatigue != null) parts.push(6 - r.fatigue);
  if (r.soreness != null) parts.push(6 - r.soreness);
  if (r.stress != null) parts.push(6 - r.stress);
  if (!parts.length) return null;
  return Math.round(((avg(parts)! - 1) / 4) * 100);
}
