import { describe, it, expect } from 'vitest';

describe('vite-env', () => {
  it('should have __BUILD_ID__ defined', () => {
    expect(__BUILD_ID__).toBeDefined();
    expect(typeof __BUILD_ID__).toBe('string');
  });
});
