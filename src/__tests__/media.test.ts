import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { animatedMediaPath, EXERCISES, mediaPath, CORE_EXERCISE_IDS } from '../data/exercises';
import { defaultTemplates, REVISED_CORE, SIDE_PLANK } from '../data/program';

const PUBLIC = join(__dirname, '..', '..', 'public');

describe('exercise media', () => {
  it('has a bundled static and animated illustration for every exercise', () => {
    const missing = EXERCISES.flatMap((e) => [mediaPath(e.id), animatedMediaPath(e.id)]).filter((p) => !existsSync(join(PUBLIC, p)));
    expect(missing).toEqual([]);
  });

  it('illustrations are valid, labelled SVGs with no external references', () => {
    for (const e of EXERCISES) {
      const svg = readFileSync(join(PUBLIC, mediaPath(e.id)), 'utf8');
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('ILLUSTRATION');
      expect(svg).toContain('CC0');
      expect(svg).not.toMatch(/(href|src)="https?:/);
      const anim = readFileSync(join(PUBLIC, animatedMediaPath(e.id)), 'utf8');
      expect(anim).toContain('<animate');
    }
  });

  it('media index lists exactly the library', () => {
    const index = JSON.parse(readFileSync(join(PUBLIC, 'media/exercises/index.json'), 'utf8'));
    expect([...index.ids].sort()).toEqual(EXERCISES.map((e) => e.id).sort());
    expect(index.license).toBe('CC0-1.0');
  });

  it('every programmed exercise exists in the library with full guidance', () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    const programmed = [...defaultTemplates().flatMap((t) => t.exercises.map((e) => e.exerciseId)), ...Object.values(REVISED_CORE).flatMap((r) => [r.replace?.to.exerciseId, r.add?.exerciseId]).filter(Boolean), SIDE_PLANK.exerciseId, ...CORE_EXERCISE_IDS];
    for (const id of programmed) expect(ids.has(id as string)).toBe(true);
    for (const e of EXERCISES) {
      expect(e.steps.length).toBeGreaterThan(1);
      expect(e.mistakes.length).toBeGreaterThan(0);
      expect(e.alternatives.length).toBeGreaterThan(0);
      expect(e.breathing.length).toBeGreaterThan(10);
      for (const a of e.alternatives) if (a.exerciseId) expect(ids.has(a.exerciseId)).toBe(true);
    }
  });

  it('PWA icons exist', () => {
    for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'icon.svg']) expect(existsSync(join(PUBLIC, 'icons', f))).toBe(true);
  });
});
