import { describe, expect, it } from 'vitest';
import { formatWeight, kgToUnit, parseNumber, round, unitToKg } from '../lib/units';

describe('kg / lb conversion', () => {
  it('uses the exact pound definition', () => {
    expect(unitToKg(100, 'lb')).toBeCloseTo(45.359237, 9);
    expect(kgToUnit(100, 'lb')).toBeCloseTo(220.462, 3);
  });
  it('round-trips without drift', () => {
    for (const lb of [2.5, 45, 135, 225, 317.5]) expect(round(kgToUnit(unitToKg(lb, 'lb'), 'lb'), 0.1)).toBe(lb);
    expect(unitToKg(80, 'kg')).toBe(80);
  });
  it('formats and parses safely', () => {
    expect(formatWeight(87, 'kg')).toBe('87 kg');
    expect(formatWeight(null, 'kg')).toBe('—');
    expect(parseNumber('72,5')).toBe(72.5);
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('-3')).toBeNull();
    expect(parseNumber('  ')).toBeNull();
  });
});
