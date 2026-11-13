import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  lines = 1,
}) => {
  const baseClasses = 'animate-pulse bg-paper-high rounded-sm';

  const style: React.CSSProperties = {
    width: width || (variant === 'circular' ? 40 : '100%'),
    height: height || (variant === 'circular' ? 40 : variant === 'text' ? '1rem' : 100),
  };

  if (variant === 'circular') {
    return <div className={`${baseClasses} rounded-full ${className}`} style={style} />;
  }

  if (variant === 'card') {
    return (
      <div className={`p-4 border border-paper-border rounded-md bg-paper-lowest space-y-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-paper-high animate-pulse shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 bg-paper-high rounded-sm w-1/3 animate-pulse" />
            <div className="h-3 bg-paper-high rounded-sm w-1/4 animate-pulse" />
          </div>
        </div>
        <div className="h-16 bg-paper-high rounded-sm animate-pulse w-full" />
      </div>
    );
  }

  if (lines > 1) {
    return (
      <div className="space-y-2 w-full">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} ${className}`}
            style={{
              ...style,
              width: i === lines - 1 && lines > 1 ? '70%' : style.width,
            }}
          />
        ))}
      </div>
    );
  }

  return <div className={`${baseClasses} ${className}`} style={style} />;
};
