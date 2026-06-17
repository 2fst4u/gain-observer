import type { CSSProperties, ReactNode } from 'react';

export interface StatRowProps {
  label: ReactNode;
  value: ReactNode;
  title?: string;
  labelClassName?: string;
  valueClassName?: string;
  style?: CSSProperties;
  labelStyle?: CSSProperties;
  valueStyle?: CSSProperties;
}

export function StatRow({
  label,
  value,
  title,
  labelClassName = 'stat-label',
  valueClassName = 'stat-value',
  style,
  labelStyle,
  valueStyle,
}: StatRowProps) {
  return (
    <div className="stat" style={style} title={title}>
      <span className={labelClassName} style={labelStyle}>
        {label}
      </span>
      <span className={valueClassName} style={valueStyle}>
        {value}
      </span>
    </div>
  );
}
