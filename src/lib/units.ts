import type { WeightUnit } from '../db/types';

/** Exact international avoirdupois pound definition. */
export const KG_PER_LB = 0.45359237;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

/** Round to a sensible display precision (0.1 for body weight / loads). */
export function round(value: number, step = 0.1): number {
  const r = Math.round(value / step) * step;
  // Remove floating point noise like 72.30000000000001
  return Number(r.toFixed(6));
}

export function formatWeight(kg: number | null | undefined, unit: WeightUnit, digits = 1): string {
  if (kg == null || !Number.isFinite(kg)) return '—';
  const v = kgToUnit(kg, unit);
  return `${Number(v.toFixed(digits)).toLocaleString()} ${unit}`;
}

/** Display a load without unit, rounded to 0.1 (or whole if integer). */
export function displayLoad(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg == null || !Number.isFinite(kg)) return '';
  return String(round(kgToUnit(kg, unit), 0.1));
}

/** Parse user text input into a finite non-negative number, or null. Accepts comma decimals. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatVolume(kg: number, unit: WeightUnit): string {
  const v = kgToUnit(kg, unit);
  return `${Math.round(v).toLocaleString()} ${unit}`;
}
