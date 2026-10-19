import type { Profile } from '../db/types';

/** The program is pending clearance when the user reported health concerns and has not recorded clearance. */
export function needsClearance(p: Pick<Profile, 'healthConcerns' | 'medicalClearance'>): boolean {
  return p.healthConcerns && !p.medicalClearance.cleared;
}

/** Suggested protein range of 1.6–2.0 g per kg body weight, rounded to the nearest 5 g. */
export function suggestedProtein(weightKg: number): { min: number; max: number } {
  const r5 = (g: number) => Math.round(g / 5) * 5;
  return { min: r5(weightKg * 1.6), max: r5(weightKg * 2.0) };
}
