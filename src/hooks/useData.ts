import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { WorkoutTemplate } from '../db/types';

export const useProfile = () => useLiveQuery(() => db.profile.get('me'), []);
export const useTemplates = () => useLiveQuery(() => db.templates.toArray(), [], [] as WorkoutTemplate[]);
export const useSchedule = () => useLiveQuery(() => db.schedule.get('week'), []);
export const useOverrides = () => useLiveQuery(() => db.overrides.toArray(), [], []);
export const useSessions = () => useLiveQuery(() => db.sessions.orderBy('date').toArray(), [], undefined);
export const useActiveSession = () => useLiveQuery(async () => (await db.sessions.where('status').anyOf('active', 'paused').toArray()).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null, [], undefined);
export const useCardio = () => useLiveQuery(() => db.cardio.orderBy('date').toArray(), [], undefined);
export const useFoods = () => useLiveQuery(() => db.foods.orderBy('date').toArray(), [], undefined);
export const useFavorites = () => useLiveQuery(() => db.favorites.orderBy('name').toArray(), [], []);
export const useWater = () => useLiveQuery(() => db.water.toArray(), [], []);
export const useBodyWeights = () => useLiveQuery(() => db.bodyweights.orderBy('date').toArray(), [], undefined);
export const useMeasurements = () => useLiveQuery(() => db.measurements.orderBy('date').toArray(), [], undefined);
export const useRecovery = () => useLiveQuery(() => db.recovery.orderBy('date').toArray(), [], undefined);
export const useTargets = () => useLiveQuery(() => db.targets.toArray(), [], []);

export function templateNameLookup(templates: WorkoutTemplate[]) {
  return (id: string) => templates.find((t) => t.id === id)?.name ?? `Workout ${id}`;
}
