import type { NebulaPreset } from './NebulaBackground'

export const violetRing: NebulaPreset = {
  version: 4,
  seed: 851572,
  resolution: 2048,
  params: {
    // count: 12 (раньше 20, изначально 40), detail: 3 (раньше 4) — для static
    // RtT режима шейдер запускается один раз, но даже единственный bake долгий
    // на mobile. Меньше blob/octave = быстрее bake, меньше memory pressure.
    count: 12,
    size: 130,
    vary: 0.6,
    bright: 1.1,
    detail: 3,
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
  // Все эффекты отключены — статичная туманность, GLSL компилятор выкидывает
  // time-зависимые ветви через dead-code elimination. Помогает на mobile WebView
  // где fragment shader был основным боттлнеком (см. план оптимизации StarMap).
  effects: {
    breathe: { enabled: false, speed: 0.35, depth: 0.04 },
    drift: { enabled: false, speed: 0.8, depth: 0 },
    swirl: { enabled: false, speed: 1, depth: 0 },
    flow: { enabled: false, speed: 0.2, depth: 0, reverse: true },
    twinkle: { enabled: false, speed: 0.7, depth: 0.28 },
    wobble: { enabled: false, speed: 1, depth: 0.12 },
    pulse: { enabled: false, speed: 1, depth: 0.4 },
    shimmer: { enabled: false, speed: 0.45, depth: 0.14 },
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
    speed: 0, // 0 = чёрная дыра тоже статична, спирали не вращаются
  },
}
