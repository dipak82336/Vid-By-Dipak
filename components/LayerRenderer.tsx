import React from 'react';
import type { Layer } from '../types';
import { TextLayer } from './layers/TextLayer';
import { ShapeLayer } from './layers/ShapeLayer';
import { getPropertyValue } from '../utils/interpolation';

export const LayerRenderer: React.FC<{ layer: Layer, frame: number }> = ({ layer, frame }) => {
    if (layer.isVisible === false) return null;

    if (layer.type === 'group') {
        return <>{layer.children?.map(child => <LayerRenderer key={child.id} layer={child} frame={frame} />)}</>;
    }

    if (frame < layer.from || frame >= layer.from + layer.duration) return null;
    const localFrame = frame - layer.from;

    const props = {
        x: getPropertyValue(layer.properties.x, localFrame) as number,
        y: getPropertyValue(layer.properties.y, localFrame) as number,
        opacity: getPropertyValue(layer.properties.opacity, localFrame) as number,
        scale: getPropertyValue(layer.properties.scale, localFrame) as number,
        text: getPropertyValue(layer.properties.text, localFrame) as string,
        color: getPropertyValue(layer.properties.color, localFrame) as string,
        fontSize: getPropertyValue(layer.properties.fontSize, localFrame) as number,
        shape: getPropertyValue(layer.properties.shape, localFrame) as 'rect' | 'circle',
        width: getPropertyValue(layer.properties.width, localFrame) as number,
        height: getPropertyValue(layer.properties.height, localFrame) as number,
    };

    const style: React.CSSProperties = {
        position: 'absolute', top: 0, left: 0,
        opacity: props.opacity,
        transform: `translate(${props.x - (props.width || 0) / 2}px, ${props.y - (props.height || 0) / 2}px) scale(${props.scale})`,
    };

    if (layer.type === 'text') {
        style.transform = `translate(${props.x}px, ${props.y}px) scale(${props.scale}) translate(-50%, -50%)`;
        return <div style={style}><TextLayer text={props.text} color={props.color} fontSize={props.fontSize} /></div>;
    }
    if (layer.type === 'shape') {
        return <div style={style}><ShapeLayer shape={props.shape} color={props.color} width={props.width} height={props.height} /></div>;
    }
    return null;
}