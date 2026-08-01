import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AtuSection } from '../../../../src/components/Panel/Feedline/AtuSection';
// Removed FeedlinePreset mocks as they are no longer used by the component.

describe('AtuSection', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders only the checkbox when atuEnabled is false', () => {
    const setAtuEnabled = vi.fn();
    const setAtuMainFeedlineLength = vi.fn();

    render(
      <AtuSection
        units="metric"
        unit="m"
        mainRunLossDb={0}
        atuEnabled={false}
        atuMainFeedlineLength={10}
        setAtuEnabled={setAtuEnabled}
        setAtuMainFeedlineLength={setAtuMainFeedlineLength}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /atu at the base of the mast/i }) as HTMLInputElement;
    expect(checkbox).toBeDefined();
    expect(checkbox.checked).toBe(false);

    expect(screen.queryByLabelText(/main run, atu/i)).toBeNull();
    expect(screen.queryByText(/matched loss/i)).toBeNull();
    expect(screen.queryByText(/the feedline above becomes the short up-mast run/i)).toBeNull();
  });

  it('calls setAtuEnabled when checkbox is toggled', () => {
    const setAtuEnabled = vi.fn();
    const setAtuMainFeedlineLength = vi.fn();

    render(
      <AtuSection
        units="metric"
        unit="m"
        mainRunLossDb={0}
        atuEnabled={false}
        atuMainFeedlineLength={10}
        setAtuEnabled={setAtuEnabled}
        setAtuMainFeedlineLength={setAtuMainFeedlineLength}
      />
    );

    const checkbox = screen.getByLabelText(/ATU at the base of the mast/i);
    fireEvent.click(checkbox);
    expect(setAtuEnabled).toHaveBeenCalledWith(true);
  });

  it('renders input and hint when atuEnabled is true', () => {
    const setAtuEnabled = vi.fn();
    const setAtuMainFeedlineLength = vi.fn();

    render(
      <AtuSection
        units="metric"
        unit="m"
        mainRunLossDb={2}
        atuEnabled={true}
        atuMainFeedlineLength={50}
        setAtuEnabled={setAtuEnabled}
        setAtuMainFeedlineLength={setAtuMainFeedlineLength}
      />
    );

    const checkbox = screen.getByLabelText(/ATU at the base of the mast/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    const input = screen.getByRole('spinbutton', { name: /main run, atu → shack \(m\)/i }) as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('50.00'); // 50m in display value may be 50 if metric

    // Frequency = 16, sqrt(16) = 4
    // lossK1 = 1, lossK2 = 0 => lossPer100m = 4
    // length = 50 => length/100 = 0.5
    // loss = 4 * 0.5 = 2.00
    expect(screen.getByText(/matched loss 2\.00 db/i)).toBeDefined();

    // The explanatory hint only appears alongside the input.
    expect(screen.getByText(/the feedline above becomes the short up-mast run/i)).toBeDefined();
  });

  it('labels the length input with the imperial unit when units are imperial', () => {
    render(
      <AtuSection
        units="imperial"
        unit="ft"
        mainRunLossDb={0}
        atuEnabled={true}
        atuMainFeedlineLength={30.48}
        setAtuEnabled={vi.fn()}
        setAtuMainFeedlineLength={vi.fn()}
      />
    );

    // 30.48 m = 100 ft exactly.
    const input = screen.getByRole('spinbutton', { name: /main run, atu → shack \(ft\)/i }) as HTMLInputElement;
    expect(parseFloat(input.value)).toBeCloseTo(100, 2);
  });

  it('calculates 0 loss when preset is none', () => {
    const setAtuEnabled = vi.fn();
    const setAtuMainFeedlineLength = vi.fn();

    render(
      <AtuSection
        units="imperial"
        unit="ft"
        mainRunLossDb={0}
        atuEnabled={true}
        atuMainFeedlineLength={100}
        setAtuEnabled={setAtuEnabled}
        setAtuMainFeedlineLength={setAtuMainFeedlineLength}
      />
    );

    expect(screen.getByText(/matched loss 0\.00 db/i)).toBeDefined();
  });
});
