import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AntennaControl } from '../src/components/Panel/AntennaControl';
import { useAntennaStore } from '../src/store/antennaStore';

// Mock the store
vi.mock('../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../src/store/antennaStore');
  return {
    ...actual,
    useAntennaStore: vi.fn(),
  };
});

interface MockState {
  type: string;
  units: string;
  length: number;
  height: number;
  orientation: string | number;
  vAngle: number;
  legSlope: number;
  terminatedEnabled: boolean;
  terminatingResistor: number;
  setType: (t: string) => void;
  setLength: () => void;
  setHalfWaveLength: () => void;
  setHeight: () => void;
  setOrientation: (o: string | number) => void;
  setVAngle: (v: number) => void;
  setLegSlope: (s: number) => void;
  setTerminatedEnabled: (b: boolean) => void;
  setTerminatingResistor: (r: number) => void;
}

describe('AntennaControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('updates orientation when numeric input changes', () => {
    const setOrientation = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      const state: MockState = {
        type: 'dipole',
        units: 'metric',
        length: 20,
        height: 10,
        orientation: 'EW',
        vAngle: 120,
        legSlope: 45,
        terminatedEnabled: false,
        terminatingResistor: 450,
        setType: vi.fn(),
        setLength: vi.fn(),
        setHalfWaveLength: vi.fn(),
        setHeight: vi.fn(),
        setOrientation,
        setVAngle: vi.fn(),
        setLegSlope: vi.fn(),
        setTerminatedEnabled: vi.fn(),
        setTerminatingResistor: vi.fn(),
      };
      return selector(state);
    });

    render(<AntennaControl />);

    const orientInput = document.getElementById('dipole-orientation') as HTMLInputElement;
    fireEvent.change(orientInput, { target: { value: '45' } });

    expect(setOrientation).toHaveBeenCalledWith(45);
  });

  it('updates orientation when preset buttons are clicked', () => {
    const setOrientation = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      const state: MockState = {
        type: 'dipole',
        units: 'metric',
        length: 20,
        height: 10,
        orientation: 'EW',
        vAngle: 120,
        legSlope: 45,
        terminatedEnabled: false,
        terminatingResistor: 450,
        setType: vi.fn(),
        setLength: vi.fn(),
        setHalfWaveLength: vi.fn(),
        setHeight: vi.fn(),
        setOrientation,
        setVAngle: vi.fn(),
        setLegSlope: vi.fn(),
        setTerminatedEnabled: vi.fn(),
        setTerminatingResistor: vi.fn(),
      };
      return selector(state);
    });

    render(<AntennaControl />);

    const nsButton = screen.getByRole('button', { name: 'NS' });
    fireEvent.click(nsButton);

    expect(setOrientation).toHaveBeenCalledWith('NS');
  });
});
