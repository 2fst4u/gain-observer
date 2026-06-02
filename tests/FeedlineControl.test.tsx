import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FeedlineControl } from '../src/components/Panel/FeedlineControl';
import { useAntennaStore } from '../src/store/antennaStore';

describe('FeedlineControl', () => {
  beforeEach(() => {
    useAntennaStore.setState({
      units: 'metric',
      feedlineId: 'rg58',
      feedlineOffset: 1.0,
      length: 20.0,
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
});
