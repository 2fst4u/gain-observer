import { MAIN_WIRE_TAG, VERTICAL_WHIP_RADIAL_TAG, FOLDED_DIPOLE_OPPOSITE_TAG, FOLDED_DIPOLE_TERM_BRIDGE_TAG } from '../src/physics/tags';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAntennaGeometry, type AntennaWireProps } from '../src/components/Scene/useAntennaGeometry';
import { MIN_REAL_GROUND_HEIGHT_M, useAntennaStore } from '../src/store/antennaStore';

describe('useAntennaGeometry', () => {
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
    const { result } = renderHook(() => useAntennaGeometry({
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
      vAngle: 180,
      legSlope: 0,
      frequency: 14.1,
      foldedDipoleAperture: 0.3,
      designFrequency: 14.1,
      groundId: 'free',
      terminatingResistor: 0,
      transformerEnabled: false,
    }));

    expect(result.current.rendered.length).toBeGreaterThan(0);
    expect(result.current.rendered[0].tag).toBe(MAIN_WIRE_TAG);
    expect(result.current.shield).toBeUndefined();
    expect(result.current.feedpoint).toBeDefined();
    expect(result.current.terminatedDeltaSplit).toBeNull();
  });

  it('generates geometry for a terminated delta', () => {
    const { result } = renderHook(() => useAntennaGeometry({
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
      vAngle: 180,
      legSlope: 0,
      frequency: 14.1,
      foldedDipoleAperture: 0.3,
      designFrequency: 14.1,
      groundId: 'free',
      terminatingResistor: 0,
      transformerEnabled: false,
    }));

    expect(result.current.rendered.length).toBeGreaterThan(0);
    expect(result.current.terminatedDeltaSplit).not.toBeNull();
    expect(result.current.terminatedDeltaSplit?.bridgeLen).toBeGreaterThan(0);
  });

  it('handles feedline shield and bridge', () => {
    const { result } = renderHook(() => useAntennaGeometry({
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
      vAngle: 180,
      legSlope: 0,
      frequency: 14.1,
      foldedDipoleAperture: 0.3,
      designFrequency: 14.1,
      groundId: 'free',
      terminatingResistor: 0,
      transformerEnabled: false,
    }));

    expect(result.current.shield).toBeDefined();
    expect(result.current.shield?.isShield).toBe(true);
    expect(result.current.feedpoint).toBeDefined();
  });

  it('generates geometry for a vertical whip', () => {
    const { result } = renderHook(() => useAntennaGeometry({
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
      vAngle: 180,
      legSlope: 0,
      frequency: 14.1,
      foldedDipoleAperture: 0.3,
      designFrequency: 14.1,
      groundId: 'free',
      terminatingResistor: 0,
      transformerEnabled: false,
    }));

    expect(result.current.rendered.length).toBeGreaterThan(0);
    expect(result.current.feedpoint).toBeDefined();
    expect(result.current.terminatedDeltaSplit).toBeNull();
  });

  it('generates geometry for a delta loop', () => {
    const { result } = renderHook(() => useAntennaGeometry({
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
      vAngle: 180,
      legSlope: 0,
      frequency: 14.1,
      foldedDipoleAperture: 0.3,
      designFrequency: 14.1,
      groundId: 'free',
      terminatingResistor: 0,
      transformerEnabled: false,
    }));

    expect(result.current.rendered.length).toBeGreaterThan(0);
    expect(result.current.feedpoint).toBeDefined();
  });
  const wireProps: AntennaWireProps = {
    type: 'vertical-whip', length: 5, height: 0, orientation: 'EW', wireRadius: 0.001,
    segments: 11, feedlineId: 'none', feedlineLength: 0, feedlineOffset: 0,
    whipCounterpoise: true, vAngle: 120, legSlope: 0, frequency: 7.1,
    designFrequency: 7.1, groundId: 'free', terminatingResistor: 0,
    transformerEnabled: false, foldedDipoleAperture: 0.1,
  };

  it('keeps counterpoise dimensions fixed while operating frequency changes', () => {
    const { result, rerender } = renderHook((props) => useAntennaGeometry(props), { initialProps: wireProps });
    const initial = result.current.rendered.filter((wire) => wire.tag === VERTICAL_WHIP_RADIAL_TAG).map((wire) => wire.sceneEnd);
    expect(initial.length).toBeGreaterThan(0);
    rerender({ ...wireProps, frequency: 28.4 });
    expect(result.current.rendered.filter((wire) => wire.tag === VERTICAL_WHIP_RADIAL_TAG).map((wire) => wire.sceneEnd)).toEqual(initial);
  });

  it('renders the same real-ground height floor as the solver', () => {
    const { result } = renderHook(() => useAntennaGeometry({ ...wireProps, groundId: 'pastoral' }));
    for (const wire of result.current.rendered) {
      expect(wire.sceneStart[1]).toBeGreaterThanOrEqual(MIN_REAL_GROUND_HEIGHT_M);
      expect(wire.sceneEnd[1]).toBeGreaterThanOrEqual(MIN_REAL_GROUND_HEIGHT_M);
    }
  });

  it('renders the complete folded loop or the physical resistor bridge according to termination', () => {
    const props = { ...wireProps, type: 'folded-dipole' as const, length: 20, height: 10 };
    const { result, rerender } = renderHook((value) => useAntennaGeometry(value), { initialProps: props });
    expect(result.current.rendered.filter((wire) => wire.tag === FOLDED_DIPOLE_OPPOSITE_TAG)).toHaveLength(3);
    expect(result.current.rendered.some((wire) => wire.tag === FOLDED_DIPOLE_TERM_BRIDGE_TAG)).toBe(false);
    rerender({ ...props, terminatingResistor: 600 });
    expect(result.current.rendered.filter((wire) => wire.tag === FOLDED_DIPOLE_OPPOSITE_TAG)).toHaveLength(2);
    expect(result.current.rendered.some((wire) => wire.tag === FOLDED_DIPOLE_TERM_BRIDGE_TAG)).toBe(true);
  });

});
