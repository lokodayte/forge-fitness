import { BACKUP_TABLES, SCHEMA_VERSION, type BackupTable, type ForgeDB } from '../db/db';
import type { WorkoutSession } from '../db/types';
import { isLocalDate } from './dates';

export const BACKUP_APP_ID = 'FORGE';
export const BACKUP_FORMAT = 1;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  format: number;
  schemaVersion: number;
  exportedAt: string;
  includesPhotos: boolean;
  tables: Partial<Record<BackupTable, Record<string, unknown>[]>>;
}

/* ---------- Blob <-> data URL (photos) ---------- */

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('Invalid image data');
  const type = m[1] ?? 'application/octet-stream';
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type });
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/* ---------- Export ---------- */

export async function createBackup(db: ForgeDB, includePhotos: boolean, now = new Date()): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  for (const name of BACKUP_TABLES) {
    if (name === 'photos') {
      if (!includePhotos) continue;
      const photos = await db.photos.toArray();
      tables.photos = await Promise.all(photos.map(async (p) => ({ ...p, blob: await blobToDataUrl(p.blob) })));
      continue;
    }
    tables[name] = (await db.table(name).toArray()) as Record<string, unknown>[];
  }
  return { app: BACKUP_APP_ID, format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), includesPhotos: includePhotos, tables };
}

/* ---------- Validation ---------- */

type Check = (r: Record<string, unknown>) => string | null;

const str = (k: string): Check => (r) => (typeof r[k] === 'string' && (r[k] as string).length > 0 ? null : `missing text field "${k}"`);
const date = (k: string): Check => (r) => (isLocalDate(r[k]) ? null : `invalid date "${String(r[k])}" in "${k}"`);
const num = (k: string, opts: { nullable?: boolean; min?: number; max?: number } = {}): Check => (r) => {
  const v = r[k];
  if (v == null) return opts.nullable ? null : `missing number "${k}"`;
  if (typeof v !== 'number' || !Number.isFinite(v)) return `"${k}" is not a number`;
  if (opts.min != null && v < opts.min) return `"${k}" below ${opts.min}`;
  if (opts.max != null && v > opts.max) return `"${k}" above ${opts.max}`;
  return null;
};
const arr = (k: string): Check => (r) => (Array.isArray(r[k]) ? null : `"${k}" must be a list`);

const sessionCheck: Check = (r) => {
  const ex = r.exercises as WorkoutSession['exercises'];
  if (!Array.isArray(ex)) return '"exercises" must be a list';
  for (const e of ex) {
    if (!e || typeof e.exerciseId !== 'string' || !Array.isArray(e.sets)) return 'malformed exercise';
    for (const s of e.sets) {
      if (!s || typeof s.id !== 'string' || (s.kind !== 'warmup' && s.kind !== 'working')) return 'malformed set';
      for (const k of ['weightKg', 'reps', 'seconds', 'rir'] as const) {
        const v = s[k];
        if (v != null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) return `set field "${k}" invalid`;
      }
    }
  }
  if (!['active', 'paused', 'completed'].includes(String(r.status))) return 'invalid session status';
  return null;
};

const RULES: Record<BackupTable, { key: string; checks: Check[] }> = {
  profile: { key: 'id', checks: [str('id'), num('heightCm', { min: 0, max: 260 }), num('age', { min: 0, max: 120 }), num('startWeightKg', { min: 0, max: 400 })] },
  templates: { key: 'id', checks: [str('id'), str('name'), arr('exercises')] },
  schedule: { key: 'id', checks: [str('id'), (r) => (Array.isArray(r.days) && r.days.length === 7 ? null : 'schedule needs 7 days')] },
  overrides: { key: 'date', checks: [date('date'), (r) => (r.activity && typeof r.activity === 'object' ? null : 'missing activity')] },
  sessions: { key: 'id', checks: [str('id'), date('date'), num('startedAt'), sessionCheck] },
  cardio: { key: 'id', checks: [str('id'), date('date'), str('type'), num('durationMin', { min: 0, max: 1440 }), num('distanceKm', { nullable: true, min: 0 }), num('avgHr', { nullable: true, min: 20, max: 250 })] },
  foods: { key: 'id', checks: [str('id'), date('date'), str('name'), num('servings', { min: 0 }), num('calories', { nullable: true, min: 0 }), num('proteinG', { min: 0 }), num('carbsG', { min: 0 }), num('fatG', { min: 0 })] },
  favorites: { key: 'id', checks: [str('id'), str('name'), num('proteinG', { min: 0 }), num('carbsG', { min: 0 }), num('fatG', { min: 0 })] },
  water: { key: 'id', checks: [str('id'), date('date'), num('ml', { min: 0, max: 20000 })] },
  bodyweights: { key: 'id', checks: [str('id'), date('date'), num('weightKg', { min: 20, max: 400 })] },
  measurements: { key: 'id', checks: [str('id'), date('date')] },
  photos: { key: 'id', checks: [str('id'), date('date'), (r) => (typeof r.blob === 'string' && r.blob.startsWith('data:image/') ? null : 'photo must be an image data URL')] },
  recovery: { key: 'id', checks: [str('id'), date('date'), num('sleepHours', { nullable: true, min: 0, max: 24 })] },
  targets: { key: 'id', checks: [str('id'), str('kind'), num('value')] },
};

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  backup: BackupFile | null;
  counts: Partial<Record<BackupTable, number>>;
}

