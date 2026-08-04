import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GeometryControl } from '../src/components/Panel/GeometryControl';
import { mockAntennaStore, type MockAntennaState } from './helpers/mockStore';

// Mock the store
vi.mock('../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../src/store/antennaStore');
  return {
    ...actual,
    useAntennaStore: vi.fn(),
  };
});

type MockState = MockAntennaState;

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
    mockAntennaStore(buildMockState({
        antennaType: 'sloping-v',
        vAngle: 120,
        setVAngle
      }));

    render(<GeometryControl />);

    const angleInput = screen.getByRole('slider', { name: /V opening angle in degrees/i });
    fireEvent.change(angleInput, { target: { value: '90' } });

    expect(setVAngle).toHaveBeenCalledWith(90);
  });

  it('toggles whip counterpoise when antenna is vertical-whip', () => {
    const setWhipCounterpoise = vi.fn();
    mockAntennaStore(buildMockState({
        antennaType: 'vertical-whip',
        whipCounterpoise: false,
        setWhipCounterpoise
      }));

    render(<GeometryControl />);

    const checkbox = screen.getByRole('checkbox', { name: /Add ¼λ counterpoise radials/i });
    fireEvent.click(checkbox);

    expect(setWhipCounterpoise).toHaveBeenCalledWith(true);
  });

  it('updates aperture when antenna is folded-dipole', () => {
    const setFoldedDipoleAperture = vi.fn();
    mockAntennaStore(buildMockState({
        antennaType: 'folded-dipole',
        foldedDipoleAperture: 0.1,
        setFoldedDipoleAperture
      }));

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
    mockAntennaStore(buildMockState({ setOrientation }));

    render(<GeometryControl />);

    const orientInput = document.getElementById('dipole-orientation') as HTMLInputElement;
    fireEvent.change(orientInput, { target: { value: '45' } });

    expect(setOrientation).toHaveBeenCalledWith(45);
  });

  it('updates orientation when preset buttons are clicked', () => {
    const setOrientation = vi.fn();
    mockAntennaStore(buildMockState({ setOrientation }));

    render(<GeometryControl />);

    const nsButton = screen.getByRole('button', { name: 'NS' });
    fireEvent.click(nsButton);

    expect(setOrientation).toHaveBeenCalledWith('NS');
  });

  it('embeds the transformer subsection inside the Antenna panel', () => {
    mockAntennaStore(buildMockState());

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
    mockAntennaStore(buildMockState({ setAntennaType }));

    render(<GeometryControl />);

    const typeSelect = screen.getByRole('combobox', { name: /Antenna/i });
    fireEvent.change(typeSelect, { target: { value: 'inverted-v' } });

    expect(setAntennaType).toHaveBeenCalledWith('inverted-v');
  });

  it('updates terminating resistor when input changes', () => {
    const setTerminatingResistor = vi.fn();
    mockAntennaStore(buildMockState({
        antennaType: 'terminated-delta',
        terminatingResistor: 0,
        setTerminatingResistor
      }));

    render(<GeometryControl />);

    const resistorInput = document.getElementById('terminating-resistor') as HTMLInputElement;
    fireEvent.change(resistorInput, { target: { value: '600' } });

    expect(setTerminatingResistor).toHaveBeenCalledWith(600);
  });

  it('updates inverted-l orientation when input changes', () => {
    const setOrientation = vi.fn();
    mockAntennaStore(buildMockState({
        antennaType: 'inverted-l',
        setOrientation
      }));

    render(<GeometryControl />);

    const orientInput = document.getElementById('inverted-l-orientation') as HTMLInputElement;
    fireEvent.change(orientInput, { target: { value: '45' } });

    expect(setOrientation).toHaveBeenCalledWith(45);
  });

  it('updates length and resets the local value on blur', () => {
    const setLength = vi.fn();
    mockAntennaStore(buildMockState({ length: 20, setLength }));

    render(<GeometryControl />);

    const lengthInput = document.getElementById('dipole-length') as HTMLInputElement;
    fireEvent.focus(lengthInput);
    fireEvent.change(lengthInput, { target: { value: '33.5' } });
    expect(setLength).toHaveBeenCalledWith(33.5);

    // Editing should keep the typed value while focused...
    expect(lengthInput.value).toBe('33.5');

    // ...and snap back to the canonical store value (20.00) on blur.
    fireEvent.blur(lengthInput);
    expect(lengthInput.value).toBe('20.00');
  });

  it('ignores non-numeric length input', () => {
    const setLength = vi.fn();
    mockAntennaStore(buildMockState({ setLength }));

    render(<GeometryControl />);

    const lengthInput = document.getElementById('dipole-length') as HTMLInputElement;
    fireEvent.change(lengthInput, { target: { value: 'abc' } });

    expect(setLength).not.toHaveBeenCalled();
  });

  it('resonates the antenna to ½λ when the resonate button is clicked', () => {
    const setHalfWaveLength = vi.fn();
    mockAntennaStore(buildMockState({ antennaType: 'dipole', setHalfWaveLength }));

    render(<GeometryControl />);

    const resonate = screen.getByRole('button', { name: /Resonate antenna length/i });
    fireEvent.click(resonate);

    expect(setHalfWaveLength).toHaveBeenCalledTimes(1);
  });

  it('applies the 1.25λ Extended Double Zepp preset for a dipole', () => {
    const setLength = vi.fn();
    mockAntennaStore(buildMockState({ antennaType: 'dipole', frequency: 7.1, setLength }));

    render(<GeometryControl />);

    const zepp = screen.getByRole('button', { name: /Extended Double Zepp/i });
    fireEvent.click(zepp);

    // lambda = 299.792458 / 7.1 ≈ 42.22 m, ×1.25 ≈ 52.78 m
    expect(setLength).toHaveBeenCalledWith(expect.closeTo(52.78, 1));
  });

  it('sets the leg-length multiple for a sloping-v', () => {
    const setLegLengthMultiple = vi.fn();
    mockAntennaStore(buildMockState({ antennaType: 'sloping-v', setLegLengthMultiple }));

    render(<GeometryControl />);

    const threeLambda = screen.getByRole('button', { name: '3λ' });
    fireEvent.click(threeLambda);

    expect(setLegLengthMultiple).toHaveBeenCalledWith(3);
  });

  it('updates height when the slider changes', () => {
    const setHeight = vi.fn();
    mockAntennaStore(buildMockState({ setHeight }));

    render(<GeometryControl />);

    const heightSlider = screen.getByRole('slider', { name: 'Height above ground' });
    fireEvent.change(heightSlider, { target: { value: '15' } });

    expect(setHeight).toHaveBeenCalledWith(15);
  });

  it('sets the terminating resistor to Z₀ for a folded dipole', () => {
    const setTerminatingResistor = vi.fn();
    mockAntennaStore(buildMockState({
      antennaType: 'folded-dipole',
      foldedDipoleAperture: 0.1,
      wireRadius: 0.001,
      terminatingResistor: 0,
      setTerminatingResistor,
    }));

    render(<GeometryControl />);

    const z0Button = screen.getByRole('button', { name: /Set terminating resistor to Z₀/i });
    fireEvent.click(z0Button);

    expect(setTerminatingResistor).toHaveBeenCalledTimes(1);
    // Z₀ = round(120 · acosh(0.1 / 0.002)) ≈ 552 Ω — well above zero.
    expect(setTerminatingResistor.mock.calls[0][0]).toBeGreaterThan(100);
  });

  it('turns the termination off and resets the resistor field on blur', () => {
    const setTerminatingResistor = vi.fn();
    mockAntennaStore(buildMockState({
      antennaType: 'terminated-delta',
      terminatingResistor: 600,
      setTerminatingResistor,
    }));

    render(<GeometryControl />);

    const offButton = screen.getByRole('button', { name: /Turn off termination resistor/i });
    fireEvent.click(offButton);
    expect(setTerminatingResistor).toHaveBeenCalledWith(0);

    const resistorInput = document.getElementById('terminating-resistor') as HTMLInputElement;
    fireEvent.focus(resistorInput);
    fireEvent.change(resistorInput, { target: { value: '450' } });
    expect(setTerminatingResistor).toHaveBeenCalledWith(450);

    fireEvent.blur(resistorInput);
    expect(resistorInput.value).toBe('600');
  });

  it('renders the counterpoise-enabled hint for a vertical whip', () => {
    mockAntennaStore(buildMockState({ antennaType: 'vertical-whip', whipCounterpoise: true }));

    render(<GeometryControl />);

    const checkbox = screen.getByRole('checkbox', { name: /Add ¼λ counterpoise radials/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText(/canonical ground-plane vertical/i)).toBeTruthy();
  });

  it('selects an inverted-l horizontal direction preset', () => {
    const setOrientation = vi.fn();
    mockAntennaStore(buildMockState({ antennaType: 'inverted-l', setOrientation }));

    render(<GeometryControl />);

    const group = screen.getByRole('group', { name: /Horizontal section direction presets/i });
    const ewButton = screen.getByRole('button', { name: 'EW' });
    expect(group.contains(ewButton)).toBe(true);
    fireEvent.click(ewButton);

    expect(setOrientation).toHaveBeenCalledWith('EW');
  });

  it('reconciles the length field when the store value changes while unfocused', () => {
    mockAntennaStore(buildMockState({ length: 20 }));

    const { rerender } = render(<GeometryControl />);
    const lengthInput = document.getElementById('dipole-length') as HTMLInputElement;
    expect(lengthInput.value).toBe('20.00');

    // External store update (e.g. a resonate click elsewhere) should flow into
    // the controlled input because the field is not focused.
    mockAntennaStore(buildMockState({ length: 42 }));
    rerender(<GeometryControl />);

    expect(lengthInput.value).toBe('42.00');
  });
});
