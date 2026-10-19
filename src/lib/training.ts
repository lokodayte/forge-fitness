import type { LocalDate, LoggedSet, ScheduleOverride, SessionExercise, WeeklySchedule, WorkoutSession, ScheduledActivity } from '../db/types';
import { addDays, dateRange, daysBetween, startOfWeek, weekdayIndex } from './dates';

/*
 * FORMULAS (all computed only from saved, completed data)
 *
 *  Working set            = a set with kind 'working' that the user ticked complete.
 *  Set volume (kg)        = weightKg × reps for completed working sets with weight > 0 and reps > 0.
 *                           Warm-ups, timed holds and body-weight sets (no load) contribute 0.
 *  Session volume         = Σ set volume across the session.
 *  Weekly frequency       = number of completed sessions dated Monday–Sunday of that week.
 *  Planned workouts       = days in a range whose scheduled activity (after reschedules) is a workout.
 *  Completed vs planned % = min(100, completed sessions in range ÷ planned workouts in range × 100).
 *  Consistency %          = share of fully elapsed weeks since program start in which
 *                           completed sessions ≥ planned workouts for that week.
 */

export const isCompletedWorking = (s: LoggedSet) => s.kind === 'working' && s.completed;

export function setVolumeKg(s: LoggedSet): number {
  if (!isCompletedWorking(s)) return 0;
  if (s.weightKg == null || s.reps == null || s.weightKg <= 0 || s.reps <= 0) return 0;
  return s.weightKg * s.reps;
}

export function exerciseVolumeKg(e: SessionExercise): number {
  return e.sets.reduce((sum, s) => sum + setVolumeKg(s), 0);
}

export function sessionVolumeKg(s: WorkoutSession): number {
  return s.exercises.reduce((sum, e) => sum + exerciseVolumeKg(e), 0);
}

export function completedWorkingSets(s: WorkoutSession): number {
  return s.exercises.reduce((n, e) => n + e.sets.filter(isCompletedWorking).length, 0);
}

export function plannedWorkingSets(s: WorkoutSession): number {
  return s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.kind === 'working').length, 0);
}

export const completedSessions = (sessions: WorkoutSession[]) => sessions.filter((s) => s.status === 'completed');

export function sessionsInRange(sessions: WorkoutSession[], from: LocalDate, to: LocalDate): WorkoutSession[] {
  return completedSessions(sessions).filter((s) => s.date >= from && s.date <= to);
}

export interface SessionSummary {
  workingSets: number;
  plannedSets: number;
  warmupSets: number;
  volumeKg: number;
  exercisesCompleted: number;
  exercisesTotal: number;
  durationMs: number;
}

export function summarizeSession(s: WorkoutSession, durationMs: number): SessionSummary {
  return {
    workingSets: completedWorkingSets(s),
    plannedSets: plannedWorkingSets(s),
    warmupSets: s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.kind === 'warmup' && x.completed).length, 0),
    volumeKg: sessionVolumeKg(s),
    exercisesCompleted: s.exercises.filter((e) => e.sets.some(isCompletedWorking)).length,
    exercisesTotal: s.exercises.length,
    durationMs,
  };
}

/* ---------- Schedule ---------- */

export function activityForDate(schedule: WeeklySchedule, overrides: Map<LocalDate, ScheduleOverride> | ScheduleOverride[], date: LocalDate): ScheduledActivity {
  const map = Array.isArray(overrides) ? new Map(overrides.map((o) => [o.date, o])) : overrides;
  return map.get(date)?.activity ?? schedule.days[weekdayIndex(date)] ?? { kind: 'rest' };
}

export function plannedWorkoutDates(schedule: WeeklySchedule, overrides: ScheduleOverride[], from: LocalDate, to: LocalDate): LocalDate[] {
  if (to < from) return [];
  const map = new Map(overrides.map((o) => [o.date, o]));
  return dateRange(from, to).filter((d) => activityForDate(schedule, map, d).kind === 'workout');
}

export interface Adherence {
  planned: number;
  completed: number;
  percent: number | null; // null when nothing was planned
}

