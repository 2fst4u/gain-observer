import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TypeControl } from '../../../../src/components/Panel/Geometry/TypeControl';
import { mockAntennaStore, type MockAntennaState } from '../../../helpers/mockStore';
import { resonateTitles } from '../../../../src/components/Panel/Geometry/constants';
import type { AntennaType } from '../../../../src/store/antennaStore';

vi.mock('../../../../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../../../../src/store/antennaStore');
  return {
    ...actual,
    useAntennaStore: vi.fn(),
  };
});

describe('TypeControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  function setupMockState(overrides: Partial<MockAntennaState> = {}) {
    const setAntennaType = vi.fn();
    const defaultState: MockAntennaState = {
      antennaType: 'dipole',
      setAntennaType,
      ...overrides,
    };
    mockAntennaStore(defaultState);
    return { setAntennaType };
  }

  it('renders select input with all antenna options and current value', () => {
    setupMockState({ antennaType: 'delta-loop' });

    render(<TypeControl />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.id).toBe('antenna-type');
    expect(select.value).toBe('delta-loop');

    const options = screen.getAllByRole('option') as HTMLOptionElement[];
    expect(options).toHaveLength(8);

    const values = options.map((opt) => opt.value);
    expect(values).toEqual([
      'dipole',
      'inverted-v',
      'sloping-v',
      'delta-loop',
      'terminated-delta',
      'vertical-whip',
      'inverted-l',
      'folded-dipole',
    ]);
  });

  it('calls setAntennaType when a new antenna type is selected', () => {
    const { setAntennaType } = setupMockState({ antennaType: 'dipole' });

    render(<TypeControl />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'inverted-v' } });

    expect(setAntennaType).toHaveBeenCalledTimes(1);
    expect(setAntennaType).toHaveBeenCalledWith('inverted-v');
  });

  it('displays correct hint text corresponding to selected antennaType', () => {
    const antennaTypes: AntennaType[] = [
      'dipole',
      'inverted-v',
      'sloping-v',
      'delta-loop',
      'terminated-delta',
      'vertical-whip',
      'inverted-l',
      'folded-dipole',
    ];

    for (const type of antennaTypes) {
      cleanup();
      setupMockState({ antennaType: type });
      render(<TypeControl />);

      const hintContainer = document.getElementById('antenna-type-hint');
      expect(hintContainer).not.toBeNull();
      expect(hintContainer?.textContent).toBe(resonateTitles[type]);
    }
  });

  it('has correct accessibility attributes linking select to hint text', () => {
    setupMockState({ antennaType: 'dipole' });

    render(<TypeControl />);

    const select = screen.getByRole('combobox');
    expect(select.getAttribute('aria-describedby')).toBe('antenna-type-hint');

    const hint = document.getElementById('antenna-type-hint');
    expect(hint?.getAttribute('aria-live')).toBe('polite');
  });
});
