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
    const footerLink = screen.getByRole('link', { name: /Source code on GitHub/i });

    // Assert
    expect(heading).toBeTruthy();
    expect(footerLink).toBeTruthy();
    expect(footerLink.getAttribute('href')).toBe('https://github.com/2fst4u/gain-observer');
  });

  it('handles hover events on the footer link correctly', () => {
    // Arrange
    render(<ControlPanel />);
    const footerLink = screen.getByRole('link', { name: /Source code on GitHub/i });

    // Act - Hover
    fireEvent.mouseOver(footerLink);

    // Assert
    expect(footerLink.style.textDecoration).toBe('underline');

    // Act - Unhover
    fireEvent.mouseOut(footerLink);

    // Assert
    expect(footerLink.style.textDecoration).toBe('none');
  });

  it('renders inside an aside container with app-controls class and shows NEC-2 subtitle', () => {
    // Arrange
    const { container } = render(<ControlPanel />);

    // Assert
    const aside = container.querySelector('aside.app-controls');
    expect(aside).toBeTruthy();

    const subtitle = screen.getByText(/NEC-2 · WebAssembly/i);
    expect(subtitle).toBeTruthy();
  });

  it('renders integrated child control components', () => {
    // Arrange
    render(<ControlPanel />);

    // Assert - check key subcomponent elements are rendered in the panel
    expect(screen.getByLabelText(/Frequency in MHz/i)).toBeTruthy();
    expect(screen.getByRole('group', { name: /Amateur Radio Bands/i })).toBeTruthy();
    expect(screen.getByRole('group', { name: /Unit system/i })).toBeTruthy();
  });
});