export function adherence(sessions: WorkoutSession[], schedule: WeeklySchedule, overrides: ScheduleOverride[], from: LocalDate, to: LocalDate): Adherence {
  const planned = plannedWorkoutDates(schedule, overrides, from, to).length;
  const completed = sessionsInRange(sessions, from, to).length;
  return { planned, completed, percent: planned === 0 ? null : Math.min(100, Math.round((completed / planned) * 100)) };
}

export interface WeekConsistency {
  weeks: number;
  metWeeks: number;
  percent: number | null;
}

/** Evaluates each fully elapsed Monday–Sunday week since the program start. */
export function consistency(sessions: WorkoutSession[], schedule: WeeklySchedule, overrides: ScheduleOverride[], programStart: LocalDate, todayDate: LocalDate): WeekConsistency {
  let weekStart = startOfWeek(programStart);
  const currentWeek = startOfWeek(todayDate);
  let weeks = 0;
  let metWeeks = 0;
  while (weekStart < currentWeek) {
    const from = weekStart < programStart ? programStart : weekStart;
    const to = addDays(weekStart, 6);
    const a = adherence(sessions, schedule, overrides, from, to);
    if (a.planned > 0) {
      weeks++;
      if (a.completed >= a.planned) metWeeks++;
    }
    weekStart = addDays(weekStart, 7);
  }
  return { weeks, metWeeks, percent: weeks === 0 ? null : Math.round((metWeeks / weeks) * 100) };
}

export interface WeeklyTrainingPoint {
  weekStart: LocalDate;
  sessions: number;
  workingSets: number;
  volumeKg: number;
}

export function weeklyTraining(sessions: WorkoutSession[], weeks: number, todayDate: LocalDate): WeeklyTrainingPoint[] {
  const thisWeek = startOfWeek(todayDate);
  const out: WeeklyTrainingPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i);
    const list = sessionsInRange(sessions, ws, addDays(ws, 6));
    out.push({
      weekStart: ws,
      sessions: list.length,
      workingSets: list.reduce((n, s) => n + completedWorkingSets(s), 0),
      volumeKg: list.reduce((n, s) => n + sessionVolumeKg(s), 0),
    });
  }
  return out;
}

/* ---------- Exercise history, PBs, strength ---------- */

export interface ExerciseLog {
  sessionId: string;
  date: LocalDate;
  startedAt: number;
  exercise: SessionExercise;
}

/** Completed-session entries for an exercise, newest first. */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string, excludeSessionId?: string): ExerciseLog[] {
  const out: ExerciseLog[] = [];
  for (const s of completedSessions(sessions)) {
    if (s.id === excludeSessionId) continue;
    for (const e of s.exercises) {
      if (e.exerciseId === exerciseId && e.sets.some(isCompletedWorking)) {
        out.push({ sessionId: s.id, date: s.date, startedAt: s.startedAt, exercise: e });
      }
    }
  }
  return out.sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1));
}

export function lastWorkingWeightKg(sessions: WorkoutSession[], exerciseId: string): number | null {
  const last = exerciseHistory(sessions, exerciseId)[0];
  if (!last) return null;
  const ws = last.exercise.sets.filter((s) => isCompletedWorking(s) && s.weightKg != null);
  return ws.length ? ws[ws.length - 1].weightKg : null;
}

export interface PersonalBests {
  heaviestKg: number | null;
  heaviestReps: number | null;
  bestSetVolumeKg: number | null;
  bestSessionVolumeKg: number | null;
  mostReps: number | null;
  longestHoldSec: number | null;
  sessions: number;
}

