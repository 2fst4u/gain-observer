import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AtuSection } from '../../../../src/components/Panel/Feedline/AtuSection';
import { FEEDLINE_PRESETS } from '../../../../src/physics/constants';

describe('AtuSection', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    units: 'metric' as const,
    unit: 'm',
    frequency: 14.2,
    preset: FEEDLINE_PRESETS.find(p => p.id === 'rg58') || FEEDLINE_PRESETS[1], // Assuming index 1 is valid like rg58, fallback
    atuEnabled: false,
    atuMainFeedlineLength: 10,
    setAtuEnabled: vi.fn(),
    setAtuMainFeedlineLength: vi.fn(),
  };

  it('renders checkbox and label', () => {
    render(<AtuSection {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox', { name: /ATU at the base of the mast/i });
    expect(checkbox).toBeDefined();
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  it('calls setAtuEnabled when checkbox is toggled', () => {
    render(<AtuSection {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox', { name: /ATU at the base of the mast/i });
    fireEvent.click(checkbox);

    expect(defaultProps.setAtuEnabled).toHaveBeenCalledWith(true);
  });

  it('does not render SyncedLengthInput or hint when atuEnabled is false', () => {
    render(<AtuSection {...defaultProps} />);

    // Query for text that is inside SyncedLengthInput
    expect(screen.queryByLabelText(/Main run, ATU → shack/i)).toBeNull();
    // Query for text in the hint
    expect(screen.queryByText(/The feedline above becomes the short up-mast run/i)).toBeNull();
  });

  it('renders SyncedLengthInput and hint when atuEnabled is true', () => {
    render(<AtuSection {...defaultProps} atuEnabled={true} />);

    // SyncedLengthInput label
    expect(screen.getByLabelText(/Main run, ATU → shack \(m\)/i)).toBeDefined();

    // Hint text
    expect(screen.getByText(/The feedline above becomes the short up-mast run/i)).toBeDefined();
  });

  it('calculates matched loss and includes it in hint if preset is not none', () => {
    render(<AtuSection {...defaultProps} atuEnabled={true} />);

    // We can't easily know exact loss value without replicating logic,
    // but we can check if it says something like "matched loss X.XX dB"
    const hintText = screen.getByText(/matched loss \d+\.\d{2} dB/i);
    expect(hintText).toBeDefined();
  });

  it('calculates matched loss as 0.00 dB if preset is none', () => {
    const nonePreset = FEEDLINE_PRESETS.find(p => p.id === 'none');
    if (!nonePreset) throw new Error("Could not find none preset");

    render(<AtuSection {...defaultProps} atuEnabled={true} preset={nonePreset} />);

    // If preset is none, matched loss should be 0.00 dB
    const hintText = screen.getByText(/matched loss 0\.00 dB/i);
    expect(hintText).toBeDefined();
  });
});
