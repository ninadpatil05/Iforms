import React from 'react';

interface CornerBracketsProps {
  active?: boolean;
  size?: number;
}

export const CornerBrackets: React.FC<CornerBracketsProps> = ({ active = false, size = 10 }) => {
  const strokeColor = active ? 'var(--color-cyan)' : 'var(--color-slate-light)';
  const opacity = active ? '1' : '0.5';
  const s = { position: 'absolute' as const, width: size, height: size, pointerEvents: 'none' as const, opacity };

  return (
    <>
      <svg style={{ ...s, top: -1, left: -1 }} viewBox="0 0 10 10">
        <path d="M0 5 V0 H5" stroke={strokeColor} strokeWidth="1.5" fill="none" />
      </svg>
      <svg style={{ ...s, top: -1, right: -1 }} viewBox="0 0 10 10">
        <path d="M5 0 H10 V5" stroke={strokeColor} strokeWidth="1.5" fill="none" />
      </svg>
      <svg style={{ ...s, bottom: -1, left: -1 }} viewBox="0 0 10 10">
        <path d="M0 5 V10 H5" stroke={strokeColor} strokeWidth="1.5" fill="none" />
      </svg>
      <svg style={{ ...s, bottom: -1, right: -1 }} viewBox="0 0 10 10">
        <path d="M5 10 H10 V5" stroke={strokeColor} strokeWidth="1.5" fill="none" />
      </svg>
    </>
  );
};
