import type { LocalDate, LoggedSet, MeasureType, SessionExercise, SetKind, TemplateExercise, WorkoutSession } from '../db/types';
import { getExercise } from '../data/exercises';
import { uid } from './id';

/**
 * Pure functions for creating and mutating workout sessions. Every function returns
 * a new session object; the caller persists it to IndexedDB immediately.
 */

export interface CreateSessionInput {
  templateId: string;
  templateName: string;
  exercises: TemplateExercise[];
  date: LocalDate;
  now: number;
  programWeek: number | null;
  /** Last completed working weight (kg) per exercise, used to pre-fill load fields. */
  previousWeightKg?: (exerciseId: string) => number | null;
  /** Deload: approximately half the working sets (rounded up, minimum 1). */
  deload?: boolean;
}

export function deloadSets(sets: number): number {
  return Math.max(1, Math.ceil(sets / 2));
}

export function emptySet(kind: SetKind, weightKg: number | null = null): LoggedSet {
  return { id: uid(), kind, weightKg, reps: null, seconds: null, rir: null, completed: false, completedAt: null };
}

export function createSession(input: CreateSessionInput): WorkoutSession {
  const exercises: SessionExercise[] = input.exercises.map((t) => {
    const sets = input.deload ? deloadSets(t.sets) : t.sets;
    const prev = input.previousWeightKg?.(t.exerciseId) ?? null;
    return {
      uid: uid(),
      exerciseId: t.exerciseId,
      name: getExercise(t.exerciseId)?.name ?? t.exerciseId,
      prescribed: {
        sets,
        repMin: t.repMin,
        repMax: t.repMax,
        measure: t.measure,
        perSide: t.perSide,
        restMinSec: t.restMinSec,
        restMaxSec: t.restMaxSec,
      },
      sets: Array.from({ length: sets }, () => emptySet('working', t.measure === 'reps' ? prev : null)),
      notes: t.note ?? '',
      techniqueControlled: false,
    };
  });
  return {
    id: uid(),
    templateId: input.templateId,
    templateName: input.deload ? `${input.templateName} (deload)` : input.templateName,
    date: input.date,
    startedAt: input.now,
    endedAt: null,
    status: 'active',
    pausedAt: null,
    pausedTotalMs: 0,
    programWeek: input.programWeek,
    exercises,
    notes: '',
    restTimer: null,
    updatedAt: input.now,
  };
}

const touch = (s: WorkoutSession, now: number): WorkoutSession => ({ ...s, updatedAt: now });

function mapExercise(s: WorkoutSession, exUid: string, fn: (e: SessionExercise) => SessionExercise): WorkoutSession {
  return { ...s, exercises: s.exercises.map((e) => (e.uid === exUid ? fn(e) : e)) };
}

export function addSet(s: WorkoutSession, exUid: string, kind: SetKind, now: number): WorkoutSession {
  return touch(
    mapExercise(s, exUid, (e) => {
      const last = [...e.sets].reverse().find((x) => x.kind === kind) ?? e.sets[e.sets.length - 1];
      const set = emptySet(kind, last?.weightKg ?? null);
      // Warm-ups are listed before working sets.
      if (kind === 'warmup') {
        const firstWorking = e.sets.findIndex((x) => x.kind === 'working');
        const idx = firstWorking === -1 ? e.sets.length : firstWorking;
        return { ...e, sets: [...e.sets.slice(0, idx), set, ...e.sets.slice(idx)] };
      }
      return { ...e, sets: [...e.sets, set] };
    }),
    now,
  );
}

export function removeSet(s: WorkoutSession, exUid: string, setId: string, now: number): WorkoutSession {
  return touch(mapExercise(s, exUid, (e) => ({ ...e, sets: e.sets.filter((x) => x.id !== setId) })), now);
}

export function updateSet(s: WorkoutSession, exUid: string, setId: string, patch: Partial<LoggedSet>, now: number): WorkoutSession {
  return touch(
    mapExercise(s, exUid, (e) => ({ ...e, sets: e.sets.map((x) => (x.id === setId ? { ...x, ...patch, id: x.id } : x)) })),
    now,
  );
}

export function updateExercise(s: WorkoutSession, exUid: string, patch: Partial<Pick<SessionExercise, 'notes' | 'techniqueControlled'>>, now: number): WorkoutSession {
  return touch(mapExercise(s, exUid, (e) => ({ ...e, ...patch })), now);
}

export function removeExercise(s: WorkoutSession, exUid: string, now: number): WorkoutSession {
  return touch({ ...s, exercises: s.exercises.filter((e) => e.uid !== exUid) }, now);
}

