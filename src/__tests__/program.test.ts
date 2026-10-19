import { describe, expect, it } from 'vitest';
import { applyCoreOption, DEFAULT_TEMPLATE_ROWS, defaultProfile, defaultSchedule, defaultTemplates } from '../data/program';
import { getExercise } from '../data/exercises';
import { phaseStatus, programWeek } from '../data/phases';

const ids = (list: { exerciseId: string }[]) => list.map((e) => e.exerciseId);

describe('default program', () => {
  it('matches the specified workouts and schedule', () => {
    const [A, B, C] = defaultTemplates();
    expect(A.exercises).toHaveLength(7);
    expect(B.exercises).toHaveLength(7);
    expect(C.exercises).toHaveLength(8);
    expect(A.exercises[0]).toMatchObject({ exerciseId: 'leg-press', sets: 3, repMin: 8, repMax: 12, restMinSec: 120, restMaxSec: 180 });
    expect(B.exercises[4]).toMatchObject({ exerciseId: 'reverse-pec-deck', sets: 3, repMin: 12, repMax: 15, restMinSec: 60, restMaxSec: 90 });
    expect(defaultSchedule().days.map((d) => d.kind)).toEqual(['workout', 'walk', 'workout', 'walk', 'workout', 'cardio', 'rest']);
    for (const rows of Object.values(DEFAULT_TEMPLATE_ROWS)) for (const [id] of rows) expect(getExercise(id)).toBeDefined();
  });

  it('ships no personal details and defaults to the safe health setting', () => {
    const p = defaultProfile('2026-10-18');
    expect(p).toMatchObject({ age: 0, heightCm: 0, startWeightKg: 0, healthNotes: '', healthConcerns: true, sessionsPerWeek: 3, maintenance: null, onboarded: false });
    expect(p.medicalClearance.cleared).toBe(false);
  });
});

describe('core options', () => {
  const [A, B, C] = defaultTemplates();
  it('leaves templates unchanged for the original option', () => {
    expect(ids(applyCoreOption('A', A.exercises, 'original', null))).toEqual(ids(A.exercises));
  });
  it('applies the revised programming', () => {
    const a = ids(applyCoreOption('A', A.exercises, 'revised', null));
    expect(a).toContain('cable-crunch');
    expect(a).not.toContain('ab-crunch-machine');
    expect(ids(applyCoreOption('B', B.exercises, 'revised', null)).at(-1)).toBe('dead-bug');
    const c = applyCoreOption('C', C.exercises, 'revised', null);
    expect(ids(c)).toContain('reverse-crunch');
    expect(c.find((e) => e.exerciseId === 'reverse-crunch')).toMatchObject({ sets: 2, repMin: 8, repMax: 12 });
  });
  it('never stacks duplicates', () => {
    const withCable = [...A.exercises, { ...A.exercises[0], uid: 'z', exerciseId: 'cable-crunch' }];
    const out = ids(applyCoreOption('A', withCable, 'revised', 'A'));
    expect(out.filter((x) => x === 'cable-crunch')).toHaveLength(1);
    expect(out).not.toContain('ab-crunch-machine');
    const twice = applyCoreOption('B', applyCoreOption('B', B.exercises, 'revised', 'B'), 'revised', 'B');
    expect(ids(twice).filter((x) => x === 'dead-bug')).toHaveLength(1);
    expect(ids(twice).filter((x) => x === 'side-plank')).toHaveLength(1);
  });
  it('adds the optional side plank only to the chosen workout', () => {
    expect(ids(applyCoreOption('C', C.exercises, 'original', 'B'))).not.toContain('side-plank');
    const b = applyCoreOption('B', B.exercises, 'original', 'B');
    expect(b.at(-1)).toMatchObject({ exerciseId: 'side-plank', measure: 'time', repMin: 20, repMax: 40, perSide: true });
  });
});

describe('12-week phases', () => {
  it('computes program week and phase', () => {
    expect(programWeek('2026-10-19', '2026-10-19')).toBe(1);
    expect(programWeek('2026-10-19', '2026-10-25')).toBe(1);
    expect(programWeek('2026-10-19', '2026-10-26')).toBe(2);
    expect(phaseStatus('2026-10-19', '2026-11-02').phase?.id).toBe('progression'); // week 3
    expect(phaseStatus('2026-10-19', addWeeks('2026-10-19', 6)).phase?.id).toBe('deload'); // week 7
    expect(phaseStatus('2026-10-19', addWeeks('2026-10-19', 7)).phase?.id).toBe('overload'); // week 8
    expect(phaseStatus('2026-10-19', addWeeks('2026-10-19', 12)).complete).toBe(true);
    const before = phaseStatus('2026-10-19', '2026-10-16');
    expect(before.started).toBe(false);
    expect(before.daysUntilStart).toBe(3);
  });
});

function addWeeks(d: string, n: number) {
  const [y, m, day] = d.split('-').map(Number);
  const x = new Date(y, m - 1, day + 7 * n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
