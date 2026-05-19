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
  antennaType: string;
  length: number;
  height: number;
  frequency: number;
  orientation: string | number;
  vAngle: number;
  terminatingResistor: number;
  setAntennaType: () => void;
  setLength: () => void;
  setHalfWaveLength: () => void;
  setLegLengthMultiple: () => void;
  setHeight: () => void;
  setOrientation: (o: string | number) => void;
  setVAngle: () => void;
  setTerminatingResistor: () => void;
}

function buildMockState(overrides: Partial<MockState> = {}): MockState {
  return {
    units: 'metric',
    antennaType: 'dipole',
    length: 20,
    height: 10,
    frequency: 7.1,
    orientation: 'EW',
    vAngle: 120,
    terminatingResistor: 0,
    setAntennaType: vi.fn(),
    setLength: vi.fn(),
    setHalfWaveLength: vi.fn(),
    setLegLengthMultiple: vi.fn(),
    setHeight: vi.fn(),
    setOrientation: vi.fn(),
    setVAngle: vi.fn(),
    setTerminatingResistor: vi.fn(),
    ...overrides,
  };
}

describe('DipoleControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('updates orientation when numeric input changes', () => {
    const setOrientation = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState({ setOrientation }));
    });

    render(<DipoleControl />);

    const orientInput = document.getElementById('dipole-orientation') as HTMLInputElement;
    fireEvent.change(orientInput, { target: { value: '45' } });

    expect(setOrientation).toHaveBeenCalledWith(45);
  });

  it('updates orientation when preset buttons are clicked', () => {
    const setOrientation = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState({ setOrientation }));
    });

    render(<DipoleControl />);

    const nsButton = screen.getByRole('button', { name: 'NS' });
    fireEvent.click(nsButton);

    expect(setOrientation).toHaveBeenCalledWith('NS');
  });

  it('embeds the transformer subsection inside the Antenna panel', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState());
    });

    render(<DipoleControl />);

    // Both the Antenna section heading and the Transformer subheading
    // should render under the same control — proves the Transformer
    // controls have moved into the Antenna box.
    expect(screen.getByRole('heading', { name: /Antenna/i })).toBeTruthy();
    expect(screen.getByText('Transformer at feedpoint')).toBeTruthy();
    expect(screen.getByLabelText(/Fit transformer \/ balun at the antenna/i)).toBeTruthy();
  });
});
