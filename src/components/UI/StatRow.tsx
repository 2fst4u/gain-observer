import type { ReactNode, CSSProperties, FC } from 'react';

interface StatRowProps {
  label: ReactNode;
  value: ReactNode;
  title?: string;
  valueClassName?: string;
  style?: CSSProperties;
  labelStyle?: CSSProperties;
  valueStyle?: CSSProperties;
}

export const StatRow: FC<StatRowProps> = ({
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
      <span className="stat-label" title={title} style={labelStyle}>
        {label}
      </span>
      <span className={`stat-value ${valueClassName}`.trim()} style={valueStyle}>
        {value}
      </span>
    </div>
  );
};
