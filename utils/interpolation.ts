import type { Keyframe, Property } from '../types';

// Easing functions based on cubic-bezier curves
const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;


export function interpolateKeyframes(keyframes: Keyframe[], frame: number): number {
    if (!keyframes || keyframes.length === 0) return 0;
    if (keyframes.length === 1) return keyframes[0].value;

    if (frame < keyframes[0].frame) return keyframes[0].value;
    if (frame >= keyframes[keyframes.length - 1].frame) return keyframes[keyframes.length - 1].value;
    
    const nextKeyframeIndex = keyframes.findIndex(k => k.frame > frame);
    const prev = keyframes[nextKeyframeIndex - 1];
    const next = keyframes[nextKeyframeIndex];
    
    if (!prev || !next) return 0;
    
    let progress = (frame - prev.frame) / (next.frame - prev.frame);

    // Apply easing based on the PREVIOUS keyframe's interpolation property
    const interpolation = prev.interpolation || 'linear';
    switch (interpolation) {
        case 'ease-in':
            progress = easeIn(progress);
            break;
        case 'ease-out':
            progress = easeOut(progress);
            break;
        case 'ease-in-out':
            progress = easeInOut(progress);
            break;
        case 'linear':
        default:
            // progress remains linear
            break;
    }
    
    // Linear interpolation on the (potentially) eased progress
    return prev.value + (next.value - prev.value) * progress;
}

export function getPropertyValue(property: Property | undefined, frame: number): any {
    if (!property) return undefined;
    if (property.keyframes && property.keyframes.length > 0) {
        return interpolateKeyframes(property.keyframes, frame);
    }
    return property.value;
}