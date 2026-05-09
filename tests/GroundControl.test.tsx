import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GroundControl } from '../src/components/Panel/GroundControl';
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
  groundId: string;
  groundSigma: number;
  groundEpsilon: number;
  setGround: (id: string) => void;
  setCustomGround: (sigma: number, epsilon: number) => void;
}

describe('GroundControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('updates groundId when selection changes', () => {
    const setGround = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      const state: MockState = {
        groundId: 'pastoral',
        groundSigma: 0.005,
        groundEpsilon: 13,
        setGround,
        setCustomGround: vi.fn(),
      };
      return selector(state);
    });

    render(<GroundControl />);

    const select = screen.getByRole('combobox', { name: 'Ground preset' });
    fireEvent.change(select, { target: { value: 'sea' } });

    expect(setGround).toHaveBeenCalledWith('sea');
  });

  it('shows custom inputs and updates them when custom is selected', () => {
    const setCustomGround = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      const state: MockState = {
        groundId: 'custom',
        groundSigma: 0.005,
        groundEpsilon: 13,
        setGround: vi.fn(),
        setCustomGround,
      };
      return selector(state);
    });

    render(<GroundControl />);

    const sigmaInput = screen.getByLabelText('Conductivity σ (S/m)');
    fireEvent.change(sigmaInput, { target: { value: '0.01' } });
    expect(setCustomGround).toHaveBeenCalledWith(0.01, 13);

    const epsilonInput = screen.getByLabelText('Permittivity εr');
    fireEvent.change(epsilonInput, { target: { value: '15' } });
    expect(setCustomGround).toHaveBeenCalledWith(0.005, 15);
  });

  it('shows custom inputs when expanded button is clicked', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      const state: MockState = {
        groundId: 'pastoral',
        groundSigma: 0.005,
        groundEpsilon: 13,
        setGround: vi.fn(),
        setCustomGround: vi.fn(),
      };
      return selector(state);
    });

    render(<GroundControl />);

    // Initially custom inputs are not visible
    expect(screen.queryByLabelText('Conductivity σ (S/m)')).toBeNull();
    expect(screen.queryByLabelText('Permittivity εr')).toBeNull();

    const expandButton = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(expandButton);

    // After clicking, they should be visible
    expect(screen.getByLabelText('Conductivity σ (S/m)')).toBeDefined();
    expect(screen.getByLabelText('Permittivity εr')).toBeDefined();
  });
});
