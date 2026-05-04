import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnitToggle } from '../src/components/Panel/UnitToggle';
import { useAntennaStore } from '../src/store/antennaStore';

describe('UnitToggle', () => {
  beforeEach(() => {
    useAntennaStore.setState({ units: 'metric' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with metric as active by default', () => {
    render(<UnitToggle />);
    const metricButton = screen.getByRole('button', { name: 'Meters' });
    const imperialButton = screen.getByRole('button', { name: 'Feet' });

    expect(metricButton.className).toContain('active');
    expect(metricButton.getAttribute('aria-pressed')).toBe('true');

    expect(imperialButton.className).not.toContain('active');
    expect(imperialButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles to imperial when clicked', () => {
    render(<UnitToggle />);
    const imperialButton = screen.getByRole('button', { name: 'Feet' });

    fireEvent.click(imperialButton);

    expect(useAntennaStore.getState().units).toBe('imperial');
  });

  it('toggles back to metric when clicked', () => {
    useAntennaStore.setState({ units: 'imperial' });
    render(<UnitToggle />);
    const metricButton = screen.getByRole('button', { name: 'Meters' });

    fireEvent.click(metricButton);

    expect(useAntennaStore.getState().units).toBe('metric');
  });

  it('reflects state changes', () => {
    useAntennaStore.setState({ units: 'imperial' });
    render(<UnitToggle />);
    const metricButton = screen.getByRole('button', { name: 'Meters' });
    const imperialButton = screen.getByRole('button', { name: 'Feet' });

    expect(imperialButton.className).toContain('active');
    expect(metricButton.className).not.toContain('active');
  });
});
