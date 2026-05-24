import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDipoleGeometry } from '../src/components/Scene/useDipoleGeometry';
import { useAntennaStore } from '../src/store/antennaStore';

describe('useDipoleGeometry', () => {
  beforeEach(() => {
    useAntennaStore.setState({
      vAngle: 120,
      legSlope: 0,
      frequency: 14.1,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('generates geometry for a basic dipole', () => {
    const { result } = renderHook(() => useDipoleGeometry({
      type: 'dipole',
      length: 10,
      height: 5,
      orientation: 'EW',
      wireRadius: 0.001,
      segments: 11,
      feedlineId: 'none',
      feedlineLength: 0,
      feedlineOffset: 0.5,
      whipCounterpoise: false,
    }));

    expect(result.current.rendered.length).toBeGreaterThan(0);
    expect(result.current.rendered[0].tag).toBe(1); // DIPOLE_TAG
    expect(result.current.shield).toBeUndefined();
    expect(result.current.feedpoint).toBeDefined();
    expect(result.current.terminatedDeltaSplit).toBeNull();
  });

  it('generates geometry for a terminated delta loop', () => {
    const { result } = renderHook(() => useDipoleGeometry({
      type: 'terminated-delta',
      length: 20,
      height: 10,
      orientation: 'NS',
      wireRadius: 0.001,
      segments: 21,
      feedlineId: 'none',
      feedlineLength: 0,
      feedlineOffset: 0.5,
      whipCounterpoise: false,
    }));

    expect(result.current.rendered.length).toBeGreaterThan(0);
    expect(result.current.terminatedDeltaSplit).not.toBeNull();
    expect(result.current.terminatedDeltaSplit?.bridgeLen).toBeGreaterThan(0);
  });

  it('handles feedline shield and bridge', () => {
    const { result } = renderHook(() => useDipoleGeometry({
      type: 'dipole',
      length: 10,
      height: 5,
      orientation: 'EW',
      wireRadius: 0.001,
      segments: 11,
      feedlineId: 'rg58',
      feedlineLength: 10,
      feedlineOffset: 0.5,
      whipCounterpoise: false,
    }));

    expect(result.current.shield).toBeDefined();
    expect(result.current.shield?.isShield).toBe(true);
    expect(result.current.feedpoint).toBeDefined();
  });

  it('generates geometry for a vertical whip', () => {
    const { result } = renderHook(() => useDipoleGeometry({
      type: 'vertical-whip',
      length: 5,
      height: 0,
      orientation: 'NS',
      wireRadius: 0.001,
      segments: 11,
      feedlineId: 'none',
      feedlineLength: 0,
      feedlineOffset: 0,
      whipCounterpoise: true,
    }));

    expect(result.current.rendered.length).toBeGreaterThan(0);
    expect(result.current.feedpoint).toBeDefined();
    expect(result.current.terminatedDeltaSplit).toBeNull();
  });

  it('generates geometry for a delta loop', () => {
    const { result } = renderHook(() => useDipoleGeometry({
      type: 'delta-loop',
      length: 20,
      height: 10,
      orientation: 'NS',
      wireRadius: 0.001,
      segments: 21,
      feedlineId: 'none',
      feedlineLength: 0,
      feedlineOffset: 0,
      whipCounterpoise: false,
    }));

    expect(result.current.rendered.length).toBeGreaterThan(0);
    expect(result.current.feedpoint).toBeDefined();
  });
});
