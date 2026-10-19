import Dexie, { type Table } from 'dexie';
import type {
  BodyWeightEntry,
  CardioEntry,
  FavoriteMeal,
  FoodEntry,
  MeasurementEntry,
  MetaRow,
  Profile,
  ProgressPhoto,
  RecoveryEntry,
  ScheduleOverride,
  Target,
  WaterEntry,
  WeeklySchedule,
  WorkoutSession,
  WorkoutTemplate,
} from './types';

export const DB_NAME = 'forge';
/** Current Dexie schema version. Bump and add a `.version(n)` block for each change. */
export const SCHEMA_VERSION = 3;

export class ForgeDB extends Dexie {
  profile!: Table<Profile, string>;
  templates!: Table<WorkoutTemplate, string>;
  schedule!: Table<WeeklySchedule, string>;
  overrides!: Table<ScheduleOverride, string>;
  sessions!: Table<WorkoutSession, string>;
  cardio!: Table<CardioEntry, string>;
  foods!: Table<FoodEntry, string>;
  favorites!: Table<FavoriteMeal, string>;
  water!: Table<WaterEntry, string>;
  bodyweights!: Table<BodyWeightEntry, string>;
  measurements!: Table<MeasurementEntry, string>;
  photos!: Table<ProgressPhoto, string>;
  recovery!: Table<RecoveryEntry, string>;
  targets!: Table<Target, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = DB_NAME) {
    super(name);

    // v1 — initial schema
    this.version(1).stores({
      profile: 'id',
      templates: 'id',
      schedule: 'id',
      overrides: 'date',
      sessions: 'id, date, status, templateId',
      cardio: 'id, date, type',
      foods: 'id, date',
      favorites: 'id, name',
      water: 'id, date',
      bodyweights: 'id, &date',
      measurements: 'id, date',
      photos: 'id, date',
      recovery: 'id, &date',
      meta: 'key',
    });

    // v2 — adds optional targets table and backfills fields introduced after v1.
    this.version(2)
      .stores({ targets: 'id, kind' })
      .upgrade(async (tx) => {
        await tx
          .table('sessions')
          .toCollection()
          .modify((s: Partial<WorkoutSession>) => {
            if (s.exercises) {
              for (const ex of s.exercises) {
                if (typeof ex.techniqueControlled !== 'boolean') ex.techniqueControlled = false;
                if (typeof ex.notes !== 'string') ex.notes = '';
              }
            }
            if (s.restTimer === undefined) s.restTimer = null;
          });
      });

    // v3 — health concerns become user-entered profile fields (default to the safe setting).
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table('profile')
          .toCollection()
          .modify((p: Partial<Profile>) => {
            if (typeof p.healthConcerns !== 'boolean') p.healthConcerns = true;
            if (typeof p.healthNotes !== 'string') p.healthNotes = '';
          });
      });
  }
}

export const db = new ForgeDB();

/** Data tables included in backups (order matters for import). */
export const BACKUP_TABLES = [
  'profile',
  'templates',
  'schedule',
  'overrides',
  'sessions',
  'cardio',
  'foods',
  'favorites',
  'water',
  'bodyweights',
  'measurements',
  'photos',
  'recovery',
  'targets',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Request persistent storage so the browser is less likely to evict data. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* unsupported */
  }
  return null;
}