export function personalBests(sessions: WorkoutSession[], exerciseId: string): PersonalBests {
  const hist = exerciseHistory(sessions, exerciseId);
  const pb: PersonalBests = { heaviestKg: null, heaviestReps: null, bestSetVolumeKg: null, bestSessionVolumeKg: null, mostReps: null, longestHoldSec: null, sessions: hist.length };
  for (const h of hist) {
    const vol = exerciseVolumeKg(h.exercise);
    if (vol > 0 && (pb.bestSessionVolumeKg == null || vol > pb.bestSessionVolumeKg)) pb.bestSessionVolumeKg = vol;
    for (const s of h.exercise.sets.filter(isCompletedWorking)) {
      if (s.weightKg != null && s.weightKg > 0 && s.reps) {
        if (pb.heaviestKg == null || s.weightKg > pb.heaviestKg || (s.weightKg === pb.heaviestKg && s.reps > (pb.heaviestReps ?? 0))) {
          pb.heaviestKg = s.weightKg;
          pb.heaviestReps = s.reps;
        }
        const sv = s.weightKg * s.reps;
        if (pb.bestSetVolumeKg == null || sv > pb.bestSetVolumeKg) pb.bestSetVolumeKg = sv;
      }
      if (s.reps != null && (pb.mostReps == null || s.reps > pb.mostReps)) pb.mostReps = s.reps;
      if (s.seconds != null && (pb.longestHoldSec == null || s.seconds > pb.longestHoldSec)) pb.longestHoldSec = s.seconds;
    }
  }
  return pb;
}

export interface StrengthPoint {
  date: LocalDate;
  topKg: number | null;
  topReps: number | null;
  volumeKg: number;
}

/** Top completed working set (heaviest load, then most reps) per session, oldest first. */
export function strengthSeries(sessions: WorkoutSession[], exerciseId: string): StrengthPoint[] {
  return exerciseHistory(sessions, exerciseId)
    .reverse()
    .map((h) => {
      let topKg: number | null = null;
      let topReps: number | null = null;
      for (const s of h.exercise.sets.filter(isCompletedWorking)) {
        if (s.weightKg == null) continue;
        if (topKg == null || s.weightKg > topKg || (s.weightKg === topKg && (s.reps ?? 0) > (topReps ?? 0))) {
          topKg = s.weightKg;
          topReps = s.reps;
        }
      }
      return { date: h.date, topKg, topReps, volumeKg: exerciseVolumeKg(h.exercise) };
    });
}

export interface StrengthChange {
  firstKg: number;
  latestKg: number;
  changeKg: number;
  changePct: number;
  firstDate: LocalDate;
  latestDate: LocalDate;
}

/** Change in top working weight between the first and latest logged sessions. */
export function strengthChange(series: StrengthPoint[]): StrengthChange | null {
  const pts = series.filter((p) => p.topKg != null && p.topKg > 0);
  if (pts.length < 2) return null;
  const first = pts[0];
  const latest = pts[pts.length - 1];
  const changeKg = latest.topKg! - first.topKg!;
  return { firstKg: first.topKg!, latestKg: latest.topKg!, changeKg, changePct: (changeKg / first.topKg!) * 100, firstDate: first.date, latestDate: latest.date };
}

/* ---------- Progression ---------- */

export type ProgressionStatus = 'eligible' | 'not-yet' | 'no-data';

export interface ProgressionResult {
  status: ProgressionStatus;
  reason: string;
  currentKg: number | null;
  suggestedKg: number | null;
}

export function roundToIncrement(kg: number, incrementKg: number): number {
  if (incrementKg <= 0) return kg;
  return Number((Math.round(kg / incrementKg) * incrementKg).toFixed(4));
}

/**
 * Double-progression rule: an exercise is eligible for a load increase when every
 * prescribed working set was completed at the TOP of the rep range (or hold time),
 * at the same load, and the user confirmed technique was controlled.
 * The suggestion is the smallest available increment — always optional.
 */
