import React from 'react';

export interface StatRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
  title?: string;
  valueClassName?: string;
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  valueStyle?: React.CSSProperties;
}

export function StatRow({
  label,
  value,
  title,
  valueClassName = 'stat-value',
  style,
  labelStyle,
  valueStyle,
}: StatRowProps) {
  return (
    <div className="stat" style={style} title={title}>
      <span className="stat-label" style={labelStyle}>
        {label}
      </span>
      <span className={valueClassName} style={valueStyle}>
        {value}
      </span>
    </div>
  );
}
