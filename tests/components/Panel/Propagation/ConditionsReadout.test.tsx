import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConditionsReadout } from '../../../../src/components/Panel/Propagation/ConditionsReadout';
import { makeHop, makePropagationPrediction } from '../../../helpers/factories';

const defaults = { haveTakeoff: true, units: 'metric' as const };
afterEach(cleanup);

describe('ConditionsReadout', () => {
  it('reports ideal arc distances and numerical gain without claiming usable signals', () => {
    render(<ConditionsReadout {...defaults} prediction={makePropagationPrediction()} />);
    expect(screen.getByText('1× ideal hop').nextElementSibling!.textContent).toBe('1000 km');
    expect(screen.getByText('Selected lobe realized gain').nextElementSibling!.textContent).toBe('4.00 dBi');
    expect(screen.getByText('Received signal and path availability: not calculated.')).toBeDefined();
    expect(screen.queryByText(/usable signal|weak signal|Open|Closed/)).toBeNull();
    expect(screen.queryByText('LUF')).toBeNull();
  });

  it('renders the pending antenna state', () => {
    render(<ConditionsReadout {...defaults} haveTakeoff={false} prediction={makePropagationPrediction()} />);
    expect(screen.getByText('Computing antenna pattern…')).toBeDefined();
  });

  it('explains the distinction between an ideal shell and measured hmF2', () => {
    render(<ConditionsReadout {...defaults} prediction={makePropagationPrediction()} />);
    const text = screen.getByText(/This is an ideal spherical-shell geometry illustration/);
    expect(text.closest('div')!.hidden).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Model & assumptions' }));
    expect(text.closest('div')!.hidden).toBe(false);
    expect(screen.getByText(/not hmF2/)).toBeDefined();
  });

  it('formats imperial arcs correctly', () => {
    render(<ConditionsReadout {...defaults} units="imperial" prediction={makePropagationPrediction({ hops: [makeHop({ rangeKm: 1609.344 })] })} />);
    expect(screen.getByText('1× ideal hop').nextElementSibling!.textContent).toBe('1000 mi');
  });
});
