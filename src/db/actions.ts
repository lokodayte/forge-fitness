import { db } from './db';
import type { Profile, ScheduledActivity, WeeklySchedule, WorkoutSession, WorkoutTemplate, LocalDate } from './types';
import { defaultProfile, defaultSchedule, defaultTemplates } from '../data/program';
import { today } from '../lib/dates';
import { weekdayIndex } from '../lib/dates';

/** Ensures a profile, templates and schedule exist. Never creates logs or sessions. */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.profile, db.templates, db.schedule, async () => {
    if (!(await db.profile.get('me'))) await db.profile.put(defaultProfile(today()));
    if ((await db.templates.count()) === 0) await db.templates.bulkPut(defaultTemplates());
    if (!(await db.schedule.get('week'))) await db.schedule.put(defaultSchedule());
  });
}

export async function updateProfile(patch: Partial<Profile>): Promise<void> {
  await db.profile.update('me', { ...patch, updatedAt: Date.now() });
}

export async function saveSession(s: WorkoutSession): Promise<void> {
  await db.sessions.put(s);
}

export async function saveTemplate(t: WorkoutTemplate): Promise<void> {
  await db.templates.put({ ...t, updatedAt: Date.now() });
}

export async function resetTemplates(): Promise<void> {
  await db.transaction('rw', db.templates, async () => {
    await db.templates.clear();
    await db.templates.bulkPut(defaultTemplates());
  });
}

export async function saveSchedule(s: WeeklySchedule): Promise<void> {
  await db.schedule.put(s);
}

/**
 * Swap the activities of two dates (creates per-date overrides). Rescheduling never
 * deletes an activity: whatever was on the target date moves to the source date.
 */
export async function swapDates(schedule: WeeklySchedule, from: LocalDate, to: LocalDate): Promise<void> {
  if (from === to) return;
  await db.transaction('rw', db.overrides, async () => {
    const [of, ot] = await Promise.all([db.overrides.get(from), db.overrides.get(to)]);
    const aFrom: ScheduledActivity = of?.activity ?? schedule.days[weekdayIndex(from)];
    const aTo: ScheduledActivity = ot?.activity ?? schedule.days[weekdayIndex(to)];
    await db.overrides.put({ date: to, activity: aFrom, note: `Moved from ${from}` });
    await db.overrides.put({ date: from, activity: aTo, note: `Moved from ${to}` });
  });
}

export async function setOverride(date: LocalDate, activity: ScheduledActivity | null): Promise<void> {
  if (activity == null) await db.overrides.delete(date);
  else await db.overrides.put({ date, activity });
}
