import type { CoreOption, Profile, ScheduledActivity, TemplateExercise, TemplateKey, WeeklySchedule, WorkoutTemplate } from '../db/types';
import { uid } from '../lib/id';

type Row = [exerciseId: string, sets: number, repMin: number, repMax: number, restMin: number, restMax: number];

const toExercises = (rows: Row[]): TemplateExercise[] =>
  rows.map(([exerciseId, sets, repMin, repMax, restMinSec, restMaxSec]) => ({
    uid: uid(),
    exerciseId,
    sets,
    repMin,
    repMax,
    measure: 'reps',
    restMinSec,
    restMaxSec,
  }));

export const DEFAULT_TEMPLATE_ROWS: Record<TemplateKey, Row[]> = {
  A: [
    ['leg-press', 3, 8, 12, 120, 180],
    ['machine-chest-press', 3, 8, 12, 120, 120],
    ['chest-supported-row', 3, 8, 12, 120, 120],
    ['seated-leg-curl', 2, 10, 15, 90, 90],
    ['machine-lateral-raise', 3, 12, 20, 60, 60],
    ['cable-triceps-pushdown', 2, 10, 15, 60, 60],
    ['ab-crunch-machine', 2, 12, 15, 60, 60],
  ],
  B: [
    ['hack-squat', 3, 8, 12, 120, 180],
    ['seated-leg-curl', 3, 10, 12, 90, 90],
    ['lat-pulldown', 3, 8, 12, 120, 120],
    ['incline-chest-press', 3, 8, 12, 120, 120],
    ['reverse-pec-deck', 3, 12, 15, 60, 90],
    ['preacher-curl-machine', 3, 10, 15, 60, 60],
    ['standing-calf-raise', 3, 12, 15, 60, 60],
  ],
  C: [
    ['leg-press', 3, 10, 12, 120, 180],
    ['machine-shoulder-press', 3, 8, 12, 120, 120],
    ['seated-cable-row', 3, 10, 12, 120, 120],
    ['pec-deck', 2, 12, 15, 90, 90],
    ['leg-extension', 2, 12, 15, 90, 90],
    ['cable-biceps-curl', 2, 10, 15, 60, 60],
    ['triceps-extension-machine', 2, 10, 15, 60, 60],
    ['ab-crunch-machine', 2, 12, 15, 60, 60],
  ],
};

export function defaultTemplates(now = Date.now()): WorkoutTemplate[] {
  return (['A', 'B', 'C'] as TemplateKey[]).map((k) => ({
    id: k,
    name: `Workout ${k}`,
    exercises: toExercises(DEFAULT_TEMPLATE_ROWS[k]),
    updatedAt: now,
  }));
}

export function defaultSchedule(): WeeklySchedule {
  return {
    id: 'week',
    days: [
      { kind: 'workout', templateId: 'A' },
      { kind: 'walk', minMinutes: 30, maxMinutes: 40 },
      { kind: 'workout', templateId: 'B' },
      { kind: 'walk', minMinutes: 30, maxMinutes: 40 },
      { kind: 'workout', templateId: 'C' },
      { kind: 'cardio', minMinutes: 30, maxMinutes: 45 },
      { kind: 'rest' },
    ],
  };
}

export function describeActivity(a: ScheduledActivity, templateName?: (id: string) => string): string {
  switch (a.kind) {
    case 'workout':
      return templateName ? templateName(a.templateId) : `Workout ${a.templateId}`;
    case 'walk':
      return `Walking, ${a.minMinutes}–${a.maxMinutes} min`;
    case 'cardio':
      return `Moderate cardio, ${a.minMinutes}–${a.maxMinutes} min`;
    case 'rest':
      return 'Rest & recovery';
  }
}

/* ---------------- Core programming ---------------- */

const CRUNCH_MACHINE = 'ab-crunch-machine';

interface CoreRule {
  replace?: { from: string; to: TemplateExercise };
  add?: TemplateExercise;
}

const core = (exerciseId: string, sets: number, repMin: number, repMax: number, measure: 'reps' | 'time' = 'reps', perSide = false): TemplateExercise => ({
  uid: `core-${exerciseId}`,
  exerciseId,
  sets,
  repMin,
  repMax,
  measure,
  perSide,
  restMinSec: 60,
  restMaxSec: 60,
});

/** Revised core programming (intended for use after medical clearance). */
export const REVISED_CORE: Record<TemplateKey, CoreRule> = {
  A: { replace: { from: CRUNCH_MACHINE, to: core('cable-crunch', 2, 10, 15) } },
  B: { add: core('dead-bug', 2, 8, 12, 'reps', true) },
  C: { replace: { from: CRUNCH_MACHINE, to: core('reverse-crunch', 2, 8, 12) } },
};

export const SIDE_PLANK = core('side-plank', 2, 20, 40, 'time', true);

/**
 * Returns the exercise list for a template after applying the user's core option.
 * - 'original' leaves the template unchanged (aside from the optional side plank).
 * - 'revised' swaps/adds core work per REVISED_CORE.
 * Never stacks duplicates: an exercise already present is not added again, and when
 * the replacement already exists the crunch machine is simply removed.
 */
export function applyCoreOption(
  templateId: string,
  exercises: TemplateExercise[],
  option: CoreOption,
  sidePlankOn: TemplateKey | null,
): TemplateExercise[] {
  let list = exercises.map((e) => ({ ...e }));
  const has = (id: string) => list.some((e) => e.exerciseId === id);
  const key = templateId as TemplateKey;

  if (option === 'revised' && key in REVISED_CORE) {
    const rule = REVISED_CORE[key];
    if (rule.replace) {
      const { from, to } = rule.replace;
      if (has(to.exerciseId)) {
        list = list.filter((e) => e.exerciseId !== from);
      } else if (has(from)) {
        list = list.map((e) => (e.exerciseId === from ? { ...to, uid: e.uid } : e));
      } else {
        list.push({ ...to });
      }
    }
    if (rule.add && !has(rule.add.exerciseId)) list.push({ ...rule.add });
  }

  if (sidePlankOn === key && !has(SIDE_PLANK.exerciseId)) list.push({ ...SIDE_PLANK });
  return list;
}

export function templateKeyForName(id: string): TemplateKey | null {
  return id === 'A' || id === 'B' || id === 'C' ? id : null;
}

/* ---------------- Profile defaults ---------------- */

export function defaultProfile(todayDate: string, now = Date.now()): Profile {
  return {
    id: 'me',
    name: '',
    // Personal details are entered during onboarding (0 = not entered yet).
    age: 0,
    heightCm: 0,
    startWeightKg: 0,
    sex: 'unspecified',
    experience: 'intermediate',
    sessionsPerWeek: 3,
    goal: 'Body recomposition — build or preserve muscle while gradually losing fat.',
    units: 'kg',
    activityLevel: 'moderate',
    proteinMinG: 140,
    proteinMaxG: 175,
    waterTargetMl: 3000,
    maintenance: null,
    deficitKcal: 300,
    deficitEnabled: false,
    programStartDate: todayDate,
    healthConcerns: true,
    healthNotes: '',
    medicalClearance: { cleared: false, date: null, note: '' },
    medicalNoticeAcknowledged: false,
    coreOption: 'original',
    sidePlankOn: null,
    incrementKg: 2.5,
    theme: 'dark',
    reduceMotion: false,
    bedtime: null,
    remindersEnabled: false,
    onboarded: false,
    createdAt: now,
    updatedAt: now,
  };
}
