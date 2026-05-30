import { describe, it, expect } from 'vitest';
import { hourToHHmm, HHmmToHour } from '../src/components/Panel/Propagation/PropagationInputs';

describe('PropagationInputs time parsers', () => {
  describe('hourToHHmm', () => {
    it('converts integer hours correctly', () => {
      expect(hourToHHmm(0)).toBe('00:00');
      expect(hourToHHmm(12)).toBe('12:00');
      expect(hourToHHmm(23)).toBe('23:00');
    });

    it('converts fractional hours to minutes correctly', () => {
      expect(hourToHHmm(1.5)).toBe('01:30');
      expect(hourToHHmm(14.25)).toBe('14:15');
      expect(hourToHHmm(9.75)).toBe('09:45');
      expect(hourToHHmm(10.1)).toBe('10:06');
    });

    it('rounds minutes correctly', () => {
      // 10.333... hours is 10 hours and 20 minutes
      expect(hourToHHmm(10.333333333333334)).toBe('10:20');
      // 10.123 hours is 10 hours and 7.38 minutes -> 10:07
      expect(hourToHHmm(10.123)).toBe('10:07');
    });
  });

  describe('HHmmToHour', () => {
    it('converts valid HH:mm strings to fractional hours', () => {
      expect(HHmmToHour('00:00')).toBe(0);
      expect(HHmmToHour('12:00')).toBe(12);
      expect(HHmmToHour('23:00')).toBe(23);
      expect(HHmmToHour('01:30')).toBe(1.5);
      expect(HHmmToHour('14:15')).toBe(14.25);
      expect(HHmmToHour('09:45')).toBe(9.75);
    });

    it('converts valid HHmm strings (without colon) to fractional hours', () => {
      expect(HHmmToHour('0000')).toBe(0);
      expect(HHmmToHour('1200')).toBe(12);
      expect(HHmmToHour('2300')).toBe(23);
      expect(HHmmToHour('0130')).toBe(1.5);
      expect(HHmmToHour('1415')).toBe(14.25);
      expect(HHmmToHour('0945')).toBe(9.75);
    });

    it('handles extra characters by stripping them out', () => {
      // '12:30 PM' will have non-digits stripped to '1230', which converts to 12.5
      expect(HHmmToHour('12:30 PM')).toBe(12.5);
      expect(HHmmToHour('  09:45  ')).toBe(9.75);
      expect(HHmmToHour('a01b30c')).toBe(1.5);
    });

    it('returns null for invalid lengths', () => {
      expect(HHmmToHour('1')).toBe(null);
      expect(HHmmToHour('12')).toBe(null);
      expect(HHmmToHour('123')).toBe(null);
      expect(HHmmToHour('12345')).toBe(null);
    });

    it('returns null for out-of-bounds hours or minutes', () => {
      expect(HHmmToHour('24:00')).toBe(null); // h=24 is invalid
      expect(HHmmToHour('25:00')).toBe(null);
      expect(HHmmToHour('12:60')).toBe(null); // m=60 is invalid
      expect(HHmmToHour('12:61')).toBe(null);
      expect(HHmmToHour('-1:00')).toBe(null); // -1 becomes 100 which is length 3, fails
    });
  });
});
