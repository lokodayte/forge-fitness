/** Local calendar date in the user's time zone, formatted YYYY-MM-DD. */
export type LocalDate = string;

export type WeightUnit = 'kg' | 'lb';
export type Sex = 'male' | 'female' | 'unspecified';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type ThemePref = 'dark' | 'light' | 'system';
export type CoreOption = 'original' | 'revised';
export type TemplateKey = 'A' | 'B' | 'C';

export interface MaintenanceEstimate {
  method: 'formula' | 'logs' | 'manual';
  kcal: number;
  setOn: LocalDate;
}

export interface Profile {
  id: 'me';
  name: string;
  age: number;
  heightCm: number;
  /** Starting body weight entered at onboarding (kg). Body-weight logs are stored separately. */
  startWeightKg: number;
  sex: Sex;
  experience: Experience;
  sessionsPerWeek: number;
  goal: string;
  units: WeightUnit;
  activityLevel: ActivityLevel;
  proteinMinG: number;
  proteinMaxG: number;
  waterTargetMl: number;
  maintenance: MaintenanceEstimate | null;
  /** Planned deficit (kcal/day, 250–400). Only applied once a maintenance estimate exists. */
  deficitKcal: number;
  deficitEnabled: boolean;
  programStartDate: LocalDate;
  /** True when the user reported symptoms/conditions that should be checked before resistance training. */
  healthConcerns: boolean;
  /** The user's own description of those concerns. Stored only on this device. */
  healthNotes: string;
  medicalClearance: { cleared: boolean; date: LocalDate | null; note: string };
  medicalNoticeAcknowledged: boolean;
  coreOption: CoreOption;
  sidePlankOn: TemplateKey | null;
  /** Smallest plate/pin increment the user has access to (kg). */
  incrementKg: number;
  theme: ThemePref;
  reduceMotion: boolean;
  bedtime: string | null; // "HH:MM"
  remindersEnabled: boolean;
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
}

export type MeasureType = 'reps' | 'time';

export interface TemplateExercise {
  uid: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  measure: MeasureType;
  /** For time-based: min/max seconds held. For reps-based ignored. */
  perSide?: boolean;
  restMinSec: number;
  restMaxSec: number;
  note?: string;
}

export interface WorkoutTemplate {
  id: string; // 'A' | 'B' | 'C' or custom uuid
  name: string;
  exercises: TemplateExercise[];
  updatedAt: number;
}

export type ScheduledActivity =
  | { kind: 'workout'; templateId: string }
  | { kind: 'walk'; minMinutes: number; maxMinutes: number }
  | { kind: 'cardio'; minMinutes: number; maxMinutes: number }
  | { kind: 'rest' };

export interface WeeklySchedule {
  id: 'week';
  /** Index 0 = Monday … 6 = Sunday. */
  days: ScheduledActivity[];
}

export interface ScheduleOverride {
  date: LocalDate;
  activity: ScheduledActivity;
  note?: string;
}

export type SetKind = 'warmup' | 'working';

export interface LoggedSet {
  id: string;
  kind: SetKind;
  /** Load in kilograms (canonical). null = bodyweight / not applicable. */
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  rir: number | null;
  completed: boolean;
  completedAt: number | null;
}

export interface SessionExercise {
  uid: string;
  exerciseId: string;
  /** Name snapshot so history survives library/template edits. */
  name: string;
  prescribed: {
    sets: number;
    repMin: number;
    repMax: number;
    measure: MeasureType;
    perSide?: boolean;
    restMinSec: number;
    restMaxSec: number;
  };
  sets: LoggedSet[];
  notes: string;
  techniqueControlled: boolean;
}

export interface RestTimer {
  durationSec: number;
  /** epoch ms when the timer ends (running) */
  endsAt: number | null;
  /** remaining ms when paused */
  pausedRemainingMs: number | null;
  exerciseUid: string | null;
}

export type SessionStatus = 'active' | 'paused' | 'completed';

export interface WorkoutSession {
  id: string;
  templateId: string;
  templateName: string;
  date: LocalDate;
  startedAt: number;
  endedAt: number | null;
  status: SessionStatus;
  pausedAt: number | null;
  pausedTotalMs: number;
  programWeek: number | null;
  exercises: SessionExercise[];
  notes: string;
  restTimer: RestTimer | null;
  updatedAt: number;
}

export type CardioType = 'walking' | 'cycling' | 'elliptical' | 'rowing' | 'swimming' | 'hiking' | 'other';

export interface CardioEntry {
  id: string;
  date: LocalDate;
  type: CardioType;
  label?: string;
  durationMin: number;
  distanceKm: number | null;
  avgHr: number | null;
  /** Perceived effort 1–10 */
  effort: number | null;
  notes: string;
  createdAt: number;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodEntry {
  id: string;
  date: LocalDate;
  meal: MealType;
  name: string;
  servings: number;
  /** Per serving values. calories null = derive from macros (4/4/9). */
  calories: number | null;
  proteinG: number;
  carbsG: number;
  fatG: number;
  createdAt: number;
}

export interface FavoriteMeal {
  id: string;
  name: string;
  calories: number | null;
  proteinG: number;
  carbsG: number;
  fatG: number;
  createdAt: number;
}

export interface WaterEntry {
  id: string;
  date: LocalDate;
  ml: number;
  createdAt: number;
}

export interface BodyWeightEntry {
  id: string;
  date: LocalDate;
  weightKg: number;
  note: string;
  createdAt: number;
}

export interface MeasurementEntry {
  id: string;
  date: LocalDate;
  waistCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  hipCm: number | null;
  thighCm: number | null;
  note: string;
  createdAt: number;
}

export interface ProgressPhoto {
  id: string;
  date: LocalDate;
  pose: 'front' | 'side' | 'back' | 'other';
  blob: Blob;
  note: string;
  createdAt: number;
}

export interface RecoveryEntry {
  id: string;
  date: LocalDate;
  sleepHours: number | null;
  /** 1 (poor) – 5 (excellent) */
  sleepQuality: number | null;
  /** 1 (none) – 5 (very high) */
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  /** Self-rated readiness 1 (low) – 5 (high) */
  readiness: number | null;
  notes: string;
  createdAt: number;
}

export interface Target {
  id: string;
  kind: 'weight' | 'waist' | 'cardioWeekly' | 'workoutsWeekly';
  value: number;
  byDate: LocalDate | null;
  createdAt: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
