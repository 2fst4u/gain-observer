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
    expect((document.getElementById('yagi-reflector-length')! as HTMLInputElement).value).toBe('21.00');
    expect((document.getElementById('yagi-director-length')! as HTMLInputElement).value).toBe('19.20');
    expect(screen.getByText(/Reflector length \(m\) — ×1\.050 driven, design/)).toBeDefined();
    expect((screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('reports the deviation from the design and sends edits in metres', () => {
    const s = state({ yagiDirectorRatio: 0.96 * 1.03, units: 'imperial' });
    mockAntennaStore(s);
    render(<YagiElementControls />);
    expect(screen.getByText(/\+3\.0% vs design/)).toBeDefined();
    const input = document.getElementById('yagi-reflector-length')!;
    fireEvent.change(input, { target: { value: '70' } });
    fireEvent.blur(input);
    expect(s.setYagiReflectorLength).toHaveBeenCalledWith(expect.closeTo(70 * 0.3048, 6));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(s.resetYagiElements).toHaveBeenCalled();
  });

  it('gives both parasitic elements sliders that send metres and span the useful ratios', () => {
    const s = state();
    mockAntennaStore(s);
    render(<YagiElementControls />);
    const refl = screen.getByRole('slider', { name: 'Reflector length' }) as HTMLInputElement;
    const dir = screen.getByRole('slider', { name: 'Director length' }) as HTMLInputElement;
    expect([Number(refl.min), Number(refl.max), Number(refl.value)]).toEqual([18, 24, 21]);
    expect([Number(dir.min), Number(dir.max), Number(dir.value)]).toEqual([16, 22, 19.2]);
    fireEvent.change(refl, { target: { value: '22.5' } });
    expect(s.setYagiReflectorLength).toHaveBeenCalledWith(22.5);
    fireEvent.change(dir, { target: { value: '18' } });
    expect(s.setYagiDirectorLength).toHaveBeenCalledWith(18);
  });

  it('widens a slider to include a typed length outside its usual span', () => {
    mockAntennaStore(state({ yagiDirectorRatio: 1.4 }));
    render(<YagiElementControls />);
    const dir = screen.getByRole('slider', { name: 'Director length' }) as HTMLInputElement;
    expect(Number(dir.max)).toBeGreaterThanOrEqual(28);
    expect(Number(dir.value)).toBe(28);
  });
});
