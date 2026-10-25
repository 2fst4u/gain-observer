import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LengthControl } from '../../../../src/components/Panel/Geometry/LengthControl';
import { mockAntennaStore, type MockAntennaState } from '../../../helpers/mockStore';
import type { AntennaType } from '../../../../src/store/antennaStore';

vi.mock('../../../../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../../../../src/store/antennaStore');
  return {
    ...actual,
    useAntennaStore: vi.fn(),
  };
});

function buildMockState(overrides: Partial<MockAntennaState> = {}): MockAntennaState {
  return {
    units: 'metric',
    antennaType: 'dipole',
    length: 20,
    frequency: 14.1,
    setLength: vi.fn(),
    setHalfWaveLength: vi.fn(),
    ...overrides,
  };
}

describe('LengthControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Labels and Units', () => {
    it('renders default Length (m) label for dipole in metric units', () => {
      mockAntennaStore(buildMockState({ antennaType: 'dipole', units: 'metric' }));
      render(<LengthControl />);

      expect(screen.getByText('Length (m)')).toBeDefined();
    });

    it('renders Length (ft) label for dipole in imperial units', () => {
      mockAntennaStore(buildMockState({ antennaType: 'dipole', units: 'imperial' }));
      render(<LengthControl />);

      expect(screen.getByText('Length (ft)')).toBeDefined();
    });

    it('renders Whip length label for vertical-whip', () => {
      mockAntennaStore(buildMockState({ antennaType: 'vertical-whip', units: 'metric' }));
      render(<LengthControl />);

      expect(screen.getByText('Whip length (m)')).toBeDefined();
    });

    it('renders total wire length label for inverted-l', () => {
      mockAntennaStore(buildMockState({ antennaType: 'inverted-l', units: 'metric' }));
      render(<LengthControl />);

      expect(screen.getByText('Total wire length — vertical + horizontal (m)')).toBeDefined();
    });

    it('renders conductor length label for folded-dipole', () => {
      mockAntennaStore(buildMockState({ antennaType: 'folded-dipole', units: 'metric' }));
      render(<LengthControl />);

      expect(screen.getByText('Conductor length — ½λ each (m)')).toBeDefined();
    });
  });

  describe('Numeric Input Value and Conversion', () => {
    it('displays length formatted to 2 decimal places in metric units', () => {
      mockAntennaStore(buildMockState({ length: 20.1234, units: 'metric' }));
      render(<LengthControl />);

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('20.12');
    });

    it('displays length converted and formatted to 2 decimal places in imperial units', () => {
      // 10 meters ≈ 32.81 feet
      mockAntennaStore(buildMockState({ length: 10, units: 'imperial' }));
      render(<LengthControl />);

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('32.81');
    });

    it('calls setLength with converted meters when metric input value changes', () => {
      const setLength = vi.fn();
      mockAntennaStore(buildMockState({ units: 'metric', setLength }));
      render(<LengthControl />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '25.5' } });

      expect(setLength).toHaveBeenCalledWith(25.5);
    });

    it('calls setLength with converted meters when imperial input value changes', () => {
      const setLength = vi.fn();
      mockAntennaStore(buildMockState({ units: 'imperial', setLength }));
      render(<LengthControl />);

      const input = screen.getByRole('spinbutton');
      // 32.80839895013123 ft = 10 meters
      fireEvent.change(input, { target: { value: '32.80839895013123' } });

      expect(setLength).toHaveBeenCalledWith(expect.closeTo(10, 4));
    });
  });

  describe('Resonate Button', () => {
    const resonateCases: Array<{ type: AntennaType; label: string }> = [
      { type: 'dipole', label: '½λ' },
      { type: 'inverted-v', label: '½λ' },
      { type: 'delta-loop', label: '1λ' },
      { type: 'terminated-delta', label: '1λ' },
      { type: 'vertical-whip', label: '¼λ' },
      { type: 'inverted-l', label: '¼λ' },
      { type: 'folded-dipole', label: '½λ' },
    ];

    resonateCases.forEach(({ type, label }) => {
      it(`renders resonate button with label ${label} for ${type}`, () => {
        mockAntennaStore(buildMockState({ antennaType: type }));
        render(<LengthControl />);

        const resonateBtn = screen.getByRole('button', {
          name: `${label} (Resonate antenna length)`,
        });
        expect(resonateBtn).toBeDefined();
        expect(resonateBtn.textContent).toBe(label);
      });
    });

    it('does not render resonate button for sloping-v', () => {
      mockAntennaStore(buildMockState({ antennaType: 'sloping-v' }));
      render(<LengthControl />);

      expect(screen.queryByRole('button', { name: /Resonate antenna length/i })).toBeNull();
    });

    it('calls setHalfWaveLength when resonate button is clicked', () => {
      const setHalfWaveLength = vi.fn();
      mockAntennaStore(buildMockState({ antennaType: 'dipole', setHalfWaveLength }));
      render(<LengthControl />);

      const resonateBtn = screen.getByRole('button', {
        name: '½λ (Resonate antenna length)',
      });
      fireEvent.click(resonateBtn);

      expect(setHalfWaveLength).toHaveBeenCalledTimes(1);
    });
  });

  describe('1.25λ Extended Double Zepp Preset Button', () => {
    it('renders 1.25λ button for dipole antenna', () => {
      mockAntennaStore(buildMockState({ antennaType: 'dipole' }));
      render(<LengthControl />);

      const zeppBtn = screen.getByRole('button', {
        name: '1.25λ Extended Double Zepp preset length',
      });
      expect(zeppBtn).toBeDefined();
      expect(zeppBtn.textContent).toBe('1.25λ');
    });

    it('does not render 1.25λ button for non-dipole antennas', () => {
      const nonDipoleTypes: AntennaType[] = [
        'inverted-v',
        'delta-loop',
        'sloping-v',
        'terminated-delta',
        'vertical-whip',
        'inverted-l',
        'folded-dipole',
      ];

      nonDipoleTypes.forEach((antennaType) => {
        cleanup();
        mockAntennaStore(buildMockState({ antennaType }));
        render(<LengthControl />);

        expect(
          screen.queryByRole('button', {
            name: '1.25λ Extended Double Zepp preset length',
          })
        ).toBeNull();
      });
    });

    it('calls setLength with calculated 1.25λ length when clicked', () => {
      const setLength = vi.fn();
      const frequency = 14.1; // MHz
      mockAntennaStore(buildMockState({ antennaType: 'dipole', frequency, setLength }));
      render(<LengthControl />);

      const zeppBtn = screen.getByRole('button', {
        name: '1.25λ Extended Double Zepp preset length',
      });
      fireEvent.click(zeppBtn);

      const expectedLambda = 299.792458 / frequency;
      const expectedLength = expectedLambda * 1.25;

      expect(setLength).toHaveBeenCalledWith(expectedLength);
    });
  });
});
