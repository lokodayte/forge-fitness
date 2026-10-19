import { describe, expect, it } from 'vitest';
import { defaultSchedule } from '../data/program';
import { activityForDate, adherence, compareSessions, completedWorkingSets, consistency, evaluateProgression, exerciseHistory, lastWorkingWeightKg, personalBests, plannedWorkoutDates, roundToIncrement, sessionVolumeKg, setVolumeKg, strengthChange, strengthSeries, weeklyTraining } from '../lib/training';
import { exercise, session, set } from './fixtures';

describe('volume and sets', () => {
  it('counts only completed working sets with load × reps', () => {
    expect(setVolumeKg(set({ weightKg: 50, reps: 10 }))).toBe(500);
    expect(setVolumeKg(set({ kind: 'warmup', weightKg: 50, reps: 10 }))).toBe(0);
    expect(setVolumeKg(set({ completed: false }))).toBe(0);
    expect(setVolumeKg(set({ weightKg: null, reps: 10 }))).toBe(0);
    expect(setVolumeKg(set({ weightKg: null, reps: null, seconds: 30 }))).toBe(0);
  });

  it('sums a session', () => {
    const s = session('2026-10-19', [
      exercise('leg-press', [set({ weightKg: 100, reps: 12 }), set({ weightKg: 100, reps: 10 }), set({ kind: 'warmup', weightKg: 60, reps: 10 })]),
      exercise('machine-chest-press', [set({ weightKg: 40, reps: 8 }), set({ completed: false, weightKg: 40, reps: 8 })]),
    ]);
    expect(sessionVolumeKg(s)).toBe(100 * 12 + 100 * 10 + 40 * 8);
    expect(completedWorkingSets(s)).toBe(3);
  });
});

describe('schedule & adherence', () => {
  const schedule = defaultSchedule();

  it('maps weekdays to the default plan and respects overrides', () => {
    expect(activityForDate(schedule, [], '2026-10-19')).toEqual({ kind: 'workout', templateId: 'A' }); // Monday
    expect(activityForDate(schedule, [], '2026-10-18').kind).toBe('rest'); // Sunday
    expect(activityForDate(schedule, [{ date: '2026-10-19', activity: { kind: 'rest' } }], '2026-10-19').kind).toBe('rest');
  });

  it('counts planned workouts in a range', () => {
    expect(plannedWorkoutDates(schedule, [], '2026-10-19', '2026-10-25')).toEqual(['2026-10-19', '2026-10-21', '2026-10-23']);
  });

  it('computes completed vs planned percentage (capped at 100)', () => {
    const sessions = [session('2026-10-19', []), session('2026-10-21', [])];
    expect(adherence(sessions, schedule, [], '2026-10-19', '2026-10-25')).toEqual({ planned: 3, completed: 2, percent: 67 });
    const extra = [...sessions, session('2026-10-22', []), session('2026-10-24', [])];
    expect(adherence(extra, schedule, [], '2026-10-19', '2026-10-25').percent).toBe(100);
    expect(adherence([], schedule, [], '2026-10-25', '2026-10-25').percent).toBeNull();
  });

  it('ignores sessions that are not completed', () => {
    const active = session('2026-10-19', [], { status: 'active' });
    expect(adherence([active], schedule, [], '2026-10-19', '2026-10-25').completed).toBe(0);
  });

  it('measures consistency over full weeks only', () => {
    const sessions = ['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-27'].map((d) => session(d, []));
    // weeks starting 19 Oct (3/3 met) and 26 Oct (1/3 not met); current week excluded
    expect(consistency(sessions, schedule, [], '2026-10-19', '2026-11-04')).toEqual({ weeks: 2, metWeeks: 1, percent: 50 });
  });

  it('builds weekly frequency series', () => {
    const sessions = [session('2026-10-19', [exercise('leg-press', [set()])]), session('2026-10-21', [])];
    const w = weeklyTraining(sessions, 2, '2026-10-25');
    expect(w.map((x) => x.sessions)).toEqual([0, 2]);
    expect(w[1].volumeKg).toBe(500);
    expect(w[1].workingSets).toBe(1);
  });
});

