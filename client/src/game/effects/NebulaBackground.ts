import Phaser from 'phaser'

export type NebulaPalette =
  | 'violet'
  | 'cyan'
  | 'rose'
  | 'emerald'
  | 'amber'
  | 'dual'
export type NebulaLayoutMode = 'random' | 'ring'

export interface EffectConfig {
  enabled: boolean
  speed: number
  depth: number
  reverse?: boolean
}

export interface NebulaPreset {
  version: number
  seed: number
  resolution: number
  params: {
    count: number
    size: number
    vary: number
    bright: number
    detail: number
    contrast: number
    edge: number
  }
  colors: {
    custom: boolean
    palette: NebulaPalette
    col1: string
    col2: string
    col3: string
  }
  effects: {
    breathe: EffectConfig
    drift: EffectConfig
    swirl: EffectConfig
    flow: EffectConfig
    twinkle: EffectConfig
    wobble: EffectConfig
    pulse: EffectConfig
    shimmer: EffectConfig
    zoom: EffectConfig
  }
  layout?: {
    mode: NebulaLayoutMode
    ringR: number
    ringW: number
    ringScatter: number
  }
  blackHole: {
    enabled: boolean
    type: 'maelstrom'
    size: number
    strength: number
    speed: number
  }
}

const MAX_BLOBS = 40

