import React from 'react';

export interface StatRowProps {
  label: string;
  value: React.ReactNode;
  title?: string;
  valueClassName?: string;
  valueStyle?: React.CSSProperties;
}

export const StatRow: React.FC<StatRowProps> = ({
  label,
  value,
  title,
  valueClassName = '',
  valueStyle,
}) => {
  return (
    <div className="stat">
      <span className="stat-label" title={title}>
        {label}
      </span>
      <span className={`stat-value ${valueClassName}`.trim()} style={valueStyle}>
        {value}
      </span>
    </div>
  );
};
