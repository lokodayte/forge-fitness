import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { ForgeDB } from '../db/db';
import { createBackup, importBackup, migrateBackup, validateBackup, type BackupFile } from '../lib/backup';
import { csvEscape, toCsv, workoutSetsCsv } from '../lib/csv';
import { defaultProfile, defaultSchedule, defaultTemplates } from '../data/program';
import { exercise, session, set } from './fixtures';

let db: ForgeDB;
let name: string;

beforeEach(async () => {
  name = `forge-test-${Math.random().toString(36).slice(2)}`;
  db = new ForgeDB(name);
  await db.open();
  await db.profile.put({ ...defaultProfile('2026-10-18'), age: 25, heightCm: 175, startWeightKg: 80 });
  await db.templates.bulkPut(defaultTemplates());
  await db.schedule.put(defaultSchedule());
  await db.sessions.put(session('2026-10-19', [exercise('leg-press', [set({ weightKg: 100, reps: 12 })])], { id: 'S1' }));
  await db.bodyweights.put({ id: 'W1', date: '2026-10-18', weightKg: 87, note: '', createdAt: 1 });
  await db.foods.put({ id: 'F1', date: '2026-10-18', meal: 'lunch', name: 'Rice, "jasmine"', servings: 1, calories: null, proteinG: 5, carbsG: 45, fatG: 1, createdAt: 1 });
});

afterEach(async () => {
  db.close();
  await Dexie.delete(name);
});

describe('backup & restore', () => {
  it('round-trips all data through JSON', async () => {
    const backup = JSON.parse(JSON.stringify(await createBackup(db, false)));
    const v = validateBackup(backup);
    expect(v.ok).toBe(true);
    expect(v.counts.sessions).toBe(1);

    const other = new ForgeDB(`${name}-b`);
    await other.open();
    const report = await importBackup(other, v.backup!, 'replace');
    expect(report.added.sessions).toBe(1);
    expect((await other.sessions.get('S1'))?.exercises[0].sets[0].weightKg).toBe(100);
    expect((await other.profile.get('me'))?.heightCm).toBe(175);
    other.close();
    await Dexie.delete(`${name}-b`);
  });

  it('merge never overwrites and skips duplicates (by id and by date)', async () => {
    const backup = validateBackup(JSON.parse(JSON.stringify(await createBackup(db, false)))).backup!;
    backup.tables.bodyweights = [
      { id: 'W1', date: '2026-10-18', weightKg: 99, note: '', createdAt: 1 },
      { id: 'W2', date: '2026-10-18', weightKg: 98, note: '', createdAt: 1 },
      { id: 'W3', date: '2026-10-19', weightKg: 86.8, note: '', createdAt: 1 },
    ];
    const report = await importBackup(db, backup, 'merge');
    expect(report.added.bodyweights).toBe(1);
    expect(report.skipped.bodyweights).toBe(2);
    expect(report.added.sessions).toBe(0);
    expect((await db.bodyweights.get('W1'))?.weightKg).toBe(87);
    expect(await db.bodyweights.count()).toBe(2);
  });

  it('rejects invalid or foreign files', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ app: 'OTHER' }).errors[0]).toMatch(/not a FORGE backup/);
    expect(validateBackup({ app: 'FORGE', format: 99, schemaVersion: 1, tables: {} }).ok).toBe(false);
    const bad = validateBackup({ app: 'FORGE', format: 1, schemaVersion: 2, exportedAt: '', includesPhotos: false, tables: { bodyweights: [{ id: 'a', date: '2026-02-30', weightKg: 80 }], cardio: [{ id: 'c', date: '2026-10-01', type: 'walking', durationMin: -5 }] } });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(' ')).toMatch(/invalid date/);
    expect(bad.errors.join(' ')).toMatch(/durationMin/);
    const dup = validateBackup({ app: 'FORGE', format: 1, schemaVersion: 2, exportedAt: '', includesPhotos: false, tables: { water: [{ id: 'x', date: '2026-10-01', ml: 250 }, { id: 'x', date: '2026-10-01', ml: 250 }] } });
    expect(dup.errors.join(' ')).toMatch(/duplicate/);
  });

  it('a failed import changes nothing (transactional)', async () => {
    const backup = validateBackup(JSON.parse(JSON.stringify(await createBackup(db, false)))).backup!;
    // Force a constraint violation: two weigh-ins on the same date inside one import.
    backup.tables.bodyweights = [
      { id: 'N1', date: '2026-11-01', weightKg: 80, note: '', createdAt: 1 },
      { id: 'N2', date: '2026-11-01', weightKg: 81, note: '', createdAt: 1 },
    ];
    await expect(importBackup(db, backup, 'replace')).rejects.toBeTruthy();
    expect(await db.sessions.count()).toBe(1);
    expect((await db.bodyweights.get('W1'))?.weightKg).toBe(87);
  });

  it('migrates older backups', () => {
    const old = { app: 'FORGE', format: 1, schemaVersion: 1, exportedAt: '', includesPhotos: false, tables: { sessions: [{ ...session('2026-10-01', [exercise('leg-press', [set()])]), restTimer: undefined }] } } as unknown as BackupFile;
    delete (old.tables.sessions![0] as { exercises: { techniqueControlled?: boolean }[] }).exercises[0].techniqueControlled;
    const m = migrateBackup(old);
    expect(m.schemaVersion).toBe(3);
    expect(m.tables.targets).toEqual([]);
    expect((m.tables.sessions![0] as unknown as { exercises: { techniqueControlled: boolean }[] }).exercises[0].techniqueControlled).toBe(false);
  });
});

describe('Dexie schema migration', () => {
  it('upgrades a v1 database to the current version and backfills fields', async () => {
    const dbName = `${name}-mig`;
    const v1 = new Dexie(dbName);
    v1.version(1).stores({ profile: 'id', templates: 'id', schedule: 'id', overrides: 'date', sessions: 'id, date, status, templateId', cardio: 'id, date, type', foods: 'id, date', favorites: 'id, name', water: 'id, date', bodyweights: 'id, &date', measurements: 'id, date', photos: 'id, date', recovery: 'id, &date', meta: 'key' });
    const legacy = session('2026-09-01', [exercise('leg-press', [set()])], { id: 'OLD' }) as unknown as Record<string, unknown>;
    delete legacy.restTimer;
    delete (legacy.exercises as Record<string, unknown>[])[0].techniqueControlled;
    await v1.table('sessions').put(legacy);
    await v1.table('profile').put({ id: 'me', age: 30, heightCm: 170, startWeightKg: 70 });
    v1.close();

    const upgraded = new ForgeDB(dbName);
    await upgraded.open();
    expect(upgraded.verno).toBe(3);
    expect(await upgraded.profile.get('me')).toMatchObject({ healthConcerns: true, healthNotes: '' });
    const s = await upgraded.sessions.get('OLD');
    expect(s?.restTimer).toBeNull();
    expect(s?.exercises[0].techniqueControlled).toBe(false);
    expect(await upgraded.targets.count()).toBe(0);
    upgraded.close();
    await Dexie.delete(dbName);
  });
});

describe('CSV export', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"');
    expect(csvEscape(null)).toBe('');
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n');
  });
  it('flattens workout sets with volume', () => {
    const csv = workoutSetsCsv([session('2026-10-19', [exercise('leg-press', [set({ weightKg: 100, reps: 12 }), set({ kind: 'warmup', weightKg: 50, reps: 10 })])])]);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(',1200,');
    expect(lines[2]).toContain('warmup');
    expect(lines[2]).toContain(',0,');
  });
});
