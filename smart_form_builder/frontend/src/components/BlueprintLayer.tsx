import React from 'react';

interface BlueprintLayerProps {
  dense?: boolean;
}

export const BlueprintLayer: React.FC<BlueprintLayerProps> = ({ dense = false }) => {
  return (
    <div
      aria-hidden="true"
      className={dense ? 'bp-grid-dense' : 'bp-grid'}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};
