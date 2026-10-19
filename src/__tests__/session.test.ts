import { describe, expect, it } from 'vitest';
import * as S from '../lib/session';
import { summarizeSession } from '../lib/training';
import type { TemplateExercise } from '../db/types';

const tmpl: TemplateExercise[] = [
  { uid: 'a', exerciseId: 'leg-press', sets: 3, repMin: 8, repMax: 12, measure: 'reps', restMinSec: 120, restMaxSec: 180 },
  { uid: 'b', exerciseId: 'side-plank', sets: 2, repMin: 20, repMax: 40, measure: 'time', perSide: true, restMinSec: 60, restMaxSec: 60 },
];

const T0 = 1_700_000_000_000;
const make = (deload = false) => S.createSession({ templateId: 'A', templateName: 'Workout A', exercises: tmpl, date: '2026-10-19', now: T0, programWeek: 1, previousWeightKg: (id) => (id === 'leg-press' ? 80 : null), deload });

describe('workout session tracking', () => {
  it('creates working sets from the template and pre-fills previous load', () => {
    const s = make();
    expect(s.status).toBe('active');
    expect(s.exercises[0].sets).toHaveLength(3);
    expect(s.exercises[0].sets.every((x) => x.weightKg === 80 && !x.completed)).toBe(true);
    expect(s.exercises[1].sets[0].weightKg).toBeNull();
    expect(s.exercises[0].name).toBe('Leg press');
  });

  it('halves sets for a deload (rounded up)', () => {
    const s = make(true);
    expect(s.exercises.map((e) => e.sets.length)).toEqual([2, 1]);
    expect(s.templateName).toContain('deload');
  });

  it('validates before completing a set', () => {
    let s = make();
    const ex = s.exercises[0];
    const res = S.toggleSetComplete(s, ex.uid, ex.sets[0].id, T0 + 1000);
    expect(res.error).toMatch(/reps/);
    s = S.updateSet(s, ex.uid, ex.sets[0].id, { reps: 12 }, T0);
    const ok = S.toggleSetComplete(s, ex.uid, ex.sets[0].id, T0 + 1000);
    expect(ok.error).toBeNull();
    expect(ok.session.exercises[0].sets[0].completed).toBe(true);
    // timed holds need seconds
    const plank = s.exercises[1];
    expect(S.toggleSetComplete(s, plank.uid, plank.sets[0].id, T0).error).toMatch(/seconds/);
    // un-ticking always works
    const back = S.toggleSetComplete(ok.session, ex.uid, ex.sets[0].id, T0 + 2000);
    expect(back.session.exercises[0].sets[0].completed).toBe(false);
  });

  it('inserts warm-ups before working sets and keeps them out of volume', () => {
    let s = make();
    const ex = s.exercises[0];
    s = S.addSet(s, ex.uid, 'warmup', T0);
    expect(s.exercises[0].sets[0].kind).toBe('warmup');
    const w = s.exercises[0].sets[0];
    s = S.updateSet(s, ex.uid, w.id, { weightKg: 40, reps: 10, completed: true }, T0);
    const sum = summarizeSession(s, 0);
    expect(sum.volumeKg).toBe(0);
    expect(sum.warmupSets).toBe(1);
    expect(sum.workingSets).toBe(0);
  });

  it('pauses and resumes the session clock', () => {
    let s = make();
    expect(S.elapsedMs(s, T0 + 60_000)).toBe(60_000);
    s = S.pauseSession(s, T0 + 60_000);
    expect(s.status).toBe('paused');
    expect(S.elapsedMs(s, T0 + 600_000)).toBe(60_000); // frozen while paused
    s = S.resumeSession(s, T0 + 120_000);
    expect(S.elapsedMs(s, T0 + 180_000)).toBe(120_000);
    s = S.finishSession(s, T0 + 240_000);
    expect(s.status).toBe('completed');
    expect(S.elapsedMs(s, T0 + 999_999)).toBe(180_000);
  });

  it('runs a rest timer with pause, resume, reset and skip', () => {
    let s = S.startRestTimer(make(), 120, null, T0);
    expect(S.restRemainingMs(s, T0 + 30_000)).toBe(90_000);
    s = S.pauseRestTimer(s, T0 + 30_000);
    expect(S.restRemainingMs(s, T0 + 90_000)).toBe(90_000);
    s = S.resumeRestTimer(s, T0 + 90_000);
    expect(S.restRemainingMs(s, T0 + 100_000)).toBe(80_000);
    expect(S.restRemainingMs(s, T0 + 999_000)).toBe(0);
    s = S.resetRestTimer(s, T0 + 200_000);
    expect(S.restRemainingMs(s, T0 + 200_000)).toBe(120_000);
    s = S.skipRestTimer(s, T0);
    expect(S.restRemainingMs(s, T0)).toBeNull();
  });

  it('pausing the session also pauses the rest timer', () => {
    let s = S.startRestTimer(make(), 60, null, T0);
    s = S.pauseSession(s, T0 + 10_000);
    expect(S.restRemainingMs(s, T0 + 50_000)).toBe(50_000);
  });

  it('adds, moves and removes exercises without touching others', () => {
    let s = make();
    s = S.addExercise(s, { uid: 'x', exerciseId: 'dead-bug', sets: 2, repMin: 8, repMax: 12, measure: 'reps', restMinSec: 60, restMaxSec: 60 }, T0);
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(['leg-press', 'side-plank', 'dead-bug']);
    s = S.moveExercise(s, s.exercises[2].uid, -1, T0);
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(['leg-press', 'dead-bug', 'side-plank']);
    s = S.removeExercise(s, s.exercises[0].uid, T0);
    expect(s.exercises).toHaveLength(2);
  });
});
