import type { LocalDate } from '../db/types';
import { daysBetween } from '../lib/dates';

export interface Phase {
  id: 'baseline' | 'progression' | 'deload' | 'overload';
  name: string;
  weeks: [number, number];
  targetRir: string;
  summary: string;
  details: string[];
}

export const PHASES: Phase[] = [
  {
    id: 'baseline',
    name: 'Technique & baseline',
    weeks: [1, 2],
    targetRir: '≈3 RIR',
    summary: 'Learn each machine setup and establish starting loads. Stop every set with about 3 reps left in reserve.',
    details: [
      'Record seat/pad settings in the exercise notes.',
      'Choose loads you can move with smooth, repeatable technique.',
      'These sessions become your baseline for later comparisons.',
    ],
  },
  {
    id: 'progression',
    name: 'Gradual progression',
    weeks: [3, 6],
    targetRir: '≈1–2 RIR',
    summary: 'Add reps within the range first; add load only when all sets reach the top of the range with controlled technique.',
    details: [
      'Effort rises to roughly 1–2 reps in reserve.',
      'Small, steady increases beat big jumps.',
      'If technique slips, keep the load and own the reps.',
    ],
  },
  {
    id: 'deload',
    name: 'Optional recovery deload',
    weeks: [7, 7],
    targetRir: '≈3+ RIR',
    summary: 'If fatigue, soreness or poor sleep have built up, do roughly half the working sets at similar loads.',
    details: [
      'Optional — use it if recovery markers are trending down.',
      'Keep the movement practice; reduce volume (≈50% of working sets).',
      'Use the deload toggle in the workout tracker to halve set counts for a session.',
    ],
  },
  {
    id: 'overload',
    name: 'Progressive overload',
    weeks: [8, 12],
    targetRir: '≈1–2 RIR',
    summary: 'Continue progressing reps and loads and compare performance against your baseline weeks.',
    details: [
      'Track top sets and volume trends in Body Progress → Strength.',
      'Progress is not always linear; stalls are normal.',
      'At week 12, review results and start a new block.',
    ],
  },
];

export interface PhaseStatus {
  week: number; // 1-based; can exceed 12
  phase: Phase | null; // null before start or after week 12
  started: boolean;
  complete: boolean;
  daysUntilStart: number;
}

/** Program week = floor(days since start / 7) + 1. Week 1 begins on the start date. */
export function programWeek(start: LocalDate, date: LocalDate): number {
  const d = daysBetween(start, date);
  return d < 0 ? 0 : Math.floor(d / 7) + 1;
}

export function phaseForWeek(week: number): Phase | null {
  return PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) ?? null;
}

export function phaseStatus(start: LocalDate, date: LocalDate): PhaseStatus {
  const week = programWeek(start, date);
  return {
    week,
    phase: phaseForWeek(week),
    started: week >= 1,
    complete: week > 12,
    daysUntilStart: week === 0 ? -daysBetween(start, date) : 0,
  };
}
