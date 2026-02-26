import React from 'react';

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  layoutType: 'grid' | 'vertical' | 'mosaic' | 'custom';
  slots: number;
  frameUrl?: string;
  dynamicStyle?: React.CSSProperties;
}

export const TEMPLATES: Template[] = [
  {
    id: 'classic-2x2',
    name: 'Classic 2x2',
    description: '4 High-res photos, 6x4 format',
    thumbnailUrl: 'https://picsum.photos/seed/classic/400/600',
    layoutType: 'grid',
    slots: 4,
  },
  {
    id: 'vertical-trio',
    name: 'Vertical Trio',
    description: '3 Large photos, vertical strip',
    thumbnailUrl: 'https://picsum.photos/seed/trio/400/600',
    layoutType: 'vertical',
    slots: 3,
  },
  {
    id: 'modern-quad',
    name: 'Modern Quad',
    description: 'Recommended for Birthdays',
    thumbnailUrl: 'https://picsum.photos/seed/quad/400/600',
    layoutType: 'grid',
    slots: 4,
  },
  {
    id: 'film-strip',
    name: 'Film Strip',
    description: 'Vintage sprocket style edges',
    thumbnailUrl: 'https://picsum.photos/seed/film/400/600',
    layoutType: 'vertical',
    slots: 4,
  },
  {
    id: 'polaroid-stack',
    name: 'Polaroid Stack',
    description: 'Candid offset arrangement',
    thumbnailUrl: 'https://picsum.photos/seed/polaroid/400/600',
    layoutType: 'mosaic',
    slots: 3,
  },
  {
    id: 'mosaic',
    name: 'Mosaic',
    description: 'Multi-sized grid for group shots',
    thumbnailUrl: 'https://picsum.photos/seed/mosaic/400/600',
    layoutType: 'mosaic',
    slots: 5,
  },
];