export function addExercise(s: WorkoutSession, t: TemplateExercise, now: number): WorkoutSession {
  const created = createSession({ templateId: s.templateId, templateName: s.templateName, exercises: [t], date: s.date, now, programWeek: s.programWeek });
  return touch({ ...s, exercises: [...s.exercises, created.exercises[0]] }, now);
}

export function moveExercise(s: WorkoutSession, exUid: string, delta: -1 | 1, now: number): WorkoutSession {
  const i = s.exercises.findIndex((e) => e.uid === exUid);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= s.exercises.length) return s;
  const list = [...s.exercises];
  [list[i], list[j]] = [list[j], list[i]];
  return touch({ ...s, exercises: list }, now);
}

/** Returns a validation message when a set cannot be marked complete, otherwise null. */
export function completionError(set: LoggedSet, measure: MeasureType): string | null {
  if (measure === 'time') {
    if (set.seconds == null || set.seconds <= 0) return 'Enter the hold time in seconds first.';
    return null;
  }
  if (set.reps == null || set.reps <= 0 || !Number.isInteger(set.reps)) return 'Enter the number of reps first.';
  if (set.weightKg != null && set.weightKg < 0) return 'Weight cannot be negative.';
  return null;
}

export function toggleSetComplete(s: WorkoutSession, exUid: string, setId: string, now: number): { session: WorkoutSession; error: string | null } {
  const ex = s.exercises.find((e) => e.uid === exUid);
  const set = ex?.sets.find((x) => x.id === setId);
  if (!ex || !set) return { session: s, error: 'Set not found.' };
  if (!set.completed) {
    const err = completionError(set, ex.prescribed.measure);
    if (err) return { session: s, error: err };
  }
  return {
    session: updateSet(s, exUid, setId, { completed: !set.completed, completedAt: set.completed ? null : now }, now),
    error: null,
  };
}

/* ---------- Session clock ---------- */

export function pauseSession(s: WorkoutSession, now: number): WorkoutSession {
  if (s.status !== 'active') return s;
  const paused = { ...s, status: 'paused' as const, pausedAt: now };
  return touch(s.restTimer ? { ...paused, restTimer: pauseRestTimer(s, now).restTimer } : paused, now);
}

export function resumeSession(s: WorkoutSession, now: number): WorkoutSession {
  if (s.status !== 'paused' || s.pausedAt == null) return s;
  return touch({ ...s, status: 'active', pausedTotalMs: s.pausedTotalMs + (now - s.pausedAt), pausedAt: null }, now);
}

export function finishSession(s: WorkoutSession, now: number): WorkoutSession {
  const resumed = s.status === 'paused' ? resumeSession(s, now) : s;
  return touch({ ...resumed, status: 'completed', endedAt: now, restTimer: null }, now);
}

/** Active training time excluding pauses. */
export function elapsedMs(s: WorkoutSession, now: number): number {
  const end = s.endedAt ?? (s.status === 'paused' && s.pausedAt != null ? s.pausedAt : now);
  return Math.max(0, end - s.startedAt - s.pausedTotalMs);
}

/* ---------- Rest timer ---------- */

export function startRestTimer(s: WorkoutSession, durationSec: number, exUid: string | null, now: number): WorkoutSession {
  return touch({ ...s, restTimer: { durationSec, endsAt: now + durationSec * 1000, pausedRemainingMs: null, exerciseUid: exUid } }, now);
}

export function restRemainingMs(s: WorkoutSession, now: number): number | null {
  const t = s.restTimer;
  if (!t) return null;
  if (t.pausedRemainingMs != null) return t.pausedRemainingMs;
  if (t.endsAt == null) return null;
  return Math.max(0, t.endsAt - now);
}

export function pauseRestTimer(s: WorkoutSession, now: number): WorkoutSession {
  const t = s.restTimer;
  if (!t || t.pausedRemainingMs != null) return s;
  return touch({ ...s, restTimer: { ...t, pausedRemainingMs: Math.max(0, (t.endsAt ?? now) - now), endsAt: null } }, now);
}

export function resumeRestTimer(s: WorkoutSession, now: number): WorkoutSession {
  const t = s.restTimer;
  if (!t || t.pausedRemainingMs == null) return s;
  return touch({ ...s, restTimer: { ...t, endsAt: now + t.pausedRemainingMs, pausedRemainingMs: null } }, now);
}

export function resetRestTimer(s: WorkoutSession, now: number): WorkoutSession {
  const t = s.restTimer;
  if (!t) return s;
  return startRestTimer(s, t.durationSec, t.exerciseUid, now);
}

export function skipRestTimer(s: WorkoutSession, now: number): WorkoutSession {
  return touch({ ...s, restTimer: null }, now);
}