const FRAG = `
precision highp float;
varying vec2 outTexCoord;
uniform vec2 resolution;
uniform float time;
uniform float uDetail;
uniform float uContrast;
uniform float uEdge;

uniform float uBreatheOn;
uniform float uBreatheSpeed;
uniform float uBreatheDepth;
uniform float uDriftOn;
uniform float uDriftSpeed;
uniform float uSwirlOn;
uniform float uSwirlSpeed;
uniform float uFlowOn;
uniform float uFlowSpeed;
uniform float uTwinkleOn;
uniform float uTwinkleSpeed;
uniform float uTwinkleDepth;
uniform float uWobbleOn;
uniform float uWobbleSpeed;
uniform float uWobbleDepth;
uniform float uPulseOn;
uniform float uPulseSpeed;
uniform float uPulseDepth;
uniform float uShimmerOn;
uniform float uShimmerSpeed;
uniform float uShimmerDepth;
uniform float uZoomOn;
uniform float uZoomSpeed;
uniform float uZoomDepth;

uniform float uFlowDir;
uniform float uBHOn;
uniform float uBHSize;
uniform float uBHStrength;
uniform float uBHSpeed;

uniform int uBlobCount;
#define MAX_BLOBS 40
uniform vec4 uBlobPos[MAX_BLOBS];
uniform vec4 uBlobCol[MAX_BLOBS];
uniform vec4 uBlobAnim[MAX_BLOBS];

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 6; i++) {
    v += amp * noise(p);
    p = p * 2.13 + vec2(1.7, 9.3);
    amp *= 0.52;
  }
  return v;
}

void main() {
  vec2 fragPos = outTexCoord * resolution;
  vec3 acc = vec3(0.005, 0.005, 0.012);
  float minDim = min(resolution.x, resolution.y);

  // === ЧЁРНАЯ ДЫРА: искажение пространства ===
  vec2 bhCenter = resolution * 0.5;
  float bhR = uBHSize * minDim * 0.5;
  vec2 sampledPos = fragPos;
  if (uBHOn > 0.5) {
    vec2 toBH = bhCenter - fragPos;
    float dist = length(toBH);
    if (dist > 0.01) {
      vec2 dir = toBH / dist;
      vec2 tangentBH = vec2(-dir.y, dir.x);
      float infl = bhR * 8.0;
      if (dist < infl) {
        float t01 = 1.0 - clamp(dist / infl, 0.0, 1.0);
        float spin = pow(t01, 1.2) * uBHStrength * 2.5;
        float pull = pow(t01, 1.8) * uBHStrength * 1.0;
        sampledPos += tangentBH * spin * dist * 0.8;
        sampledPos += dir * pull * dist * 0.7;
      }
    }
  }

  // глобальный пульс и зум — как было
  float globalPulse = 1.0;
  if (uPulseOn > 0.5) {
    float pt = time * uPulseSpeed;
    globalPulse = 1.0 + uPulseDepth * pow(0.5 + 0.5 * sin(pt * 2.0), 4.0);
  }
  vec2 zoomedPos = sampledPos;
  if (uZoomOn > 0.5) {
    vec2 c = resolution * 0.5;
    float zoom = 1.0 + uZoomDepth * sin(time * uZoomSpeed * 0.7);
    zoomedPos = c + (sampledPos - c) / zoom;
  }

  // === ОБЛАКА ===
  for (int i = 0; i < MAX_BLOBS; i++) {
    if (i >= uBlobCount) break;
    vec4 pos = uBlobPos[i];
    vec4 col = uBlobCol[i];
    vec4 anim = uBlobAnim[i];
    vec2 center = pos.xy;
    float radius = pos.z;
    float intensity = pos.w;
    float seed = col.w;

    if (uDriftOn > 0.5) {
      float dt = time * uDriftSpeed;
      center += vec2(cos(anim.x), sin(anim.x)) * dt * 8.0;
    }
    if (uSwirlOn > 0.5) {
      vec2 c0 = resolution * 0.5;
      vec2 toC = pos.xy - c0;
      float baseAngle = atan(toC.y, toC.x);
      float r0 = length(toC);
      float omega = 0.15 * uSwirlSpeed * (200.0 / max(r0, 50.0));
      float angle = baseAngle + time * omega;
      center = c0 + vec2(cos(angle), sin(angle)) * r0;
    }
    if (uWobbleOn > 0.5) {
      float wt = time * uWobbleSpeed * 0.8 + seed * 0.3;
      center += vec2(cos(wt + anim.x), sin(wt * 1.3 + anim.y)) * radius * uWobbleDepth;
    }

    float sizeMul = 1.0;
    if (uBreatheOn > 0.5) {
      float bt = time * uBreatheSpeed * 1.3;
      sizeMul *= 1.0 + uBreatheDepth * sin(bt + anim.y);
    }
    sizeMul *= globalPulse;

    vec2 local = (zoomedPos - center) / (radius * sizeMul);
    float r = length(local);
    if (r > 1.0) continue;

    float fall = pow(1.0 - r, uEdge);

    // === FLOW со спиральным движением и реверсом ===
    vec2 flowOffset = vec2(0.0);
    if (uFlowOn > 0.5) {
      float ft = time * uFlowSpeed * uFlowDir;
      vec2 fromSceneCenter = (center - resolution * 0.5) / minDim;
      vec2 tangent = vec2(-fromSceneCenter.y, fromSceneCenter.x);
      flowOffset = tangent * ft * 0.6;
    }
    vec2 noiseUV = local * uDetail + vec2(seed * 17.31, seed * 23.79) + flowOffset;
    float n = fbm(noiseUV);
    vec2 warpOffset = vec2(0.0);
    if (uFlowOn > 0.5) {
      float ft = time * uFlowSpeed * uFlowDir;
      warpOffset = vec2(sin(ft * 0.4) * 0.3, cos(ft * 0.3) * 0.3);
    }
    vec2 warp = vec2(fbm(noiseUV + 5.2 + warpOffset), fbm(noiseUV + 1.3 + warpOffset));
    float n2 = fbm(noiseUV + warp * 1.4);
    float v = mix(n, n2, 0.6);
    v = pow(v, uContrast);

    float a = fall * v * intensity + pow(fall, 3.0) * 0.5 * intensity;

    if (uTwinkleOn > 0.5) {
      float tt = time * uTwinkleSpeed * 2.5;
      float tw = (1.0 - uTwinkleDepth) + uTwinkleDepth * (0.5 + 0.5 * sin(tt + seed * 7.0));
      a *= tw;
    }

    vec3 baseColor = col.rgb;
    if (uShimmerOn > 0.5) {
      float st = time * uShimmerSpeed * 0.8;
      float sh = 0.5 + 0.5 * sin(st + seed * 4.0 + r * 3.0);
      vec3 shifted = vec3(baseColor.b, baseColor.r, baseColor.g);
      baseColor = mix(baseColor, shifted, sh * uShimmerDepth);
    }

    acc += baseColor * a;
  }

  // === ЧЁРНАЯ ДЫРА: визуал поверх облаков ===
  if (uBHOn > 0.5) {
    vec2 toBH = fragPos - bhCenter;
    float dist = length(toBH);
    float angle = atan(toBH.y, toBH.x);
    float t = time * uBHSpeed;

    float infl = bhR * 7.0;
    if (dist < infl && dist > bhR * 0.4) {
      float t01 = 1.0 - clamp((dist - bhR) / (infl - bhR), 0.0, 1.0);
      float spiralAngle = angle * 2.0 + log(max(dist, 1.0)) * 6.0 - t * 1.6;
      float arm = 0.5 + 0.5 * sin(spiralAngle);
      arm = pow(arm, 3.5);
      float turb = fbm(vec2(angle * 5.0 + t * 1.2, dist * 0.06) * 2.5);
      vec3 c = mix(vec3(0.15, 0.05, 0.4), vec3(0.6, 0.4, 1.0), t01);
      acc += c * arm * turb * t01 * uBHStrength * 1.4;
    }
    float dark = 1.0 - smoothstep(bhR * 0.3, bhR * 1.3, dist);
    acc *= 1.0 - dark * 0.98;
    float rim = exp(-pow((dist - bhR * 1.0) / (bhR * 0.07), 2.0));
    acc += vec3(0.5, 0.4, 1.0) * rim * uBHStrength * 0.4;
  }

  gl_FragColor = vec4(acc, 1.0);
}
`

