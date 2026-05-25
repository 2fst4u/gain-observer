import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ControlPanel } from '../src/components/Panel/ControlPanel';

describe('ControlPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the control panel with header and footer', () => {
    // Arrange
    render(<ControlPanel />);

    // Act
    const heading = screen.getByRole('heading', { name: /HF GAIN VISUALIZER/i });
    const footerLink = screen.getByRole('link', { name: /View source on GitHub/i });

    // Assert
    expect(heading).toBeTruthy();
    expect(footerLink).toBeTruthy();
    expect(footerLink.getAttribute('href')).toBe('https://github.com/2fst4u/gain-observer');
  });

  it('handles hover events on the footer link correctly', () => {
    // Arrange
    render(<ControlPanel />);
    const footerLink = screen.getByRole('link', { name: /View source on GitHub/i });

    // Act - Hover
    fireEvent.mouseOver(footerLink);

    // Assert
    expect(footerLink.style.textDecoration).toBe('underline');

    // Act - Unhover
    fireEvent.mouseOut(footerLink);

    // Assert
    expect(footerLink.style.textDecoration).toBe('none');
  });
});
