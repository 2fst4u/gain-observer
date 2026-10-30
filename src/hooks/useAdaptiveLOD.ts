// Selects a pattern mesh level-of-detail based on device capability.
//
//   high:      desktop with 8+ cores
//   medium:    desktop / tablet (default)
//   low:       mobile / low-power
//   ultra-low: very constrained mobile (≤4 cores or ≤2 GB RAM)
//
// Each tier carries:
//   - mesh resolution (thetaSegments × phiSegments for the 3-D sphere)
//   - sweep tuning (points, charPoints, maxAdaptiveIter, skipBroadScan)

import { useMemo } from 'react';

export type LODLevel = 'high' | 'medium' | 'low' | 'ultra-low';

export interface LODConfig {
  readonly level: LODLevel;
  // 3-D mesh sphere segments
  readonly thetaSegments: number;
  readonly phiSegments: number;
  // SWR sweep tuning
  readonly sweepPoints: number;
  readonly charPoints: number;
  readonly maxAdaptiveIter: number;
  readonly skipBroadScan: boolean;
}

export const LOD_TABLE: Record<LODLevel, LODConfig> = {
  high: {
    level: 'high',
    thetaSegments: 72,
    phiSegments: 144,
    sweepPoints: 15,
    charPoints: 11,
    maxAdaptiveIter: 5,
    skipBroadScan: false,
  },
  medium: {
    level: 'medium',
    thetaSegments: 48,
    phiSegments: 96,
    sweepPoints: 15,
    charPoints: 11,
    maxAdaptiveIter: 5,
    skipBroadScan: false,
  },
  low: {
    level: 'low',
    thetaSegments: 32,
    phiSegments: 64,
    sweepPoints: 11,
    charPoints: 7,
    maxAdaptiveIter: 3,
    skipBroadScan: false,
  },
  'ultra-low': {
    level: 'ultra-low',
    thetaSegments: 16,
    phiSegments: 32,
    sweepPoints: 9,
    charPoints: 5,
    maxAdaptiveIter: 2,
    // Skip the secondary full-HF-range broad scan on very constrained hardware.
    skipBroadScan: true,
  },
};

export function detectLODLevel(): LODLevel {
  if (typeof navigator === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency ?? 4;
  // deviceMemory is a Chrome-specific hint (powers of 2: 0.25–8 GB).
  // Not available on iOS Safari or Firefox — treat as unknown when absent.
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    // ≤1 GB RAM (Chrome/Android) is a strong signal for a very constrained device.
    if (memory !== undefined && memory <= 1) return 'ultra-low';
    return cores >= 6 ? 'medium' : 'low';
  }
  // Desktop: downgrade when RAM is very limited even if cores are plentiful.
  if (memory !== undefined && memory <= 2) return 'low';
  return cores >= 8 ? 'high' : 'medium';
}

export function useAdaptiveLOD(): LODConfig {
  return useMemo(() => LOD_TABLE[detectLODLevel()], []);
}
