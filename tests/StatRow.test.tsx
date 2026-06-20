import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatRow } from '../src/components/UI/StatRow';
import React from 'react';

describe('StatRow', () => {
  it('renders label and value', () => {
    render(<StatRow label="Frequency" value="14.200 MHz" />);
    expect(screen.getByText('Frequency')).toBeTruthy();
    expect(screen.getByText('14.200 MHz')).toBeTruthy();
  });

  it('applies title attribute to the label span', () => {
    render(
      <StatRow label="SWR" value="1.5" title="Standing Wave Ratio" />
    );
    const labelSpan = screen.getByText('SWR');
    expect(labelSpan.getAttribute('title')).toBe('Standing Wave Ratio');
  });

  it('applies valueClassName to the value span', () => {
    render(
      <StatRow label="Gain" value="2.15 dBi" valueClassName="highlight" />
    );
    const valueSpan = screen.getByText('2.15 dBi');
    expect(valueSpan.classList.contains('stat-value')).toBe(true);
    expect(valueSpan.classList.contains('highlight')).toBe(true);
  });

  it('applies style, labelStyle, and valueStyle appropriately', () => {
    render(
      <StatRow
        label="Power"
        value="100 W"
        style={{ marginTop: '10px' }}
        labelStyle={{ fontWeight: 'bold' }}
        valueStyle={{ color: 'red' }}
      />
    );

    const wrapper = screen.getByText('Power').parentElement;
    expect(wrapper?.style.marginTop).toBe('10px');

    const labelSpan = screen.getByText('Power');
    expect(labelSpan.style.fontWeight).toBe('bold');

    const valueSpan = screen.getByText('100 W');
    expect(valueSpan.style.color).toBe('red');
  });

  it('renders correctly without valueClassName (trim check)', () => {
    render(
      <StatRow label="Loss" value="0.5 dB" />
    );
    const valueSpan = screen.getByText('0.5 dB');
    expect(valueSpan.className).toBe('stat-value');
  });
});
