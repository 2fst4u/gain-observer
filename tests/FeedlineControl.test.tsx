import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FeedlineControl } from '../src/components/Panel/FeedlineControl';
import { useAntennaStore } from '../src/store/antennaStore';

describe('FeedlineControl', () => {
  beforeEach(() => {
    useAntennaStore.setState({
      units: 'metric',
      antennaType: 'dipole',
      feedlineId: 'rg58',
      feedlineOffset: 1.0,
      length: 20.0,
      atuEnabled: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the Centre button when feedline is enabled', () => {
    render(<FeedlineControl />);
    const centreButton = screen.getByRole('button', { name: 'Centre feedpoint offset' });
    expect(centreButton).toBeDefined();
    expect(centreButton.textContent).toBe('Centre');
  });

  it('resets feedline offset to 0 when Centre button is clicked', () => {
    render(<FeedlineControl />);
    const centreButton = screen.getByRole('button', { name: 'Centre feedpoint offset' });

    fireEvent.click(centreButton);

    expect(useAntennaStore.getState().feedlineOffset).toBe(0);
  });

  it('does not render feedline length and offset when cable is "none"', () => {
    useAntennaStore.setState({ feedlineId: 'none' });
    render(<FeedlineControl />);

    expect(screen.queryByLabelText(/Length/)).toBeNull();
    expect(screen.queryByLabelText(/Attachment offset/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Centre feedpoint offset' })).toBeNull();
  });

  it('shows the ATU toggle and reveals the main-run length only when enabled', () => {
    useAntennaStore.setState({ atuEnabled: false });
    const { rerender } = render(<FeedlineControl />);

    const toggle = screen.getByLabelText('ATU at the base of the mast') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(screen.queryByLabelText(/Main run/)).toBeNull();

    fireEvent.click(toggle);
    expect(useAntennaStore.getState().atuEnabled).toBe(true);

    rerender(<FeedlineControl />);
    expect(screen.getByLabelText(/Main run/)).toBeDefined();
  });

  it('hides the ATU controls entirely when cable is "none"', () => {
    useAntennaStore.setState({ feedlineId: 'none', atuEnabled: true });
    render(<FeedlineControl />);
    expect(screen.queryByLabelText('ATU at the base of the mast')).toBeNull();
  });

  it('updates the main-run length and clamps to the 0–300 m range', () => {
    useAntennaStore.setState({ atuEnabled: true, atuMainFeedlineLength: 50 });
    render(<FeedlineControl />);

    const input = screen.getByLabelText(/Main run/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '80' } });
    expect(useAntennaStore.getState().atuMainFeedlineLength).toBe(80);

    useAntennaStore.getState().setAtuMainFeedlineLength(9999);
    expect(useAntennaStore.getState().atuMainFeedlineLength).toBe(300);
  });

  it('changes the cable preset when the select changes', () => {
    render(<FeedlineControl />);
    // Select the label specifically for the Cable select menu,
    // which we just updated to "Feedline" in FeedlineControl.tsx
    const select = screen.getByRole('combobox', { name: 'Feedline' });

    fireEvent.change(select, { target: { value: 'none' } });

    expect(useAntennaStore.getState().feedlineId).toBe('none');
  });

  it('updates the feedline length and snaps back to the store value on blur', () => {
    useAntennaStore.setState({ feedlineLength: 10 });
    render(<FeedlineControl />);

    const input = screen.getByLabelText(/^Length/) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '25' } });
    expect(useAntennaStore.getState().feedlineLength).toBe(25);
    expect(input.value).toBe('25');

    // Store now reports 25; blurring re-renders the canonical formatted value.
    fireEvent.blur(input);
    expect(input.value).toBe('25.00');
  });

  it('ignores a non-numeric feedline length entry', () => {
    useAntennaStore.setState({ feedlineLength: 10 });
    render(<FeedlineControl />);

    const input = screen.getByLabelText(/^Length/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'xyz' } });

    expect(useAntennaStore.getState().feedlineLength).toBe(10);
  });

  it('updates the feedline offset via the slider for a dipole', () => {
    useAntennaStore.setState({ antennaType: 'dipole', length: 20, feedlineOffset: 0 });
    render(<FeedlineControl />);

    const slider = screen.getByLabelText('Feedline attachment offset') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '3' } });

    expect(useAntennaStore.getState().feedlineOffset).toBe(3);
    expect(screen.getByText(/common-mode current will flow on the shield/i)).toBeDefined();
  });

  it('shows the centred hint when the offset is zero', () => {
    useAntennaStore.setState({ antennaType: 'dipole', length: 20, feedlineOffset: 0 });
    render(<FeedlineControl />);

    expect(screen.getByText(/no common-mode current/i)).toBeDefined();
    const centre = screen.getByRole('button', { name: 'Centre feedpoint offset' }) as HTMLButtonElement;
    expect(centre.disabled).toBe(true);
  });

  it('does not render the offset slider for non-dipole antennas', () => {
    useAntennaStore.setState({ antennaType: 'delta-loop' });
    render(<FeedlineControl />);

    expect(screen.queryByLabelText('Feedline attachment offset')).toBeNull();
  });

  it('returns null for an unsupported antenna type (e.g. vertical-whip)', () => {
    useAntennaStore.setState({ antennaType: 'vertical-whip' });
    const { container } = render(<FeedlineControl />);

    expect(container.querySelector('.panel-section')).toBeNull();
  });

  it('keeps the main-run field focused value, then resets it on blur', () => {
    useAntennaStore.setState({ atuEnabled: true, atuMainFeedlineLength: 50 });
    render(<FeedlineControl />);

    const input = screen.getByLabelText(/Main run/) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '120' } });
    expect(useAntennaStore.getState().atuMainFeedlineLength).toBe(120);

    fireEvent.blur(input);
    expect(input.value).toBe('120.00');
  });
});