function makeRng(seed: number) {
  let s = seed | 0
  if (s === 0) s = 1
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function gauss(rng: () => number): number {
  let u = 0,
    v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ]
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] * (1 - t) + b[0] * t,
    a[1] * (1 - t) + b[1] * t,
    a[2] * (1 - t) + b[2] * t,
  ]
}

const palettes: Record<
  NebulaPalette,
  (rng: () => number) => [number, number, number]
> = {
  violet: (rng) =>
    hslToRgb(260 + (rng() - 0.5) * 30, 75 + rng() * 20, 55 + rng() * 15),
  cyan: (rng) =>
    hslToRgb(180 + (rng() - 0.5) * 35, 70 + rng() * 25, 55 + rng() * 15),
  rose: (rng) =>
    hslToRgb(330 + (rng() - 0.5) * 30, 75 + rng() * 20, 60 + rng() * 15),
  emerald: (rng) =>
    hslToRgb(150 + (rng() - 0.5) * 30, 65 + rng() * 25, 50 + rng() * 15),
  amber: (rng) =>
    hslToRgb(30 + (rng() - 0.5) * 25, 80 + rng() * 15, 55 + rng() * 15),
  dual: (rng) => {
    const baseHues = [270, 180]
    const h = baseHues[Math.floor(rng() * 2)] + (rng() - 0.5) * 25
    return hslToRgb(h, 75 + rng() * 20, 55 + rng() * 15)
  },
}

interface BlobData {
  cx: number
  cy: number
  radius: number
  intensity: number
  color: [number, number, number]
  seed: number
  driftAngle: number
  swirlPhase: number
}

