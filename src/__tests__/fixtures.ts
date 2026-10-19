import type { LoggedSet, SessionExercise, WorkoutSession } from '../db/types';

let n = 0;
export const set = (p: Partial<LoggedSet> = {}): LoggedSet => ({ id: `s${++n}`, kind: 'working', weightKg: 50, reps: 10, seconds: null, rir: 2, completed: true, completedAt: 1, ...p });

export const exercise = (exerciseId: string, sets: LoggedSet[], p: Partial<SessionExercise> = {}): SessionExercise => ({
  uid: `e${++n}`,
  exerciseId,
  name: exerciseId,
  prescribed: { sets: 3, repMin: 8, repMax: 12, measure: 'reps', restMinSec: 120, restMaxSec: 180 },
  sets,
  notes: '',
  techniqueControlled: true,
  ...p,
});

export const session = (date: string, exercises: SessionExercise[], p: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: `sess${++n}`,
  templateId: 'A',
  templateName: 'Workout A',
  date,
  startedAt: Date.parse(`${date}T10:00:00`),
  endedAt: Date.parse(`${date}T11:00:00`),
  status: 'completed',
  pausedAt: null,
  pausedTotalMs: 0,
  programWeek: 1,
  exercises,
  notes: '',
  restTimer: null,
  updatedAt: 0,
  ...p,
});
