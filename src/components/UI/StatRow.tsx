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

export const StatRow: React.FC<StatRowProps> = ({
  label,
  value,
  title,
  valueClassName = '',
  style,
  labelStyle,
  valueStyle,
}) => {
  return (
    <div className="stat" style={style}>
      <span className="stat-label" title={title} style={{ ...labelStyle, ...(title ? { cursor: 'help', textDecoration: 'underline dotted', textDecorationThickness: '1px', textUnderlineOffset: '2px' } : {}) }}>
        {label}
      </span>
      <span className={`stat-value ${valueClassName}`.trim()} style={valueStyle}>
        {value}
      </span>
    </div>
  );
};
