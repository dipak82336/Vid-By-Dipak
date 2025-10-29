
export interface Keyframe {
    frame: number;
    value: number;
    interpolation?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface Property {
    value?: any;
    keyframes?: Keyframe[];
}

export interface Layer {
    id: string;
    name: string;
    type: 'text' | 'shape' | 'group';
    from: number;
    duration: number;
    isVisible?: boolean;
    isLocked?: boolean;
    children?: Layer[];
    properties: {
        x?: Property;
        y?: Property;
        opacity?: Property;
        scale?: Property;
        text?: Property;
        color?: Property;
        fontSize?: Property;
        shape?: Property;
        width?: Property;
        height?: Property;
    };
}

export interface Composition {
    id: string;
    name: string;
    durationInFrames: number;
    fps: number;
    layers: Layer[];
}