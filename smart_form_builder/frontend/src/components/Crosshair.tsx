import React from 'react';

interface CrosshairProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Crosshair: React.FC<CrosshairProps> = ({ size = 10, className = '', style }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <line x1="0" y1="5" x2="10" y2="5" stroke="var(--color-cyan)" strokeWidth="1" />
      <line x1="5" y1="0" x2="5" y2="10" stroke="var(--color-cyan)" strokeWidth="1" />
    </svg>
  );
};
