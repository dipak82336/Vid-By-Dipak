
import React from 'react';

export interface ShapeLayerProps {
    shape: 'rect' | 'circle';
    color: string;
    width: number;
    height: number;
    borderRadius?: number;
}

export const ShapeLayer: React.FC<ShapeLayerProps> = (props) => {
  return <div style={{
      backgroundColor: props.color,
      width: props.width,
      height: props.height,
      borderRadius: props.shape === 'circle' ? '50%' : `${props.borderRadius || 0}px`
  }} />;
};