function generateBlobs(
  preset: NebulaPreset,
  width: number,
  height: number,
): BlobData[] {
  const rng = makeRng(preset.seed)
  const SCALE = Math.min(width, height) / 1000
  const cx = width / 2,
    cy = height / 2
  const minDim = Math.min(width, height)
  const { count, size, vary, bright } = preset.params
  const blobs: BlobData[] = []
  const layout = preset.layout ?? {
    mode: 'random' as NebulaLayoutMode,
    ringR: 0.5,
    ringW: 0.18,
    ringScatter: 0.2,
  }

  const c1 = hexToRgb(preset.colors.col1)
  const c2 = hexToRgb(preset.colors.col2)
  const c3 = hexToRgb(preset.colors.col3)
  const customColors = [c1, c2, c3]
  const paletteFn = palettes[preset.colors.palette] ?? palettes.violet

  function pickColor(): [number, number, number] {
    if (preset.colors.custom) {
      const roll = rng()
      const base = roll < 0.5 ? c1 : roll < 0.8 ? c2 : c3
      const other = customColors[Math.floor(rng() * 3)]
      const mixed = mixRgb(base, other, rng() * 0.3)
      const m = 1 - 0.2 + 0.2 * 2 * rng()
      return [
        Math.min(1, mixed[0] * m),
        Math.min(1, mixed[1] * m),
        Math.min(1, mixed[2] * m),
      ]
    }
    return paletteFn(rng)
  }

  for (let i = 0; i < count; i++) {
    let x: number, y: number

    if (layout.mode === 'ring') {
      const angle =
        (i / count) * 2 * Math.PI +
        (rng() - 0.5) * ((2 * Math.PI) / count) * 0.6
      const baseRadius = layout.ringR * minDim * 0.5
      const radialJitter = gauss(rng) * layout.ringW * minDim * 0.5
      const sideKick =
        rng() < 0.25 ? gauss(rng) * layout.ringScatter * minDim * 0.5 : 0
      const r = baseRadius + radialJitter + sideKick
      x = cx + Math.cos(angle) * r
      y = cy + Math.sin(angle) * r
    } else {
      const margin = size * SCALE * 0.3
      x = margin + rng() * (width - margin * 2)
      y = margin + rng() * (height - margin * 2)
    }

    const sizeMult = 1 - vary + vary * (0.3 + rng() * 1.4)
    const r = size * SCALE * sizeMult
    const color = pickColor()
    const intensity = (0.5 + rng() * 0.7) * bright
    const blobSeed = rng() * 100
    const driftAngle = rng() * 2 * Math.PI
    const swirlPhase = rng() * 2 * Math.PI
    blobs.push({
      cx: x,
      cy: y,
      radius: r,
      intensity,
      color,
      seed: blobSeed,
      driftAngle,
      swirlPhase,
    })
  }
  return blobs
}

export interface NebulaBackgroundHandle {
  shader: Phaser.GameObjects.Shader
  setPreset: (preset: NebulaPreset) => void
  destroy: () => void
}

// Внутреннее разрешение для static (RT) режима. 1024×1024 = 4MB RGBA texture.
// Туманность размытая → scale-up до WORLD_SIZE почти не виден.
// Снижено с 2048 для mobile (4× меньше памяти, быстрее upload в GPU).
const STATIC_RT_RES = 1024

