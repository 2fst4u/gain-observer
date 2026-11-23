import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConditionsReadout } from '../../../../src/components/Panel/Propagation/ConditionsReadout';
import { makeAzimuthalHop, makeHop, makeLayerParameters, makePropagationPrediction } from '../../../helpers/factories';

const defaults = { haveTakeoff: true, units: 'metric' as const, ionosphereStatus: 'ready' as const };
const value = (label: string) => screen.getByText(label).nextElementSibling!.textContent;
afterEach(cleanup);

describe('ConditionsReadout', () => {
  it('reports the ionosphere, landing distances and gain without claiming usable signals', () => {
    render(<ConditionsReadout {...defaults} prediction={makePropagationPrediction()} />);
    expect(value('foF2 (F2 critical frequency)')).toBe('8.00 MHz');
    expect(value('hmF2 (F2 peak height)')).toBe('300 km');
    expect(value('Strongest lobe, 1 hop')).toBe('1000 km');
    expect(value('Strongest lobe MUF')).toBe('14.0 MHz');
    expect(value('Strongest lobe realized gain')).toBe('4.00 dBi');
    expect(screen.getByText('Received signal and path availability: not calculated.')).toBeDefined();
    expect(screen.queryByText(/usable signal|weak signal|Open|Closed/)).toBeNull();
    expect(screen.queryByText('LUF')).toBeNull();
    expect(screen.queryByText('foF1')).toBeNull();
  });

  it('says whether near-vertical rays return or pass through', () => {
    render(<ConditionsReadout {...defaults} prediction={makePropagationPrediction({ frequencyMHz: 7.1, verticalCriticalMHz: 8 })} />);
    expect(value('Near-vertical (NVIS) rays')).toBe('Return (below 8.00 MHz)');
    cleanup();
    render(<ConditionsReadout {...defaults} prediction={makePropagationPrediction({ frequencyMHz: 7.1, verticalCriticalMHz: 5.5 })} />);
    expect(value('Near-vertical (NVIS) rays')).toBe('Pass through (above 5.50 MHz)');
  });

  it('shows foF1 only when there is an F1 layer', () => {
    render(<ConditionsReadout {...defaults} prediction={makePropagationPrediction({ layers: makeLayerParameters({ foF1: 4.6, hmF1: 190 }) })} />);
    expect(value('foF1')).toBe('4.60 MHz');
  });

  it('reports rays that pass through and a beam that does not return', () => {
    const prediction = makePropagationPrediction({
      hops: [makeHop({ rangeKm: undefined })],
      azimuthalHops: [
        makeAzimuthalHop({ phiDeg: 0, returns: false, rangeKm: [], halfPowerElevationDeg: { lowDeg: 60, highDeg: 90 } }),
        makeAzimuthalHop({ phiDeg: 90, returns: false, rangeKm: [], halfPowerElevationDeg: { lowDeg: 60, highDeg: 90 } }),
      ],
    });
    render(<ConditionsReadout {...defaults} prediction={prediction} />);
    expect(value('Strongest lobe, 1 hop')).toBe('Passes through');
    expect(value('Half-power beam, 1 hop')).toBe('Passes through');
  });

  it('reports the half-power beam reach over all bearings', () => {
    const prediction = makePropagationPrediction({
      azimuthalHops: [
        makeAzimuthalHop({ phiDeg: 0, halfPowerElevationDeg: { lowDeg: 30, highDeg: 50 }, halfPowerRangeKm: { nearKm: 600, farKm: 1100 } }),
        makeAzimuthalHop({ phiDeg: 90, halfPowerElevationDeg: { lowDeg: 25, highDeg: 45 }, halfPowerRangeKm: { nearKm: 700, farKm: 1300 } }),
      ],
    });
    render(<ConditionsReadout {...defaults} prediction={prediction} />);
    expect(value('Half-power beam, 1 hop')).toBe('600 km – 1300 km');
  });

  it('renders the loading, error and pending-antenna states', () => {
    render(<ConditionsReadout {...defaults} ionosphereStatus="loading" prediction={undefined} />);
    expect(screen.getByText('Loading ionosphere model…')).toBeDefined();
    cleanup();
    render(<ConditionsReadout {...defaults} ionosphereStatus="error" prediction={undefined} />);
    expect(screen.getByRole('alert').textContent).toBe('Could not load the ionosphere model.');
    cleanup();
    render(<ConditionsReadout {...defaults} haveTakeoff={false} prediction={makePropagationPrediction()} />);
    expect(screen.getByText('Computing antenna pattern…')).toBeDefined();
  });

  it('explains the model and its limits behind a toggle', () => {
    render(<ConditionsReadout {...defaults} prediction={makePropagationPrediction()} />);
    const text = screen.getByText(/International Reference Ionosphere \(IRI\) monthly median/);
    expect(text.closest('div')!.hidden).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Model & assumptions' }));
    expect(text.closest('div')!.hidden).toBe(false);
    expect(screen.getByText(/Sporadic E is not modelled/)).toBeDefined();
    expect(screen.getByText(/extraordinary wave/)).toBeDefined();
  });

  it('formats imperial distances correctly', () => {
    render(<ConditionsReadout {...defaults} units="imperial" prediction={makePropagationPrediction({ hops: [makeHop({ rangeKm: 1609.344 })] })} />);
    expect(value('Strongest lobe, 1 hop')).toBe('1000 mi');
  });
});
