import { describe, expect, it } from 'vitest';
import { THEME_COLORS } from '../src/utils/themeColors';

describe('THEME_COLORS', () => {
  it('contains definitions for both light and dark themes', () => {
    expect(THEME_COLORS).toHaveProperty('light');
    expect(THEME_COLORS).toHaveProperty('dark');
  });

  const hexColorRegex = /^#([0-9A-Fa-f]{3}){1,2}$/;

  ['light', 'dark'].forEach((theme) => {
    describe(`${theme} theme`, () => {
      const colors = THEME_COLORS[theme as keyof typeof THEME_COLORS];

      it('has valid background color', () => {
        expect(colors.background).toMatch(hexColorRegex);
      });

      it('has valid wire color', () => {
        expect(colors.wire).toMatch(hexColorRegex);
      });

      it('has valid feedpoint color', () => {
        expect(colors.feedpoint).toMatch(hexColorRegex);
      });

      it('has valid ground colors for all ground types', () => {
        const groundTypes = [
          'sea',
          'fresh',
          'pastoral',
          'dry-rocky',
          'city',
          'perfect',
        ] as const;

        groundTypes.forEach((type) => {
          expect(colors.ground).toHaveProperty(type);
          expect(colors.ground[type]).toMatch(hexColorRegex);
        });

        // Also ensure no extra properties exist on ground object
        expect(Object.keys(colors.ground)).toHaveLength(groundTypes.length);
      });
    });
  });
});
