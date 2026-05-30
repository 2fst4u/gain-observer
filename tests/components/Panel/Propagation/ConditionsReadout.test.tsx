import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConditionsReadout } from '../../../../src/components/Panel/Propagation/ConditionsReadout';
import type { PropagationPrediction } from '../../../../src/physics/propagation';

describe('ConditionsReadout', () => {
  it('assigns correct colors based on hop status', () => {
    // Construct a mock prediction with all hop statuses
    const mockPrediction: PropagationPrediction = {
      mode: 'skywave',
      criticalFreqMhz: 5,
      foF2MHz: 5.5,
      hmF2Km: 300,
      mufMHz: 14.2,
      lufMHz: 3.5,
      selectedTakeoffElevationDeg: 15,
      mismatchLossDb: 0,
      hops: [
        { n: 1, rangeKm: 1000, status: 'open', linkQuality: 'useful', reason: 'Open path' },
        { n: 2, rangeKm: 2000, status: 'marginal', linkQuality: 'weak', reason: 'Marginal path' },
        { n: 3, rangeKm: 3000, status: 'closed', linkQuality: 'unusable', reason: 'Closed path' },
      ],
      azimuthalHops: []
    };

    cleanup();

    render(
      <ConditionsReadout
        prediction={mockPrediction}
        haveTakeoff={true}
        units="metric"
      />
    );

    // Verify the assigned styles (colors are defined inline via the style prop)
    const openHop = screen.getByText(/1× hop/).nextElementSibling as HTMLElement;
    const marginalHop = screen.getByText(/2× hop/).nextElementSibling as HTMLElement;
    const closedHop = screen.getByText(/3× hop/).nextElementSibling as HTMLElement;

    expect(openHop.style.color).toBe('var(--success)');
    expect(marginalHop.style.color).toBe('var(--warning)');
    expect(closedHop.style.color).toBe('var(--danger)');

    // Test the quality label map directly by asserting text content
    expect(openHop.textContent).toContain('usable signal');
    expect(marginalHop.textContent).toContain('weak signal');
    expect(closedHop.textContent).toContain('very weak signal');
  });

  it('renders "Computing antenna pattern..." when haveTakeoff is false', () => {
    const mockPrediction: PropagationPrediction = {
      mode: 'skywave',
      criticalFreqMhz: 5,
      foF2MHz: 5.5,
      hmF2Km: 300,
      mufMHz: 14.2,
      lufMHz: 3.5,
      selectedTakeoffElevationDeg: 15,
      mismatchLossDb: 0,
      hops: [],
      azimuthalHops: []
    };

    cleanup();

    render(
      <ConditionsReadout
        prediction={mockPrediction}
        haveTakeoff={false}
        units="metric"
      />
    );

    expect(screen.getByText('Computing antenna pattern…')).toBeDefined();
  });

  it('toggles assumptions panel visibility', () => {
    const mockPrediction: PropagationPrediction = {
      mode: 'skywave',
      criticalFreqMhz: 5,
      foF2MHz: 5.5,
      hmF2Km: 300,
      mufMHz: 14.2,
      lufMHz: 3.5,
      selectedTakeoffElevationDeg: 15,
      mismatchLossDb: 0,
      hops: [],
      azimuthalHops: []
    };

    cleanup();

    render(
      <ConditionsReadout
        prediction={mockPrediction}
        haveTakeoff={true}
        units="metric"
      />
    );

    const button = screen.getByRole('button', { name: /Model & assumptions/i });
    expect(screen.queryByText(/This is a closed-form approximation/i)).toBeNull();

    fireEvent.click(button);
    expect(screen.getByText(/This is a closed-form approximation/i)).toBeDefined();

    fireEvent.click(button);
    expect(screen.queryByText(/This is a closed-form approximation/i)).toBeNull();
  });

  it('displays ranges in km when units is metric', () => {
    const mockPrediction: PropagationPrediction = {
      mode: 'skywave',
      criticalFreqMhz: 5,
      foF2MHz: 5.5,
      hmF2Km: 300,
      mufMHz: 14.2,
      lufMHz: 3.5,
      selectedTakeoffElevationDeg: 15,
      mismatchLossDb: 0,
      hops: [
        { n: 1, rangeKm: 1000, status: 'open', linkQuality: 'useful', reason: 'Open path' },
      ],
      azimuthalHops: []
    };

    cleanup();

    render(
      <ConditionsReadout
        prediction={mockPrediction}
        haveTakeoff={true}
        units="metric"
      />
    );

    const hopTextContainer = screen.getByText(/1× hop/).nextElementSibling as HTMLElement;
    expect(hopTextContainer.textContent).toContain('1000 km');
  });

  it('displays ranges in miles when units is imperial', () => {
    const mockPrediction: PropagationPrediction = {
      mode: 'skywave',
      criticalFreqMhz: 5,
      foF2MHz: 5.5,
      hmF2Km: 300,
      mufMHz: 14.2,
      lufMHz: 3.5,
      selectedTakeoffElevationDeg: 15,
      mismatchLossDb: 0,
      hops: [
        { n: 1, rangeKm: 1609.344, status: 'open', linkQuality: 'useful', reason: 'Open path' },
      ],
      azimuthalHops: []
    };

    cleanup();

    render(
      <ConditionsReadout
        prediction={mockPrediction}
        haveTakeoff={true}
        units="imperial"
      />
    );

    const hopTextContainer = screen.getByText(/1× hop/).nextElementSibling as HTMLElement;
    expect(hopTextContainer.textContent).toContain('1000 mi');
  });
});
