import { describe, expect, it } from 'vitest';
import { needsClearance, suggestedProtein } from '../lib/health';

const p = (healthConcerns: boolean, cleared: boolean) => ({ healthConcerns, medicalClearance: { cleared, date: null, note: '' } });

describe('health gating', () => {
  it('is pending only when concerns were reported and clearance is not recorded', () => {
    expect(needsClearance(p(true, false))).toBe(true);
    expect(needsClearance(p(true, true))).toBe(false);
    expect(needsClearance(p(false, false))).toBe(false);
  });
  it('suggests 1.6–2.0 g/kg protein rounded to 5 g', () => {
    expect(suggestedProtein(80)).toEqual({ min: 130, max: 160 });
    expect(suggestedProtein(70)).toEqual({ min: 110, max: 140 });
  });
});