describe('history, PBs and strength', () => {
  const s1 = session('2026-10-05', [exercise('leg-press', [set({ weightKg: 80, reps: 12 }), set({ weightKg: 80, reps: 11 })])]);
  const s2 = session('2026-10-12', [exercise('leg-press', [set({ weightKg: 90, reps: 10 }), set({ weightKg: 85, reps: 12 })])]);
  const s3 = session('2026-10-19', [exercise('leg-press', [set({ weightKg: 90, reps: 12 })]), exercise('side-plank', [set({ weightKg: null, reps: null, seconds: 35 })], { prescribed: { sets: 2, repMin: 20, repMax: 40, measure: 'time', restMinSec: 60, restMaxSec: 60 } })]);
  const all = [s2, s3, s1];

  it('orders history newest first and finds last working weight', () => {
    expect(exerciseHistory(all, 'leg-press').map((h) => h.date)).toEqual(['2026-10-19', '2026-10-12', '2026-10-05']);
    expect(lastWorkingWeightKg(all, 'leg-press')).toBe(90);
    expect(lastWorkingWeightKg(all, 'hack-squat')).toBeNull();
  });

  it('computes personal bests', () => {
    const pb = personalBests(all, 'leg-press');
    expect(pb.heaviestKg).toBe(90);
    expect(pb.heaviestReps).toBe(12);
    expect(pb.bestSetVolumeKg).toBe(1080);
    expect(pb.sessions).toBe(3);
    expect(personalBests(all, 'side-plank').longestHoldSec).toBe(35);
  });

  it('builds strength series and change from real logs', () => {
    const series = strengthSeries(all, 'leg-press');
    expect(series.map((p) => p.topKg)).toEqual([80, 90, 90]);
    const c = strengthChange(series)!;
    expect(c.changeKg).toBe(10);
    expect(c.changePct).toBeCloseTo(12.5);
    expect(strengthChange(series.slice(0, 1))).toBeNull();
  });

  it('compares two sessions exercise by exercise', () => {
    const rows = compareSessions(s1, s3);
    const lp = rows.find((r) => r.exerciseId === 'leg-press')!;
    expect(lp.volumeDeltaKg).toBe(1080 - (960 + 880));
    expect(rows.find((r) => r.exerciseId === 'side-plank')!.a).toBeNull();
  });
});

describe('progression eligibility', () => {
  const ex = (reps: number[], p: { tc?: boolean; loads?: (number | null)[] } = {}) =>
    exercise('leg-press', reps.map((r, i) => set({ reps: r, weightKg: p.loads ? p.loads[i] : 100 })), { techniqueControlled: p.tc ?? true });

  it('is eligible only when every prescribed set hits the top of the range with controlled technique', () => {
    const r = evaluateProgression(ex([12, 12, 12]), 2.5);
    expect(r.status).toBe('eligible');
    expect(r.suggestedKg).toBe(102.5);
  });

  it('requires reps before load', () => {
    const r = evaluateProgression(ex([12, 12, 11]), 2.5);
    expect(r.status).toBe('not-yet');
    expect(r.suggestedKg).toBeNull();
  });

  it('requires all prescribed sets', () => {
    expect(evaluateProgression(ex([12, 12]), 2.5).status).toBe('not-yet');
  });

  it('requires confirmed technique', () => {
    expect(evaluateProgression(ex([12, 12, 12], { tc: false }), 2.5).status).toBe('not-yet');
  });

  it('requires a single load across sets', () => {
    expect(evaluateProgression(ex([12, 12, 12], { loads: [100, 100, 95] }), 2.5).status).toBe('not-yet');
  });

  it('never suggests a load for body-weight or timed work', () => {
    const bw = evaluateProgression(ex([12, 12, 12], { loads: [null, null, null] }), 2.5);
    expect(bw.status).toBe('eligible');
    expect(bw.suggestedKg).toBeNull();
    const plank = exercise('side-plank', [set({ weightKg: null, reps: null, seconds: 40 }), set({ weightKg: null, reps: null, seconds: 40 })], { prescribed: { sets: 2, repMin: 20, repMax: 40, measure: 'time', restMinSec: 60, restMaxSec: 60 } });
    expect(evaluateProgression(plank, 2.5).status).toBe('eligible');
    expect(evaluateProgression(plank, 2.5).suggestedKg).toBeNull();
  });

  it('handles missing data and rounds to the increment', () => {
    expect(evaluateProgression(undefined, 2.5).status).toBe('no-data');
    expect(roundToIncrement(41.3, 2.5)).toBe(42.5);
    expect(roundToIncrement(41.3, 0)).toBe(41.3);
  });
});
