import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { FeedlinePresetSelect } from '../../../../src/components/Panel/Feedline/FeedlinePresetSelect';
import { findFeedlinePreset } from '../../../../src/physics/constants';

describe('FeedlinePresetSelect', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders select with options and preset hint', () => {
    const preset = findFeedlinePreset('rg58');
    const onSelectFeedline = vi.fn();

    render(
      <FeedlinePresetSelect
        feedlineId="rg58"
        preset={preset}
        onSelectFeedline={onSelectFeedline}
      />
    );

    const select = screen.getByRole('combobox', { name: 'Feedline' });
    expect(select).toBeDefined();
    expect((select as HTMLSelectElement).value).toBe('rg58');
    expect(screen.getByText(preset.hint)).toBeDefined();
  });

  it('calls onSelectFeedline when select value changes', () => {
    const preset = findFeedlinePreset('rg58');
    const onSelectFeedline = vi.fn();

    render(
      <FeedlinePresetSelect
        feedlineId="rg58"
        preset={preset}
        onSelectFeedline={onSelectFeedline}
      />
    );

    const select = screen.getByRole('combobox', { name: 'Feedline' });
    fireEvent.change(select, { target: { value: 'none' } });

    expect(onSelectFeedline).toHaveBeenCalledWith('none');
  });
});
