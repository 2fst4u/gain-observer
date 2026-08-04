import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GroundControl } from '../src/components/Panel/GroundControl';
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

function mockGround(overrides: Partial<MockState> = {}) {
  const state: MockState = {
    groundId: 'pastoral',
    groundSigma: 0.005,
    groundEpsilon: 13,
    setGround: vi.fn(),
    setCustomGround: vi.fn(),
    ...overrides,
  };
  mockAntennaStore(state);
  return state;
}

describe('GroundControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('updates groundId when selection changes', () => {
    const setGround = vi.fn();
    mockAntennaStore({
        groundId: 'pastoral',
        groundSigma: 0.005,
        groundEpsilon: 13,
        setGround,
        setCustomGround: vi.fn(),
      });

    render(<GroundControl />);

    const select = screen.getByRole('combobox', { name: 'Ground preset' });
    fireEvent.change(select, { target: { value: 'sea' } });

    expect(setGround).toHaveBeenCalledWith('sea');
  });

  it('shows custom inputs and updates them when custom is selected', () => {
    const setCustomGround = vi.fn();
    mockAntennaStore({
        groundId: 'custom',
        groundSigma: 0.005,
        groundEpsilon: 13,
        setGround: vi.fn(),
        setCustomGround,
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
    mockAntennaStore({
        groundId: 'pastoral',
        groundSigma: 0.005,
        groundEpsilon: 13,
        setGround: vi.fn(),
        setCustomGround: vi.fn(),
      });

    render(<GroundControl />);

    // Initially custom inputs are not visible
    expect(screen.getByLabelText('Conductivity σ (S/m)').closest('div')).toHaveProperty('hidden', true);
    expect(screen.getByLabelText('Permittivity εr').closest('div')).toHaveProperty('hidden', true);

    const expandButton = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(expandButton);

    // After clicking, they should be visible
    expect(screen.getByLabelText('Conductivity σ (S/m)').closest('div')).toHaveProperty('hidden', false);
    expect(screen.getByLabelText('Permittivity εr').closest('div')).toHaveProperty('hidden', false);
  });

  it('collapses the custom inputs again via the Simple toggle', () => {
    mockGround({ groundId: 'pastoral' });

    render(<GroundControl />);

    fireEvent.click(screen.getByRole('button', { name: /Custom/i }));
    expect(screen.getByLabelText('Conductivity σ (S/m)').closest('div')).toHaveProperty('hidden', false);

    // Once expanded the toggle reads "Simple" and hides the inputs again.
    fireEvent.click(screen.getByRole('button', { name: /Simple/i }));
    expect(screen.getByLabelText('Conductivity σ (S/m)').closest('div')).toHaveProperty('hidden', true);
  });

  it('resets the sigma field to the store value on blur', () => {
    mockGround({ groundId: 'custom', groundSigma: 0.005 });

    render(<GroundControl />);

    const sigmaInput = screen.getByLabelText('Conductivity σ (S/m)') as HTMLInputElement;
    fireEvent.focus(sigmaInput);
    fireEvent.change(sigmaInput, { target: { value: '0.02' } });
    expect(sigmaInput.value).toBe('0.02');

    // The mocked store value stays at 0.005, so blur restores that text.
    fireEvent.blur(sigmaInput);
    expect(sigmaInput.value).toBe('0.005');
  });

  it('resets the epsilon field to the store value on blur', () => {
    mockGround({ groundId: 'custom', groundEpsilon: 13 });

    render(<GroundControl />);

    const epsilonInput = screen.getByLabelText('Permittivity εr') as HTMLInputElement;
    fireEvent.focus(epsilonInput);
    fireEvent.change(epsilonInput, { target: { value: '20' } });
    expect(epsilonInput.value).toBe('20');

    fireEvent.blur(epsilonInput);
    expect(epsilonInput.value).toBe('13');
  });

  it('ignores non-numeric custom ground entries', () => {
    const setCustomGround = vi.fn();
    mockGround({ groundId: 'custom', setCustomGround });

    render(<GroundControl />);

    fireEvent.change(screen.getByLabelText('Conductivity σ (S/m)'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('Permittivity εr'), { target: { value: 'xyz' } });

    expect(setCustomGround).not.toHaveBeenCalled();
  });

  it('falls back to a generic hint for an unknown ground id', () => {
    mockGround({ groundId: 'custom' });

    render(<GroundControl />);

    expect(screen.getByText('Custom ground parameters.')).toBeDefined();
  });
});
