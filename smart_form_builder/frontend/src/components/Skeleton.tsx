import React from 'react';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  count = 1,
}) => {
  const variantStyles = {
    text: 'h-4 w-full rounded-[4px]',
    circular: 'rounded-full',
    rectangular: 'rounded-[6px]',
    card: 'rounded-[10px] h-32 w-full',
  };

  const style: React.CSSProperties = {
    width: width,
    height: height,
  };

  const items = Array.from({ length: count });

  return (
    <>
      {items.map((_, idx) => (
        <div
          key={idx}
          style={style}
          className={`animate-pulse bg-[#E8E2D8] dark:bg-[#2C2721] ${variantStyles[variant]} ${className}`}
        />
      ))}
    </>
  );
};

export default Skeleton;
