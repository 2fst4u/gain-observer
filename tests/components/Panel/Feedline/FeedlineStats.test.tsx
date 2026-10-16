import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FeedlineStats } from '../../../../src/components/Panel/Feedline/FeedlineStats';
import { findFeedlinePreset } from '../../../../src/physics/constants';

describe('FeedlineStats', () => {
  it('renders impedance/velocity factor and cable loss rows', () => {
    const preset = findFeedlinePreset('rg58');

    render(
      <FeedlineStats
        preset={preset}
        frequency={14.15}
        lossDb={1.25}
      />
    );

    expect(screen.getByText('Z₀ / VF')).toBeDefined();
    expect(screen.getByText(`${preset.z0.toFixed(0)} Ω · ${preset.velocityFactor.toFixed(2)}`)).toBeDefined();
    expect(screen.getByText('Cable loss @ 14.15 MHz')).toBeDefined();
    expect(screen.getByText('1.25 dB')).toBeDefined();
  });
});
