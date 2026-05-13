type Theme = 'dark' | 'light';

export interface ThemeColors {
  background: string;
  wire: string;
  feedpoint: string;
  ground: {
    sea: string;
    fresh: string;
    pastoral: string;
    'dry-rocky': string;
    city: string;
    perfect: string;
  };
}

export const THEME_COLORS: Record<Theme, ThemeColors> = {
  dark: {
    background: '#0a0d12',
    wire: '#e09a3f',
    feedpoint: '#ff5a5a',
    ground: {
      sea: '#1d5980',
      fresh: '#2f7ca0',
      pastoral: '#3a2d20',
      'dry-rocky': '#6a5a44',
      city: '#3f3f44',
      perfect: '#888888',
    },
  },
  light: {
    background: '#e8ecf1',
    wire: '#b87333',
    feedpoint: '#d93030',
    ground: {
      sea: '#5ca6d6',
      fresh: '#7eb7d4',
      pastoral: '#ad9468',
      'dry-rocky': '#c2af92',
      city: '#949ba8',
      perfect: '#aaaaaa',
    },
  },
};
