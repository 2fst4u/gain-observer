import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeToggle } from '../src/components/UI/ThemeToggle';
import { useAntennaStore } from '../src/store/antennaStore';

describe('ThemeToggle', () => {
  beforeEach(() => {
    useAntennaStore.setState({ theme: 'dark' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders sun icon and correct labels when theme is dark', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Switch to light mode' });
    expect(button).toBeDefined();
    expect(button.title).toBe('Switch to light (T)');
    expect(button.textContent).toBe('☀');
  });

  it('renders moon icon and correct labels when theme is light', () => {
    useAntennaStore.setState({ theme: 'light' });
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Switch to dark mode' });
    expect(button).toBeDefined();
    expect(button.title).toBe('Switch to dark (T)');
    expect(button.textContent).toBe('☾');
  });

  it('toggles theme when clicked', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Switch to light mode' });

    fireEvent.click(button);

    expect(useAntennaStore.getState().theme).toBe('light');
  });
});
