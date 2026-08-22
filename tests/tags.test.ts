import { describe, expect, it } from 'vitest';
import * as tags from '../src/physics/tags';

describe('geometry tags', () => {
  it('all tags should be positive integers', () => {
    Object.values(tags).forEach((tag) => {
      expect(typeof tag).toBe('number');
      expect(Number.isInteger(tag)).toBe(true);
      expect(tag as number).toBeGreaterThan(0);
    });
  });

  it('all tags should be unique', () => {
    const values = Object.values(tags);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });
});
