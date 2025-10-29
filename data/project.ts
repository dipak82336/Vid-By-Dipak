
import type { Composition } from '../types';

export const projectData: Composition[] = [
    {
        id: 'MainScene',
        name: 'Main Scene',
        durationInFrames: 180,
        fps: 30,
        layers: [
            {
                id: 'bg-shape', name: 'Background', type: 'shape', from: 0, duration: 180,
                isVisible: true, isLocked: false,
                properties: {
                    x: { value: 960 }, y: { value: 540 }, opacity: { value: 1 }, scale: { value: 1 },
                    shape: { value: 'rect' }, color: { value: '#ecf0f1' }, width: { value: 1920 }, height: { value: 1080 },
                }
            },
            {
                id: 'title-group', name: 'Titles', type: 'group', from: 0, duration: 0,
                isVisible: true, isLocked: false,
                properties: {},
                children: [
                    {
                        id: 'title-text', name: 'Main Title', type: 'text', from: 15, duration: 150,
                        isVisible: true, isLocked: false,
                        properties: {
                            x: { value: 960 }, y: { value: 450 }, scale: { value: 1 },
                            opacity: { keyframes: [{ frame: 0, value: 0 }, { frame: 30, value: 1 }, { frame: 120, value: 1 }, { frame: 150, value: 0 }] },
                            text: { value: 'It Finally Works!' }, color: { value: '#2c3e50' }, fontSize: { value: 120 },
                        }
                    },
                    {
                        id: 'subtitle-text', name: 'Subtitle', type: 'text', from: 45, duration: 120,
                        isVisible: true, isLocked: false,
                        properties: {
                            x: { value: 960 }, y: { value: 600 }, scale: { value: 1 },
                            opacity: { keyframes: [{ frame: 0, value: 0 }, { frame: 30, value: 1 }, { frame: 90, value: 1 }, { frame: 120, value: 0 }] },
                            text: { value: 'With Editable Properties & Keyframes' }, color: { value: '#3498db' }, fontSize: { value: 60 },
                        }
                    }
                ]
            }
        ],
    },
    {
        id: 'SecondComp',
        name: 'Second Composition',
        durationInFrames: 120,
        fps: 30,
        layers: [
            { id: 'shape-1', name: 'Blue Square', type: 'shape', from: 0, duration: 120,
                isVisible: true, isLocked: false,
                properties: {
                    x: { value: 960 }, y: { value: 540 }, scale: { keyframes: [{ frame: 0, value: 0 }, { frame: 30, value: 1 }] }, opacity: { value: 1 },
                    shape: { value: 'rect' }, color: { value: '#3498db' }, width: { value: 300 }, height: { value: 300 },
                }
            }
        ]
    }
];