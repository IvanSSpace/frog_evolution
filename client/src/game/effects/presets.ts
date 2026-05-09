import type { NebulaPreset } from './NebulaBackground'

export const violetRing: NebulaPreset = {
  version: 4,
  seed: 851572,
  resolution: 2048,
  params: {
    count: 40,
    size: 90,
    vary: 0.6,
    bright: 1.05,
    detail: 6,
    contrast: 3,
    edge: 1.6,
  },
  colors: {
    custom: false,
    palette: 'dual',
    col1: '#9d4edd',
    col2: '#5a189a',
    col3: '#e0aaff',
  },
  effects: {
    breathe: { enabled: true, speed: 0.35, depth: 0.04 },
    drift: { enabled: false, speed: 0.8, depth: 0 },
    swirl: { enabled: false, speed: 1, depth: 0 },
    flow: { enabled: true, speed: 0.2, depth: 0, reverse: true },
    twinkle: { enabled: true, speed: 0.7, depth: 0.28 },
    wobble: { enabled: false, speed: 1, depth: 0.12 },
    pulse: { enabled: false, speed: 1, depth: 0.4 },
    shimmer: { enabled: true, speed: 0.45, depth: 0.14 },
    zoom: { enabled: false, speed: 1, depth: 0.08 },
  },
  layout: {
    mode: 'ring',
    ringR: 0.46,
    ringW: 0.13,
    ringScatter: 0,
  },
  blackHole: {
    enabled: true,
    type: 'maelstrom',
    size: 0.035,
    strength: 0.8,
    speed: 0.05,
  },
}
