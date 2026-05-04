import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DipoleControl } from '../src/components/Panel/DipoleControl';
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
  units: string;
  length: number;
  height: number;
  orientation: string | number;
  setLength: () => void;
  setHalfWaveLength: () => void;
  setHeight: () => void;
  setOrientation: (o: string | number) => void;
}

describe('DipoleControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('updates orientation when numeric input changes', () => {
    const setOrientation = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      const state: MockState = {
        units: 'metric',
        length: 20,
        height: 10,
        orientation: 'EW',
        setLength: vi.fn(),
        setHalfWaveLength: vi.fn(),
        setHeight: vi.fn(),
        setOrientation,
      };
      return selector(state);
    });

    render(<DipoleControl />);

    const orientInput = document.getElementById('dipole-orientation') as HTMLInputElement;
    fireEvent.change(orientInput, { target: { value: '45' } });

    expect(setOrientation).toHaveBeenCalledWith(45);
  });

  it('updates orientation when preset buttons are clicked', () => {
    const setOrientation = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      const state: MockState = {
        units: 'metric',
        length: 20,
        height: 10,
        orientation: 'EW',
        setLength: vi.fn(),
        setHalfWaveLength: vi.fn(),
        setHeight: vi.fn(),
        setOrientation,
      };
      return selector(state);
    });

    render(<DipoleControl />);

    const nsButton = screen.getByRole('button', { name: 'NS' });
    fireEvent.click(nsButton);

    expect(setOrientation).toHaveBeenCalledWith('NS');
  });
});
