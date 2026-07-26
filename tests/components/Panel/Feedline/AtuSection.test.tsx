import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AtuSection } from '../../../../src/components/Panel/Feedline/AtuSection';
import type { FeedlinePreset } from '../../../../src/physics/constants';

const nonePreset: FeedlinePreset = {
  id: 'none',
  label: 'No feedline',
  z0: 0,
  velocityFactor: 1,
  lossK1: 0,
  lossK2: 0,
};

const rg8Preset: FeedlinePreset = {
  id: 'rg8',
  label: 'RG-8',
  z0: 50,
  velocityFactor: 0.82,
  // Using simple values to make math easy:
  // lossPer100m = 1 * sqrt(16) + 0 * 16 = 4.
  // if length is 50m, loss = 4 * 0.5 = 2.
  lossK1: 1,
  lossK2: 0,
};

describe('AtuSection', () => {
  it('renders only the checkbox when atuEnabled is false', () => {
    const setAtuEnabled = vi.fn();
    const setAtuMainFeedlineLength = vi.fn();

    render(
      <AtuSection
        units="metric"
        unit="m"
        frequency={14}
        preset={nonePreset}
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
  });

  it('calls setAtuEnabled when checkbox is toggled', () => {
    cleanup();
    const setAtuEnabled = vi.fn();
    const setAtuMainFeedlineLength = vi.fn();

    render(
      <AtuSection
        units="metric"
        unit="m"
        frequency={14}
        preset={nonePreset}
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
    cleanup();
    const setAtuEnabled = vi.fn();
    const setAtuMainFeedlineLength = vi.fn();

    render(
      <AtuSection
        units="metric"
        unit="m"
        frequency={16}
        preset={rg8Preset}
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
  });

  it('calculates 0 loss when preset is none', () => {
    cleanup();
    const setAtuEnabled = vi.fn();
    const setAtuMainFeedlineLength = vi.fn();

    render(
      <AtuSection
        units="imperial"
        unit="ft"
        frequency={14}
        preset={nonePreset}
        atuEnabled={true}
        atuMainFeedlineLength={100}
        setAtuEnabled={setAtuEnabled}
        setAtuMainFeedlineLength={setAtuMainFeedlineLength}
      />
    );

    expect(screen.getByText(/matched loss 0\.00 db/i)).toBeDefined();
  });
});