export function evaluateProgression(e: SessionExercise | undefined, incrementKg: number): ProgressionResult {
  if (!e) return { status: 'no-data', reason: 'No completed sessions for this exercise yet.', currentKg: null, suggestedKg: null };
  const { prescribed } = e;
  const working = e.sets.filter((s) => s.kind === 'working');
  const done = working.filter((s) => s.completed);
  if (done.length === 0) return { status: 'no-data', reason: 'No completed working sets logged.', currentKg: null, suggestedKg: null };
  if (done.length < prescribed.sets) {
    return { status: 'not-yet', reason: `Completed ${done.length} of ${prescribed.sets} prescribed working sets.`, currentKg: done[0].weightKg, suggestedKg: null };
  }
  if (prescribed.measure === 'time') {
    const allTop = done.every((s) => (s.seconds ?? 0) >= prescribed.repMax);
    if (!allTop) return { status: 'not-yet', reason: `Build every hold to ${prescribed.repMax} s before progressing.`, currentKg: null, suggestedKg: null };
    if (!e.techniqueControlled) return { status: 'not-yet', reason: 'All holds reached the top of the range — confirm technique was controlled to unlock a suggestion.', currentKg: null, suggestedKg: null };
    return { status: 'eligible', reason: 'All holds reached the top of the range. Consider a harder variation or adding ~5–10 s — only if it feels controlled.', currentKg: null, suggestedKg: null };
  }
  const short = done.filter((s) => (s.reps ?? 0) < prescribed.repMax);
  if (short.length > 0) {
    return { status: 'not-yet', reason: `${short.length} set(s) below ${prescribed.repMax} reps. Add reps before adding load.`, currentKg: done[0].weightKg, suggestedKg: null };
  }
  const loads = done.map((s) => s.weightKg);
  if (loads.some((w) => w == null || w <= 0)) {
    if (!e.techniqueControlled) return { status: 'not-yet', reason: 'Top of the range reached — confirm technique was controlled to unlock a suggestion.', currentKg: null, suggestedKg: null };
    return { status: 'eligible', reason: 'Top of the range reached with body weight. Consider a harder variation or added load.', currentKg: null, suggestedKg: null };
  }
  const minLoad = Math.min(...(loads as number[]));
  const maxLoad = Math.max(...(loads as number[]));
  if (maxLoad - minLoad > 1e-6) {
    return { status: 'not-yet', reason: 'Sets used different loads. Hit the top of the range on all sets at one load first.', currentKg: minLoad, suggestedKg: null };
  }
  if (!e.techniqueControlled) {
    return { status: 'not-yet', reason: 'All sets reached the top of the range — confirm technique was controlled to unlock a suggestion.', currentKg: minLoad, suggestedKg: null };
  }
  const inc = incrementKg > 0 ? incrementKg : 2.5;
  return {
    status: 'eligible',
    reason: `All ${prescribed.sets} sets reached ${prescribed.repMax} reps with controlled technique. You may try the next small increment — staying at this load is also fine.`,
    currentKg: minLoad,
    suggestedKg: roundToIncrement(minLoad + inc, inc),
  };
}

export function progressionForExercise(sessions: WorkoutSession[], exerciseId: string, incrementKg: number): ProgressionResult {
  return evaluateProgression(exerciseHistory(sessions, exerciseId)[0]?.exercise, incrementKg);
}

/* ---------- Comparison ---------- */

export interface ExerciseComparison {
  exerciseId: string;
  name: string;
  a: SessionExercise | null;
  b: SessionExercise | null;
  volumeDeltaKg: number;
  setsDelta: number;
}

export function compareSessions(a: WorkoutSession, b: WorkoutSession): ExerciseComparison[] {
  const ids = Array.from(new Set([...a.exercises.map((e) => e.exerciseId), ...b.exercises.map((e) => e.exerciseId)]));
  return ids.map((id) => {
    const ea = a.exercises.find((e) => e.exerciseId === id) ?? null;
    const eb = b.exercises.find((e) => e.exerciseId === id) ?? null;
    return {
      exerciseId: id,
      name: (eb ?? ea)!.name,
      a: ea,
      b: eb,
      volumeDeltaKg: (eb ? exerciseVolumeKg(eb) : 0) - (ea ? exerciseVolumeKg(ea) : 0),
      setsDelta: (eb ? eb.sets.filter(isCompletedWorking).length : 0) - (ea ? ea.sets.filter(isCompletedWorking).length : 0),
    };
  });
}

export function daysSince(date: LocalDate, todayDate: LocalDate): number {
  return daysBetween(date, todayDate);
}
