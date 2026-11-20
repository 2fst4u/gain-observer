import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { YagiBuildSheet } from '../../../../src/components/Panel/Geometry/YagiBuildSheet';
import { mockAntennaStore, type MockAntennaState } from '../../../helpers/mockStore';

vi.mock('../../../../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../../../../src/store/antennaStore');
  return { ...actual, useAntennaStore: vi.fn() };
});

function state(overrides: Partial<MockAntennaState> = {}): MockAntennaState {
  return { antennaType: 'yagi', units: 'metric', length: 20, height: 8, orientation: 'EW', ...overrides };
}

const row = (label: string) => screen.getByText(label).parentElement!.querySelector('.stat-value')!.textContent;

describe('YagiBuildSheet', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); });

  it('renders nothing for other antenna types', () => {
    mockAntennaStore(state({ antennaType: 'dipole' }));
    const { container } = render(<YagiBuildSheet />);
    expect(container.innerHTML).toBe('');
  });

  it('lists every cut length and spacing needed to build the array', () => {
    mockAntennaStore(state());
    render(<YagiBuildSheet />);
    expect(row('Reflector (rear)')).toBe('21.00 m');
    expect(row('Driven element')).toBe('20.00 m');
    expect(row('… each half')).toBe('9.95 m');
    expect(row('Director (front)')).toBe('19.20 m');
    expect(row('Reflector → driven')).toBe('8.27 m');
    expect(row('Driven → director')).toBe('8.27 m');
    expect(row('Reflector → director')).toBe('16.55 m');
    expect(row('Height (all elements)')).toBe('8.00 m');
    expect(row('Beam heading')).toBe('90° (E)');
    expect(screen.getByRole('img')).toBeDefined();
  });

  it('follows the length, units and a numeric heading', () => {
    mockAntennaStore(state({ length: 10, units: 'imperial', orientation: 200 }));
    render(<YagiBuildSheet />);
    expect(row('Driven element')).toBe(`${(10 / 0.3048).toFixed(2)} ft`);
    expect(row('Reflector (rear)')).toBe(`${(10.5 / 0.3048).toFixed(2)} ft`);
    expect(row('Beam heading')).toBe('200° (S)');
  });
});