/** Upgrade older backup structures to the current one. */
export function migrateBackup(raw: BackupFile): BackupFile {
  const b: BackupFile = { ...raw, tables: { ...raw.tables } };
  if ((b.schemaVersion ?? 1) < 2) {
    b.tables.targets = b.tables.targets ?? [];
    b.tables.sessions = (b.tables.sessions ?? []).map((s) => ({
      ...s,
      restTimer: (s as Partial<WorkoutSession>).restTimer ?? null,
      exercises: ((s as Partial<WorkoutSession>).exercises ?? []).map((e) => ({ ...e, notes: e.notes ?? '', techniqueControlled: e.techniqueControlled ?? false })),
    }));
    b.schemaVersion = 2;
  }
  if (b.schemaVersion < 3) {
    b.tables.profile = (b.tables.profile ?? []).map((p) => ({ healthConcerns: true, healthNotes: '', ...p }));
    b.schemaVersion = 3;
  }
  return b;
}

export function validateBackup(input: unknown): ValidationResult {
  const errors: string[] = [];
  const fail = (msg: string): ValidationResult => ({ ok: false, errors: [msg], backup: null, counts: {} });
  if (!input || typeof input !== 'object') return fail('File is not a JSON object.');
  const obj = input as Partial<BackupFile>;
  if (obj.app !== BACKUP_APP_ID) return fail('This file is not a FORGE backup.');
  if (typeof obj.format !== 'number' || obj.format > BACKUP_FORMAT) return fail('Backup format is newer than this version of FORGE. Update the app first.');
  if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion > SCHEMA_VERSION) return fail('Backup was created by a newer version of FORGE.');
  if (!obj.tables || typeof obj.tables !== 'object') return fail('Backup has no data tables.');

  const backup = migrateBackup(obj as BackupFile);
  const counts: ValidationResult['counts'] = {};
  for (const name of BACKUP_TABLES) {
    const rows = backup.tables[name];
    if (rows == null) continue;
    if (!Array.isArray(rows)) {
      errors.push(`${name}: expected a list`);
      continue;
    }
    const seen = new Set<string>();
    rows.forEach((row, i) => {
      if (!row || typeof row !== 'object') {
        errors.push(`${name}[${i}]: not an object`);
        return;
      }
      for (const check of RULES[name].checks) {
        const err = check(row);
        if (err) {
          errors.push(`${name}[${i}]: ${err}`);
          break;
        }
      }
      const key = String(row[RULES[name].key]);
      if (seen.has(key)) errors.push(`${name}[${i}]: duplicate ${RULES[name].key} "${key}"`);
      seen.add(key);
    });
    counts[name] = rows.length;
  }
  return { ok: errors.length === 0, errors: errors.slice(0, 50), backup: errors.length ? null : backup, counts };
}

/* ---------- Import ---------- */

export type ImportMode = 'merge' | 'replace';

export interface ImportReport {
  added: Partial<Record<BackupTable, number>>;
  skipped: Partial<Record<BackupTable, number>>;
}

/** Tables where only one record per date is allowed. */
const UNIQUE_DATE_TABLES: BackupTable[] = ['bodyweights', 'recovery', 'overrides'];

/**
 * merge   — adds records whose id (and, for one-per-day tables, date) is not already
 *           present. Existing records are never overwritten. Profile/schedule are kept.
 * replace — clears every data table and loads the backup (caller must confirm first).
 */
export async function importBackup(db: ForgeDB, backup: BackupFile, mode: ImportMode): Promise<ImportReport> {
  const report: ImportReport = { added: {}, skipped: {} };
  const tables = BACKUP_TABLES.map((n) => db.table(n));
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      for (const t of tables) await t.clear();
    }
    for (const name of BACKUP_TABLES) {
      let rows = backup.tables[name];
      if (!rows?.length) continue;
      if (name === 'photos') rows = rows.map((p) => ({ ...p, blob: dataUrlToBlob(String(p.blob)) }));
      const table = db.table(name);
      const keyPath = RULES[name].key;
      let toAdd = rows;
      if (mode === 'merge') {
        const existing = await table.toArray();
        const keys = new Set(existing.map((r) => String((r as Record<string, unknown>)[keyPath])));
        const dates = new Set(existing.map((r) => String((r as Record<string, unknown>).date)));
        toAdd = rows.filter((r) => {
          if (keys.has(String(r[keyPath]))) return false;
          if (UNIQUE_DATE_TABLES.includes(name) && dates.has(String(r.date))) return false;
          return true;
        });
      }
      if (toAdd.length) await table.bulkAdd(toAdd);
      report.added[name] = toAdd.length;
      report.skipped[name] = rows.length - toAdd.length;
    }
  });
  return report;
}

export async function deleteAllData(db: ForgeDB): Promise<void> {
  await db.transaction('rw', [...BACKUP_TABLES.map((n) => db.table(n)), db.meta], async () => {
    for (const n of BACKUP_TABLES) await db.table(n).clear();
    await db.meta.clear();
  });
}

export function downloadFile(filename: string, content: string | Blob, type = 'application/json'): void {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
