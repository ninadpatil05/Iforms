import React, { useMemo } from 'react';
import { CornerBrackets } from './CornerBrackets';

interface MetricCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  index: number;
  className?: string;
}

function Sparkline({ seed = 1 }: { seed?: number }) {
  const pts = useMemo(() => {
    let v = 8 + (seed * 3) % 6;
    return Array.from({ length: 10 }, () => {
      v = Math.max(2, Math.min(20, v + Math.sin(v * seed) * 4));
      return v;
    });
  }, [seed]);

  const w = 90, h = 24;
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * w},${h - p}`).join(' ');

  return (
    <svg width={w} height={h} className="block">
      <path d={path} fill="none" stroke="var(--color-cyan)" strokeWidth="1.5" opacity="0.85" />
    </svg>
  );
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  suffix = '',
  index,
  className = '',
}) => {
  return (
    <div
      className={`relative bg-white border border-ink/25 p-4 sm:p-5 overflow-hidden text-ink ${className}`}
    >
      <CornerBrackets />
      <div className="font-mono text-[10.5px] text-slate tracking-wider mb-2.5">
        {String(index).padStart(2, '0')} · {label.toUpperCase()}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="font-mono text-3xl font-bold text-ink">
          {value}
          <span className="text-base text-cyan-dark">{suffix}</span>
        </div>
        <Sparkline seed={index} />
      </div>
    </div>
  );
};
