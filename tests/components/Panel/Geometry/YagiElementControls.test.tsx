import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { YagiElementControls } from '../../../../src/components/Panel/Geometry/YagiElementControls';
import { mockAntennaStore, type MockAntennaState } from '../../../helpers/mockStore';

vi.mock('../../../../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../../../../src/store/antennaStore');
  return { ...actual, useAntennaStore: vi.fn() };
});

function state(overrides: Partial<MockAntennaState> = {}): MockAntennaState {
  return {
    antennaType: 'yagi', units: 'metric', length: 20, yagiReflectorRatio: 1.05, yagiDirectorRatio: 0.96,
    setYagiReflectorLength: vi.fn(), setYagiDirectorLength: vi.fn(), resetYagiElements: vi.fn(), ...overrides,
  };
}

describe('YagiElementControls', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); });

  it('renders nothing for other antennas', () => {
    mockAntennaStore(state({ antennaType: 'dipole' }));
    expect(render(<YagiElementControls />).container.innerHTML).toBe('');
  });

  it('shows the current lengths at the design ratios with reset disabled', () => {
    mockAntennaStore(state());
    render(<YagiElementControls />);
    expect((screen.getByLabelText(/Reflector length/) as HTMLInputElement).value).toBe('21.00');
    expect((screen.getByLabelText(/Director length/) as HTMLInputElement).value).toBe('19.20');
    expect(screen.getByText(/Reflector length \(m\) — ×1\.050 driven, design/)).toBeDefined();
    expect((screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('reports the deviation from the design and sends edits in metres', () => {
    const s = state({ yagiDirectorRatio: 0.96 * 1.03, units: 'imperial' });
    mockAntennaStore(s);
    render(<YagiElementControls />);
    expect(screen.getByText(/\+3\.0% vs design/)).toBeDefined();
    const input = screen.getByLabelText(/Reflector length/);
    fireEvent.change(input, { target: { value: '70' } });
    fireEvent.blur(input);
    expect(s.setYagiReflectorLength).toHaveBeenCalledWith(expect.closeTo(70 * 0.3048, 6));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(s.resetYagiElements).toHaveBeenCalled();
  });
});
