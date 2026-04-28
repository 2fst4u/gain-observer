// Selects a pattern mesh level-of-detail based on device capability.
//
//   high:   desktop with 8+ cores
//   medium: desktop / tablet
//   low:    mobile / low-power
//
// Returns {thetaSegments, phiSegments} which the RadiationPattern mesh
// will use to build its sphere geometry.

import { useMemo } from 'react';

export type LODLevel = 'high' | 'medium' | 'low';

export interface LODConfig {
  readonly level: LODLevel;
  readonly thetaSegments: number;
  readonly phiSegments: number;
}

const TABLE: Record<LODLevel, LODConfig> = {
  high:   { level: 'high',   thetaSegments: 72,  phiSegments: 144 },
  medium: { level: 'medium', thetaSegments: 48,  phiSegments: 96  },
  low:    { level: 'low',    thetaSegments: 32,  phiSegments: 64  },
};

function detectLevel(): LODLevel {
  if (typeof navigator === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency ?? 4;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) return cores >= 6 ? 'medium' : 'low';
  return cores >= 8 ? 'high' : 'medium';
}

export function useAdaptiveLOD(): LODConfig {
  return useMemo(() => TABLE[detectLevel()], []);
}
