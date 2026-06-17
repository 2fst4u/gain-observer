import React from 'react';

export interface StatRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  title?: string;
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  valueStyle?: React.CSSProperties;
  valueClassName?: string;
}

export function StatRow({ label, value, title, style, labelStyle, valueStyle, valueClassName }: StatRowProps) {
  return (
    <div className="stat" style={style}>
      <span className="stat-label" title={title} style={labelStyle}>
        {label}
      </span>
      <span className={`stat-value ${valueClassName || ''}`.trim()} style={valueStyle}>
        {value}
      </span>
    </div>
  );
}
