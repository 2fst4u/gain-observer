import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DeltaFeedControl } from '../../../../src/components/Panel/Geometry/DeltaFeedControl';
import { mockAntennaStore } from '../../../helpers/mockStore';

vi.mock('../../../../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../../../../src/store/antennaStore');
  return { ...actual, useAntennaStore: vi.fn() };
});

describe('DeltaFeedControl', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); });

  it('only appears for the delta loop', () => {
    mockAntennaStore({ antennaType: 'terminated-delta', deltaFeed: 'apex', setDeltaFeed: vi.fn() });
    expect(render(<DeltaFeedControl />).container.innerHTML).toBe('');
  });

  it('shows the selected feed and switches to the corner', () => {
    const setDeltaFeed = vi.fn();
    mockAntennaStore({ antennaType: 'delta-loop', deltaFeed: 'apex', setDeltaFeed });
    render(<DeltaFeedControl />);
    expect(screen.getByRole('button', { name: 'Apex' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/horizontal polarisation/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Lower corner' }));
    expect(setDeltaFeed).toHaveBeenCalledWith('corner');
  });

  it('explains the corner feed', () => {
    mockAntennaStore({ antennaType: 'delta-loop', deltaFeed: 'corner', setDeltaFeed: vi.fn() });
    render(<DeltaFeedControl />);
    expect(screen.getByRole('button', { name: 'Lower corner' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/vertical polarisation at low angles/)).toBeDefined();
  });
});
