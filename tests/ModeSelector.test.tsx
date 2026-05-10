import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModeSelector } from '../src/components/Panel/ModeSelector';
import { useAntennaStore } from '../src/store/antennaStore';

describe('ModeSelector', () => {
  beforeEach(() => {
    useAntennaStore.setState({ mode: 'normal' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all mode buttons', () => {
    render(<ModeSelector />);
    expect(screen.getByRole('button', { name: 'Normal' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'NVIS' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Compare' })).toBeDefined();
  });

  it('highlights the active mode', () => {
    useAntennaStore.setState({ mode: 'nvis' });
    render(<ModeSelector />);
    const nvisButton = screen.getByRole('button', { name: 'NVIS' });
    expect(nvisButton.className).toContain('active');
    expect(nvisButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('updates the mode when a button is clicked', () => {
    render(<ModeSelector />);
    const compareButton = screen.getByRole('button', { name: 'Compare' });

    fireEvent.click(compareButton);

    expect(useAntennaStore.getState().mode).toBe('comparison');
  });

  it('displays the correct hint for the active mode', () => {
    useAntennaStore.setState({ mode: 'comparison' });
    render(<ModeSelector />);
    expect(screen.getByText('Side-by-side two configs')).toBeDefined();
  });
});
