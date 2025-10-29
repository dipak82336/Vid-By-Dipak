
import React from 'react';

export interface TextLayerProps {
    text: string;
    color: string;
    fontSize: number;
}

export const TextLayer: React.FC<TextLayerProps> = (props) => {
  return <div className="w-full text-center whitespace-pre-wrap" style={{ color: props.color, fontSize: `${props.fontSize}px` }}>{props.text}</div>;
};