export function attachNebulaBackground(
  scene: Phaser.Scene,
  preset: NebulaPreset,
  options?: {
    width?: number
    height?: number
    x?: number
    y?: number
    /** Если true — шейдер рендерится один раз в RenderTexture и уничтожается.
     *  Mobile GPU не справляется с per-frame fragment shader такого размера. */
    static?: boolean
  },
): NebulaBackgroundHandle {
  const w = options?.width ?? scene.scale.width
  const h = options?.height ?? scene.scale.height
  const cx = options?.x ?? w / 2
  const cy = options?.y ?? h / 2
  const isStatic = options?.static === true
  // В static режиме рендерим в фиксированный буфер RT_RES×RT_RES,
  // потом скейлим до w×h. В live режиме — full world size, рендер каждый кадр.
  const renderW = isStatic ? STATIC_RT_RES : w
  const renderH = isStatic ? STATIC_RT_RES : h

  const state = {
    preset,
    blobs: generateBlobs(preset, renderW, renderH),
    width: renderW,
    height: renderH,
    startTime: performance.now(),
    blobPosFlat: new Float32Array(MAX_BLOBS * 4),
    blobColFlat: new Float32Array(MAX_BLOBS * 4),
    blobAnimFlat: new Float32Array(MAX_BLOBS * 4),
  }

  const shaderConfig = {
    name: `nebula_${Math.floor(Math.random() * 1e9)}`,
    fragmentSource: FRAG,
    setupUniforms: (
      setUniform: (
        name: string,
        value: number | number[] | Float32Array | Int32Array | boolean,
      ) => void,
    ) => {
      const t = (performance.now() - state.startTime) / 1000
      const e = state.preset.effects

      setUniform('resolution', [state.width, state.height])
      setUniform('time', t)
      setUniform('uDetail', state.preset.params.detail)
      setUniform('uContrast', state.preset.params.contrast)
      setUniform('uEdge', state.preset.params.edge)

      setUniform('uBreatheOn', e.breathe.enabled ? 1 : 0)
      setUniform('uBreatheSpeed', e.breathe.speed)
      setUniform('uBreatheDepth', e.breathe.depth)

      setUniform('uDriftOn', e.drift.enabled ? 1 : 0)
      setUniform('uDriftSpeed', e.drift.speed)

      setUniform('uSwirlOn', e.swirl.enabled ? 1 : 0)
      setUniform('uSwirlSpeed', e.swirl.speed)

      setUniform('uFlowOn', e.flow.enabled ? 1 : 0)
      setUniform('uFlowSpeed', e.flow.speed)
      setUniform('uFlowDir', e.flow.reverse ? -1 : 1)

      setUniform('uTwinkleOn', e.twinkle.enabled ? 1 : 0)
      setUniform('uTwinkleSpeed', e.twinkle.speed)
      setUniform('uTwinkleDepth', e.twinkle.depth)

      setUniform('uWobbleOn', e.wobble.enabled ? 1 : 0)
      setUniform('uWobbleSpeed', e.wobble.speed)
      setUniform('uWobbleDepth', e.wobble.depth)

      setUniform('uPulseOn', e.pulse.enabled ? 1 : 0)
      setUniform('uPulseSpeed', e.pulse.speed)
      setUniform('uPulseDepth', e.pulse.depth)

      setUniform('uShimmerOn', e.shimmer.enabled ? 1 : 0)
      setUniform('uShimmerSpeed', e.shimmer.speed)
      setUniform('uShimmerDepth', e.shimmer.depth)

      setUniform('uZoomOn', e.zoom.enabled ? 1 : 0)
      setUniform('uZoomSpeed', e.zoom.speed)
      setUniform('uZoomDepth', e.zoom.depth)

      setUniform('uBHOn', state.preset.blackHole.enabled ? 1 : 0)
      setUniform('uBHSize', state.preset.blackHole.size)
      setUniform('uBHStrength', state.preset.blackHole.strength)
      setUniform('uBHSpeed', state.preset.blackHole.speed)

      const cnt = Math.min(state.blobs.length, MAX_BLOBS)
      setUniform('uBlobCount', cnt)

      for (let i = 0; i < cnt; i++) {
        const b = state.blobs[i]
        const o = i * 4
        state.blobPosFlat[o] = b.cx
        state.blobPosFlat[o + 1] = b.cy
        state.blobPosFlat[o + 2] = b.radius
        state.blobPosFlat[o + 3] = b.intensity
        state.blobColFlat[o] = b.color[0]
        state.blobColFlat[o + 1] = b.color[1]
        state.blobColFlat[o + 2] = b.color[2]
        state.blobColFlat[o + 3] = b.seed
        state.blobAnimFlat[o] = b.driftAngle
        state.blobAnimFlat[o + 1] = b.swirlPhase
        state.blobAnimFlat[o + 2] = 0
        state.blobAnimFlat[o + 3] = 0
      }
      for (let i = cnt; i < MAX_BLOBS; i++) {
        const o = i * 4
        state.blobPosFlat[o] = 0
        state.blobPosFlat[o + 1] = 0
        state.blobPosFlat[o + 2] = 0
        state.blobPosFlat[o + 3] = 0
        state.blobColFlat[o] = 0
        state.blobColFlat[o + 1] = 0
        state.blobColFlat[o + 2] = 0
        state.blobColFlat[o + 3] = 0
        state.blobAnimFlat[o] = 0
        state.blobAnimFlat[o + 1] = 0
        state.blobAnimFlat[o + 2] = 0
        state.blobAnimFlat[o + 3] = 0
      }

      setUniform('uBlobPos[0]', state.blobPosFlat)
      setUniform('uBlobCol[0]', state.blobColFlat)
      setUniform('uBlobAnim[0]', state.blobAnimFlat)
    },
  }

  // scene.add.shader() exists at runtime but is absent from Phaser 4 type stubs.
  const sceneAdd = scene.add as unknown as {
    shader: (
      config: object,
      x: number,
      y: number,
      w: number,
      h: number,
    ) => Phaser.GameObjects.Shader
  }
  const shader = sceneAdd.shader(shaderConfig, cx, cy, renderW, renderH)
  if (typeof shader.setDepth === 'function') shader.setDepth(-10000)
  if (typeof shader.setOrigin === 'function') shader.setOrigin(0.5, 0.5)
  // Static: визуально показываем во весь world size, внутри рендерим RT_RES
  if (isStatic && typeof shader.setDisplaySize === 'function') {
    shader.setDisplaySize(w, h)
  }

  const onResize = (gameSize: Phaser.Structs.Size) => {
    if (isStatic) return // static RT не реагирует на resize
    state.width = gameSize.width
    state.height = gameSize.height
    state.blobs = generateBlobs(state.preset, gameSize.width, gameSize.height)
    if (typeof shader.setSize === 'function')
      shader.setSize(gameSize.width, gameSize.height)
    if (typeof shader.setPosition === 'function')
      shader.setPosition(gameSize.width / 2, gameSize.height / 2)
  }
  scene.scale.on('resize', onResize)

  // Static mode: после первого POST_RENDER снимаем shader output в RenderTexture,
  // уничтожаем shader. Дальше backgound = статичная текстура, 0 фрагмент-cost.
  let staticRt: Phaser.GameObjects.RenderTexture | null = null
  if (isStatic) {
    // 'postrender' — после того как scene полностью отрендерилась первый раз.
    // К этому моменту shader.setupUniforms() уже вызван и шейдер скомпилирован.
    scene.events.once('postrender', () => {
      try {
        const sceneAddRt = scene.add as unknown as {
          renderTexture: (
            x: number,
            y: number,
            w: number,
            h: number,
          ) => Phaser.GameObjects.RenderTexture
        }
        staticRt = sceneAddRt.renderTexture(cx, cy, renderW, renderH)
        staticRt.setOrigin(0.5, 0.5)
        staticRt.setDepth(-10000)
        staticRt.setDisplaySize(w, h) // scale до world size
        // Рендерим shader (текущее состояние) в RT
        staticRt.draw(shader, renderW / 2, renderH / 2)
        // Шейдер больше не нужен — уничтожаем чтобы GPU не тратил такты
        if (typeof shader.destroy === 'function') shader.destroy()
      } catch (e) {
        // Fallback: если RT не получился, оставляем live shader. Лучше лагать
        // чем не показать туманность совсем.
        console.warn('[NebulaBackground] static RT snapshot failed, falling back to live shader', e)
      }
    })
  }

  return {
    shader,
    setPreset: (newPreset: NebulaPreset) => {
      state.preset = newPreset
      state.blobs = generateBlobs(newPreset, state.width, state.height)
      state.startTime = performance.now()
    },
    destroy: () => {
      scene.scale.off('resize', onResize)
      if (staticRt && typeof staticRt.destroy === 'function') staticRt.destroy()
      // shader может быть уже destroyed в static режиме
      if (typeof shader.destroy === 'function' && shader.scene) shader.destroy()
    },
  }
}
