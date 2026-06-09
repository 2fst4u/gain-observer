import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GeometryControl } from '../src/components/Panel/GeometryControl';
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
  foldedDipoleAperture: number;
  wireRadius: number;
  terminatingResistor: number;
  whipCounterpoise: boolean;
  transformerEnabled: boolean;
  transformerRatio: number;
  setAntennaType: () => void;
  setLength: () => void;
  setHalfWaveLength: () => void;
  setLegLengthMultiple: () => void;
  setHeight: () => void;
  setOrientation: (o: string | number) => void;
  setVAngle: () => void;
  setFoldedDipoleAperture: (a: number) => void;
  setWhipCounterpoise: (w: boolean) => void;
  setTerminatingResistor: () => void;
  setTransformerEnabled: () => void;
  setTransformerRatio: () => void;
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
    foldedDipoleAperture: 0.1,
    wireRadius: 0.001,
    whipCounterpoise: false,
    terminatingResistor: 0,
    transformerEnabled: false,
    transformerRatio: 9,
    setAntennaType: vi.fn(),
    setLength: vi.fn(),
    setHalfWaveLength: vi.fn(),
    setLegLengthMultiple: vi.fn(),
    setHeight: vi.fn(),
    setOrientation: vi.fn(),
    setVAngle: vi.fn(),
    setFoldedDipoleAperture: vi.fn(),
    setWhipCounterpoise: vi.fn(),
    setTerminatingResistor: vi.fn(),
    setTransformerEnabled: vi.fn(),
    setTransformerRatio: vi.fn(),
    ...overrides,
  };
}

describe('GeometryControl', () => {
  it('updates V angle when input changes', () => {
    const setVAngle = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState({
        antennaType: 'sloping-v',
        vAngle: 120,
        setVAngle
      }));
    });

    render(<GeometryControl />);

    const angleInput = screen.getByRole('slider', { name: /V opening angle in degrees/i });
    fireEvent.change(angleInput, { target: { value: '90' } });

    expect(setVAngle).toHaveBeenCalledWith(90);
  });

  it('toggles whip counterpoise when antenna is vertical-whip', () => {
    const setWhipCounterpoise = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState({
        antennaType: 'vertical-whip',
        whipCounterpoise: false,
        setWhipCounterpoise
      }));
    });

    render(<GeometryControl />);

    const checkbox = screen.getByRole('checkbox', { name: /Add ¼λ counterpoise radials/i });
    fireEvent.click(checkbox);

    expect(setWhipCounterpoise).toHaveBeenCalledWith(true);
  });

  it('updates aperture when antenna is folded-dipole', () => {
    const setFoldedDipoleAperture = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState({
        antennaType: 'folded-dipole',
        foldedDipoleAperture: 0.1,
        setFoldedDipoleAperture
      }));
    });

    render(<GeometryControl />);

    const apertureInput = screen.getByRole('slider', { name: /Folded dipole conductor spacing/i });
    fireEvent.change(apertureInput, { target: { value: '0.15' } });

    expect(setFoldedDipoleAperture).toHaveBeenCalledWith(0.15);
  });

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('updates orientation when numeric input changes', () => {
    const setOrientation = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState({ setOrientation }));
    });

    render(<GeometryControl />);

    const orientInput = document.getElementById('dipole-orientation') as HTMLInputElement;
    fireEvent.change(orientInput, { target: { value: '45' } });

    expect(setOrientation).toHaveBeenCalledWith(45);
  });

  it('updates orientation when preset buttons are clicked', () => {
    const setOrientation = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState({ setOrientation }));
    });

    render(<GeometryControl />);

    const nsButton = screen.getByRole('button', { name: 'NS' });
    fireEvent.click(nsButton);

    expect(setOrientation).toHaveBeenCalledWith('NS');
  });

  it('embeds the transformer subsection inside the Antenna panel', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState());
    });

    render(<GeometryControl />);

    // Both the Antenna section heading and the Transformer subheading
    // should render under the same control — proves the Transformer
    // controls have moved into the Antenna box.
    expect(screen.getByRole('heading', { name: /Antenna/i })).toBeTruthy();
    expect(screen.getByText('Transformer at feedpoint')).toBeTruthy();
    expect(screen.getByLabelText(/Fit transformer \/ balun at the antenna/i)).toBeTruthy();
  });

  it('updates antenna type when changed', () => {
    const setAntennaType = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState({ setAntennaType }));
    });

    render(<GeometryControl />);

    const typeSelect = screen.getByRole('combobox', { name: /Type/i });
    fireEvent.change(typeSelect, { target: { value: 'inverted-v' } });

    expect(setAntennaType).toHaveBeenCalledWith('inverted-v');
  });

  it('updates terminating resistor when input changes', () => {
    const setTerminatingResistor = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState({
        antennaType: 'terminated-delta',
        terminatingResistor: 0,
        setTerminatingResistor
      }));
    });

    render(<GeometryControl />);

    const resistorInput = document.getElementById('terminating-resistor') as HTMLInputElement;
    fireEvent.change(resistorInput, { target: { value: '600' } });

    expect(setTerminatingResistor).toHaveBeenCalledWith(600);
  });

  it('updates inverted-l orientation when input changes', () => {
    const setOrientation = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      return selector(buildMockState({
        antennaType: 'inverted-l',
        setOrientation
      }));
    });

    render(<GeometryControl />);

    const orientInput = document.getElementById('inverted-l-orientation') as HTMLInputElement;
    fireEvent.change(orientInput, { target: { value: '45' } });

    expect(setOrientation).toHaveBeenCalledWith(45);
  });
});
