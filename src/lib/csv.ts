import type { BodyWeightEntry, CardioEntry, FoodEntry, MeasurementEntry, RecoveryEntry, WaterEntry, WorkoutSession } from '../db/types';
import { caloriesPerServing } from './metrics';

type Cell = string | number | boolean | null | undefined;

export function csvEscape(v: Cell): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export function workoutSetsCsv(sessions: WorkoutSession[]): string {
  const rows: Cell[][] = [];
  for (const s of [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const e of s.exercises) {
      e.sets.forEach((set, i) => {
        rows.push([s.date, s.templateName, s.status, e.name, e.exerciseId, i + 1, set.kind, set.completed, set.weightKg, set.reps, set.seconds, set.rir, set.weightKg && set.reps && set.completed && set.kind === 'working' ? set.weightKg * set.reps : 0, e.notes]);
      });
    }
  }
  return toCsv(['date', 'workout', 'status', 'exercise', 'exercise_id', 'set_no', 'set_kind', 'completed', 'weight_kg', 'reps', 'seconds', 'rir', 'volume_kg', 'exercise_notes'], rows);
}

export function cardioCsv(entries: CardioEntry[]): string {
  return toCsv(
    ['date', 'type', 'label', 'duration_min', 'distance_km', 'avg_hr_bpm', 'effort_1_10', 'notes'],
    entries.map((c) => [c.date, c.type, c.label, c.durationMin, c.distanceKm, c.avgHr, c.effort, c.notes]),
  );
}

export function foodCsv(entries: FoodEntry[]): string {
  return toCsv(
    ['date', 'meal', 'name', 'servings', 'kcal_per_serving', 'kcal_total', 'kcal_derived_from_macros', 'protein_g', 'carbs_g', 'fat_g'],
    entries.map((f) => [f.date, f.meal, f.name, f.servings, caloriesPerServing(f), Math.round(caloriesPerServing(f) * f.servings), f.calories == null, f.proteinG * f.servings, f.carbsG * f.servings, f.fatG * f.servings]),
  );
}

export function weightCsv(entries: BodyWeightEntry[]): string {
  return toCsv(['date', 'weight_kg', 'note'], entries.map((w) => [w.date, w.weightKg, w.note]));
}

export function measurementsCsv(entries: MeasurementEntry[]): string {
  return toCsv(['date', 'waist_cm', 'chest_cm', 'arm_cm', 'hip_cm', 'thigh_cm', 'note'], entries.map((m) => [m.date, m.waistCm, m.chestCm, m.armCm, m.hipCm, m.thighCm, m.note]));
}

export function recoveryCsv(entries: RecoveryEntry[]): string {
  return toCsv(
    ['date', 'sleep_hours', 'sleep_quality_1_5', 'fatigue_1_5', 'soreness_1_5', 'stress_1_5', 'readiness_1_5', 'notes'],
    entries.map((r) => [r.date, r.sleepHours, r.sleepQuality, r.fatigue, r.soreness, r.stress, r.readiness, r.notes]),
  );
}

export function waterCsv(entries: WaterEntry[]): string {
  return toCsv(['date', 'ml'], entries.map((w) => [w.date, w.ml]));
}
