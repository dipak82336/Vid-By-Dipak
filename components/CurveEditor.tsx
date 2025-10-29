import React from 'react';
import type { Keyframe } from '../types';

interface CurveEditorProps {
    keyframes: Keyframe[];
    width: number;
    height: number;
}

// Map of easing types to their cubic-bezier control points (for a 0-1 range)
const CUBIC_BEZIER_MAP: Record<string, { p1: { x: number; y: number; }; p2: { x: number; y: number; }; }> = {
    'ease-in':     { p1: { x: 0.42, y: 0.0 }, p2: { x: 1.0, y: 1.0 } },
    'ease-out':    { p1: { x: 0.0, y: 0.0 }, p2: { x: 0.58, y: 1.0 } },
    'ease-in-out': { p1: { x: 0.42, y: 0.0 }, p2: { x: 0.58, y: 1.0 } },
};

export const CurveEditor: React.FC<CurveEditorProps> = ({ keyframes, width, height }) => {
    if (keyframes.length < 2) {
        return (
            <div className="flex items-center justify-center text-xs text-gray-500 text-center rounded-md border border-gray-700 bg-gray-800" style={{ width, height }}>
                2+ keyframes needed to draw a curve.
            </div>
        );
    }

    const minFrame = keyframes[0].frame;
    const maxFrame = keyframes[keyframes.length - 1].frame;
    const frameSpan = maxFrame - minFrame;

    const values = keyframes.map(kf => kf.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueSpan = maxValue - minValue;

    const normalize = (frame: number, value: number) => {
        const x = frameSpan === 0 ? width / 2 : ((frame - minFrame) / frameSpan) * width;
        const y = valueSpan === 0 ? height / 2 : (1 - (value - minValue) / valueSpan) * height;
        return { x, y };
    };

    const points = keyframes.map(kf => ({ ...kf, ...normalize(kf.frame, kf.value) }));
    
    const pathSegments = [];
    for (let i = 0; i < points.length - 1; i++) {
        const startPoint = points[i];
        const endPoint = points[i+1];
        const interpolation = startPoint.interpolation || 'linear';

        if (interpolation === 'linear' || !CUBIC_BEZIER_MAP[interpolation]) {
            pathSegments.push(`L ${endPoint.x.toFixed(2)} ${endPoint.y.toFixed(2)}`);
        } else {
            const bezier = CUBIC_BEZIER_MAP[interpolation];
            const p1 = {
                x: startPoint.x + (endPoint.x - startPoint.x) * bezier.p1.x,
                y: startPoint.y + (endPoint.y - startPoint.y) * bezier.p1.y,
            };
            const p2 = {
                x: startPoint.x + (endPoint.x - startPoint.x) * bezier.p2.x,
                y: startPoint.y + (endPoint.y - startPoint.y) * bezier.p2.y,
            };
            pathSegments.push(`C ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}, ${endPoint.x.toFixed(2)} ${endPoint.y.toFixed(2)}`);
        }
    }
    const pathData = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} ${pathSegments.join(' ')}`;

    return (
        <svg width={width} height={height} className="bg-gray-800/50 rounded-md border border-gray-700">
            <path d={pathData} stroke="#3498db" strokeWidth="1.5" fill="none" />
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="#f1c40f" stroke="#c29d0b" strokeWidth="1" />
            ))}
        </svg>
    );
};
