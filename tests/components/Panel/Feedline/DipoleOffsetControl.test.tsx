import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DipoleOffsetControl } from '../../../../src/components/Panel/Feedline/DipoleOffsetControl';

describe('DipoleOffsetControl', () => {
  it('renders centred state correctly', () => {
    cleanup();
    render(
      <DipoleOffsetControl
        units="metric"
        unit="m"
        dipoleLength={10}
        feedlineOffset={0}
        setFeedlineOffset={() => {}}
      />
    );

    expect(screen.getByText('Attachment offset from centre (m) — 0.00')).toBeDefined();
    expect(screen.getByText('Centred (perfectly balanced — no common-mode current).')).toBeDefined();

    const centreButton = screen.getByRole('button', { name: 'Centre feedpoint offset' });
    expect(centreButton.getAttribute('aria-disabled')).toBe('true');
  });

  it('renders shifted positive state correctly', () => {
    cleanup();
    render(
      <DipoleOffsetControl
        units="metric"
        unit="m"
        dipoleLength={10}
        feedlineOffset={1.5}
        setFeedlineOffset={() => {}}
      />
    );

    expect(screen.getByText('Attachment offset from centre (m) — 1.50')).toBeDefined();
    expect(screen.getByText('Shifted 1.50 m + axis; common-mode current will flow on the shield.')).toBeDefined();

    const centreButton = screen.getByRole('button', { name: 'Centre feedpoint offset' });
    expect(centreButton.getAttribute('aria-disabled')).toBe('false');
  });

  it('renders shifted negative state correctly', () => {
    cleanup();
    render(
      <DipoleOffsetControl
        units="metric"
        unit="m"
        dipoleLength={10}
        feedlineOffset={-2.25}
        setFeedlineOffset={() => {}}
      />
    );

    expect(screen.getByText('Attachment offset from centre (m) — -2.25')).toBeDefined();
    expect(screen.getByText('Shifted 2.25 m − axis; common-mode current will flow on the shield.')).toBeDefined();
  });

  it('calls setFeedlineOffset when slider changes', () => {
    const setFeedlineOffsetMock = vi.fn();
    cleanup();
    render(
      <DipoleOffsetControl
        units="metric"
        unit="m"
        dipoleLength={10}
        feedlineOffset={0}
        setFeedlineOffset={setFeedlineOffsetMock}
      />
    );

    const slider = screen.getByRole('slider', { name: 'Feedline attachment offset' });
    fireEvent.change(slider, { target: { value: '2.5' } });

    expect(setFeedlineOffsetMock).toHaveBeenCalledWith(2.5);
  });

  it('calls setFeedlineOffset(0) when Centre button is clicked and offset is not 0', () => {
    const setFeedlineOffsetMock = vi.fn();
    cleanup();
    render(
      <DipoleOffsetControl
        units="metric"
        unit="m"
        dipoleLength={10}
        feedlineOffset={1.5}
        setFeedlineOffset={setFeedlineOffsetMock}
      />
    );

    const centreButton = screen.getByRole('button', { name: 'Centre feedpoint offset' });
    fireEvent.click(centreButton);

    expect(setFeedlineOffsetMock).toHaveBeenCalledWith(0);
  });

  it('does not call setFeedlineOffset when Centre button is clicked and already centred', () => {
    const setFeedlineOffsetMock = vi.fn();
    cleanup();
    render(
      <DipoleOffsetControl
        units="metric"
        unit="m"
        dipoleLength={10}
        feedlineOffset={0}
        setFeedlineOffset={setFeedlineOffsetMock}
      />
    );

    const centreButton = screen.getByRole('button', { name: 'Centre feedpoint offset' });
    fireEvent.click(centreButton);

    expect(setFeedlineOffsetMock).not.toHaveBeenCalled();
  });

  it('uses correct step size for metric units', () => {
    cleanup();
    render(
      <DipoleOffsetControl
        units="metric"
        unit="m"
        dipoleLength={10}
        feedlineOffset={0}
        setFeedlineOffset={() => {}}
      />
    );

    const slider = screen.getByRole('slider', { name: 'Feedline attachment offset' });
    expect(slider.getAttribute('step')).toBe('0.05');
  });

  it('uses correct step size for imperial units', () => {
    cleanup();
    render(
      <DipoleOffsetControl
        units="imperial"
        unit="ft"
        dipoleLength={32.8}
        feedlineOffset={0}
        setFeedlineOffset={() => {}}
      />
    );

    const slider = screen.getByRole('slider', { name: 'Feedline attachment offset' });
    expect(slider.getAttribute('step')).toBe('0.25');
  });

  it('ignores NaN slider values safely', () => {
    const setFeedlineOffsetMock = vi.fn();
    cleanup();
    render(
      <DipoleOffsetControl
        units="metric"
        unit="m"
        dipoleLength={10}
        feedlineOffset={0}
        setFeedlineOffset={setFeedlineOffsetMock}
      />
    );

    const slider = screen.getByRole('slider', { name: 'Feedline attachment offset' });
    fireEvent.change(slider, { target: { value: 'invalid' } });

    expect(setFeedlineOffsetMock).not.toHaveBeenCalled();
  });
});
