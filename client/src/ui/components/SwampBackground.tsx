// Top-down hand-painted swamp diorama — replaces map.png with inline SVG.
// Strictly STATIC: no animations, no transitions, no random hooks.
// Object placement and proportions match map.png object-by-object.
//
// viewBox: 400 × 600 (matches map.png 2:3 portrait aspect)
// Coordinate system: top-left origin, all positions absolute.
//
// Mounted via createPortal into #game-canvas div — sits behind the
// transparent Phaser canvas (z-index: -1 inside the canvas stacking context).

import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/gameStore'

function getGameCanvasElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.getElementById('game-canvas')
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180

/** "Pac-man" lily pad shape: filled disk with a wedge cut out (water-side notch). */
function lilyPadPath(
  cx: number,
  cy: number,
  r: number,
  notchDeg: number,
  wedge = 32,
) {
  const a1 = (notchDeg - wedge / 2) * DEG
  const a2 = (notchDeg + wedge / 2) * DEG
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  const x2 = cx + r * Math.cos(a2)
  const y2 = cy + r * Math.sin(a2)
  return `M ${cx.toFixed(1)} ${cy.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 1 0 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`
}

// ─── lily flower (pink water lily) ───────────────────────────────────────────
// 5 outer petals + 5 inner darker petals + yellow center cluster.

function LilyFlower({
  cx,
  cy,
  r = 11,
}: {
  cx: number
  cy: number
  r?: number
}) {
  const outer = [0, 72, 144, 216, 288]
  const inner = [36, 108, 180, 252, 324]
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* soft glow base */}
      <ellipse
        cx={0}
        cy={0}
        rx={r * 1.2}
        ry={r * 1.05}
        fill="#9c4868"
        opacity={0.18}
      />

      {/* outer petals — light pink */}
      {outer.map((a) => (
        <g key={`o${a}`} transform={`rotate(${a})`}>
          <path
            d={`M 0 ${(-r * 0.18).toFixed(1)} Q ${(r * 0.42).toFixed(1)} ${(-r * 0.65).toFixed(1)} 0 ${(-r * 1.05).toFixed(1)} Q ${(-r * 0.42).toFixed(1)} ${(-r * 0.65).toFixed(1)} 0 ${(-r * 0.18).toFixed(1)} Z`}
            fill="#f5b8cc"
            stroke="#b4607c"
            strokeWidth={0.6}
            strokeLinejoin="round"
          />
          {/* highlight tip */}
          <ellipse
            cx={0}
            cy={-r * 0.85}
            rx={r * 0.13}
            ry={r * 0.22}
            fill="#fde0eb"
            opacity={0.85}
          />
        </g>
      ))}

      {/* inner petals — deeper pink, smaller, rotated 36° */}
      {inner.map((a) => (
        <g key={`i${a}`} transform={`rotate(${a})`}>
          <path
            d={`M 0 ${(-r * 0.1).toFixed(1)} Q ${(r * 0.32).toFixed(1)} ${(-r * 0.5).toFixed(1)} 0 ${(-r * 0.82).toFixed(1)} Q ${(-r * 0.32).toFixed(1)} ${(-r * 0.5).toFixed(1)} 0 ${(-r * 0.1).toFixed(1)} Z`}
            fill="#dd87a5"
            stroke="#9c4868"
            strokeWidth={0.5}
            strokeLinejoin="round"
          />
        </g>
      ))}

      {/* yellow center stamen cluster */}
      <circle
        cx={0}
        cy={0}
        r={r * 0.32}
        fill="#f4c248"
        stroke="#a06010"
        strokeWidth={0.5}
      />
      <circle cx={-r * 0.06} cy={-r * 0.08} r={r * 0.14} fill="#fde890" />
      {/* tiny stamen dots */}
      <circle cx={r * 0.12} cy={r * 0.08} r={r * 0.05} fill="#a06010" />
      <circle cx={-r * 0.14} cy={r * 0.04} r={r * 0.05} fill="#a06010" />
      <circle cx={r * 0.04} cy={-r * 0.16} r={r * 0.05} fill="#a06010" />
    </g>
  )
}

// ─── lily pad cluster — main pad + smaller pads + flower ─────────────────────

function LilyPadCluster({
  cx,
  cy,
  variant = 0,
}: {
  cx: number
  cy: number
  variant?: number
}) {
  const layouts = [
    // Variant 0: 4 pads + flower offset upper-left
    {
      pads: [
        { dx: 0, dy: 0, r: 36, notch: 200, wedge: 36 },
        { dx: -28, dy: -18, r: 22, notch: 30, wedge: 32 },
        { dx: 26, dy: -10, r: 20, notch: 220, wedge: 30 },
        { dx: 8, dy: 22, r: 18, notch: 290, wedge: 28 },
      ],
      flower: { dx: -4, dy: -10, r: 12 },
    },
    // Variant 1: 3 pads + flower
    {
      pads: [
        { dx: 0, dy: 0, r: 30, notch: 340, wedge: 32 },
        { dx: -22, dy: 8, r: 19, notch: 60, wedge: 28 },
        { dx: 18, dy: 14, r: 17, notch: 240, wedge: 26 },
      ],
      flower: { dx: 0, dy: -6, r: 10 },
    },
    // Variant 2: 5 pads + flower
    {
      pads: [
        { dx: 0, dy: 0, r: 38, notch: 160, wedge: 38 },
        { dx: -32, dy: -6, r: 22, notch: 20, wedge: 30 },
        { dx: 28, dy: -12, r: 19, notch: 220, wedge: 28 },
        { dx: 18, dy: 22, r: 16, notch: 280, wedge: 26 },
        { dx: -16, dy: 24, r: 14, notch: 80, wedge: 24 },
      ],
      flower: { dx: -6, dy: -12, r: 13 },
    },
  ]
  const layout = layouts[variant % layouts.length]

  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* Soft water shadow under entire cluster */}
      <ellipse
        cx={2}
        cy={6}
        rx={layout.pads[0].r + 8}
        ry={layout.pads[0].r * 0.55}
        fill="#1a2c0a"
        opacity={0.35}
      />

      {/* Pads (sorted by size desc — biggest at back) */}
      {[...layout.pads]
        .sort((a, b) => b.r - a.r)
        .map((p, i) => (
          <g key={i}>
            {/* drop-shadow under pad */}
            <ellipse
              cx={p.dx + 1}
              cy={p.dy + 3}
              rx={p.r * 0.85}
              ry={p.r * 0.4}
              fill="#142008"
              opacity={0.45}
            />
            {/* main pad body */}
            <path
              d={lilyPadPath(p.dx, p.dy, p.r, p.notch, p.wedge)}
              fill="url(#sw-pad)"
              stroke="#0f2208"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
            {/* radial veins */}
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              // skip veins inside notch
              const diff = ((deg - p.notch + 540) % 360) - 180
              if (Math.abs(diff) < p.wedge / 2) return null
              const ax = p.dx + Math.cos(deg * DEG) * p.r * 0.85
              const ay = p.dy + Math.sin(deg * DEG) * p.r * 0.85
              return (
                <line
                  key={deg}
                  x1={p.dx}
                  y1={p.dy}
                  x2={ax}
                  y2={ay}
                  stroke="#3a6420"
                  strokeWidth={0.6}
                  opacity={0.5}
                />
              )
            })}
            {/* glossy highlight crescent */}
            <ellipse
              cx={p.dx - p.r * 0.25}
              cy={p.dy - p.r * 0.3}
              rx={p.r * 0.45}
              ry={p.r * 0.18}
              fill="#5a8230"
              opacity={0.4}
              transform={`rotate(-20 ${p.dx - p.r * 0.25} ${p.dy - p.r * 0.3})`}
            />
          </g>
        ))}

      {/* Pink water lily on top */}
      <LilyFlower
        cx={layout.flower.dx}
        cy={layout.flower.dy}
        r={layout.flower.r}
      />
    </g>
  )
}

// ─── bushes (clumps of leaves) ───────────────────────────────────────────────

function BushLeaf({
  cx,
  cy,
  rx,
  ry,
  rot = 0,
  fill,
  outline = '#142008',
  highlight,
}: {
  cx: number
  cy: number
  rx: number
  ry: number
  rot?: number
  fill: string
  outline?: string
  highlight?: string
}) {
  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`}>
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={fill}
        stroke={outline}
        strokeWidth={1.2}
      />
      {highlight && (
        <ellipse
          cx={cx - rx * 0.22}
          cy={cy - ry * 0.32}
          rx={rx * 0.45}
          ry={ry * 0.28}
          fill={highlight}
          opacity={0.7}
        />
      )}
    </g>
  )
}

function BushBig({
  cx,
  cy,
  scale = 1,
}: {
  cx: number
  cy: number
  scale?: number
}) {
  const s = scale
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* shadow under bush */}
      <ellipse
        cx={0}
        cy={8 * s}
        rx={26 * s}
        ry={6 * s}
        fill="#0c1a05"
        opacity={0.5}
      />
      {/* base layer dark leaves */}
      <BushLeaf
        cx={-12 * s}
        cy={2 * s}
        rx={11 * s}
        ry={9 * s}
        rot={-15}
        fill="#243d10"
        highlight="#3e6e22"
      />
      <BushLeaf
        cx={12 * s}
        cy={3 * s}
        rx={11 * s}
        ry={9 * s}
        rot={20}
        fill="#243d10"
        highlight="#3e6e22"
      />
      <BushLeaf
        cx={0}
        cy={-2 * s}
        rx={13 * s}
        ry={11 * s}
        rot={0}
        fill="#2c4814"
        highlight="#4a7820"
      />
      {/* mid layer */}
      <BushLeaf
        cx={-6 * s}
        cy={-9 * s}
        rx={9 * s}
        ry={8 * s}
        rot={-25}
        fill="#345418"
        highlight="#5a8a28"
      />
      <BushLeaf
        cx={7 * s}
        cy={-10 * s}
        rx={9 * s}
        ry={8 * s}
        rot={30}
        fill="#345418"
        highlight="#5a8a28"
      />
      <BushLeaf
        cx={-14 * s}
        cy={-6 * s}
        rx={7 * s}
        ry={6 * s}
        rot={-50}
        fill="#2c4814"
        highlight="#4a7820"
      />
      <BushLeaf
        cx={14 * s}
        cy={-5 * s}
        rx={7 * s}
        ry={6 * s}
        rot={50}
        fill="#2c4814"
        highlight="#4a7820"
      />
      {/* top layer brightest leaves */}
      <BushLeaf
        cx={-2 * s}
        cy={-15 * s}
        rx={6.5 * s}
        ry={6 * s}
        rot={-10}
        fill="#3e6820"
        highlight="#74a832"
      />
      <BushLeaf
        cx={6 * s}
        cy={-17 * s}
        rx={5.5 * s}
        ry={5 * s}
        rot={20}
        fill="#3e6820"
        highlight="#74a832"
      />
      {/* tiny accent leaves at extreme tips */}
      <BushLeaf
        cx={-9 * s}
        cy={-19 * s}
        rx={3 * s}
        ry={3 * s}
        rot={0}
        fill="#5a9028"
      />
      <BushLeaf
        cx={3 * s}
        cy={-22 * s}
        rx={2.5 * s}
        ry={2.5 * s}
        rot={0}
        fill="#74a832"
      />
      {/* leaf-pointed tips peeking out */}
      <path
        d={`M ${-18 * s} ${-2 * s} L ${-22 * s} ${-9 * s} L ${-15 * s} ${-7 * s} Z`}
        fill="#3e6820"
        stroke="#142008"
        strokeWidth={0.8}
      />
      <path
        d={`M ${17 * s} ${-3 * s} L ${22 * s} ${-9 * s} L ${15 * s} ${-7 * s} Z`}
        fill="#3e6820"
        stroke="#142008"
        strokeWidth={0.8}
      />
    </g>
  )
}

function BushSmall({
  cx,
  cy,
  scale = 1,
  mirror = false,
}: {
  cx: number
  cy: number
  scale?: number
  mirror?: boolean
}) {
  const s = scale
  const sx = mirror ? -1 : 1
  return (
    <g transform={`translate(${cx} ${cy}) scale(${sx} 1)`}>
      <ellipse
        cx={0}
        cy={5 * s}
        rx={14 * s}
        ry={3.5 * s}
        fill="#0c1a05"
        opacity={0.5}
      />
      <BushLeaf
        cx={-6 * s}
        cy={1 * s}
        rx={7 * s}
        ry={6 * s}
        rot={-20}
        fill="#2c4814"
        highlight="#4a7820"
      />
      <BushLeaf
        cx={6 * s}
        cy={2 * s}
        rx={7 * s}
        ry={6 * s}
        rot={25}
        fill="#2c4814"
        highlight="#4a7820"
      />
      <BushLeaf
        cx={0}
        cy={-4 * s}
        rx={8 * s}
        ry={7 * s}
        rot={0}
        fill="#345418"
        highlight="#5a8a28"
      />
      <BushLeaf
        cx={-3 * s}
        cy={-10 * s}
        rx={5 * s}
        ry={5 * s}
        rot={-10}
        fill="#3e6820"
        highlight="#74a832"
      />
      <BushLeaf
        cx={4 * s}
        cy={-12 * s}
        rx={4 * s}
        ry={4 * s}
        rot={15}
        fill="#5a9028"
      />
      <BushLeaf
        cx={-1 * s}
        cy={-15 * s}
        rx={2.5 * s}
        ry={2.5 * s}
        rot={0}
        fill="#74a832"
      />
    </g>
  )
}

// ─── rocks ───────────────────────────────────────────────────────────────────

function Rock({
  cx,
  cy,
  rx,
  ry,
  variant = 0,
}: {
  cx: number
  cy: number
  rx: number
  ry: number
  variant?: number
}) {
  // 3 path variants, all roughly elliptical but irregular
  const paths = [
    `M ${-rx * 0.95} ${ry * 0.3} L ${-rx * 0.7} ${-ry * 0.7} L ${-rx * 0.2} ${-ry} L ${rx * 0.55} ${-ry * 0.85} L ${rx} ${-ry * 0.1} L ${rx * 0.7} ${ry * 0.7} L ${-rx * 0.2} ${ry * 0.95} Z`,
    `M ${-rx} ${0} L ${-rx * 0.6} ${-ry * 0.85} L ${rx * 0.1} ${-ry} L ${rx * 0.7} ${-ry * 0.6} L ${rx * 0.95} ${ry * 0.3} L ${rx * 0.4} ${ry} L ${-rx * 0.5} ${ry * 0.85} Z`,
    `M ${-rx * 0.8} ${ry * 0.5} L ${-rx} ${-ry * 0.2} L ${-rx * 0.4} ${-ry * 0.95} L ${rx * 0.5} ${-ry * 0.9} L ${rx * 0.95} ${-ry * 0.2} L ${rx * 0.8} ${ry * 0.6} L ${rx * 0.1} ${ry} L ${-rx * 0.5} ${ry * 0.9} Z`,
  ]
  const pathD = paths[variant % paths.length]
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* shadow on ground */}
      <ellipse
        cx={1}
        cy={ry + 2}
        rx={rx * 1.05}
        ry={ry * 0.32}
        fill="#0c1a05"
        opacity={0.5}
      />
      {/* main body */}
      <path
        d={pathD}
        fill="url(#sw-rock)"
        stroke="#2a2a26"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* dark shadow side */}
      <path
        d={`M ${rx * 0.1} ${ry * 0.1} L ${rx * 0.95} ${-ry * 0.2} L ${rx * 0.7} ${ry * 0.7} L ${rx * 0.05} ${ry * 0.95} Z`}
        fill="#3e3e36"
        opacity={0.5}
      />
      {/* light highlight */}
      <ellipse
        cx={-rx * 0.35}
        cy={-ry * 0.5}
        rx={rx * 0.4}
        ry={ry * 0.22}
        fill="#c8c8b0"
        opacity={0.55}
      />
      {/* small specular dot */}
      <circle
        cx={-rx * 0.5}
        cy={-ry * 0.6}
        r={Math.min(rx, ry) * 0.1}
        fill="#e8e8d4"
        opacity={0.7}
      />
      {/* tiny crack */}
      <path
        d={`M ${-rx * 0.2} ${-ry * 0.1} L ${rx * 0.1} ${ry * 0.3} L ${rx * 0.3} ${ry * 0.5}`}
        fill="none"
        stroke="#2a2a26"
        strokeWidth={0.7}
        opacity={0.6}
      />
    </g>
  )
}

// ─── bright lime grass tufts (foreground accent) ─────────────────────────────

function GrassTuft({
  cx,
  cy,
  scale = 1,
}: {
  cx: number
  cy: number
  scale?: number
}) {
  const s = scale
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <path
        d={`M 0 0 Q ${-3 * s} ${-9 * s} ${-5 * s} ${-16 * s}`}
        stroke="#3a5a18"
        strokeWidth={1.6 * s}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M 0 0 Q ${1 * s} ${-11 * s} ${1 * s} ${-19 * s}`}
        stroke="#5a8a28"
        strokeWidth={1.6 * s}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M 0 0 Q ${4 * s} ${-8 * s} ${6 * s} ${-15 * s}`}
        stroke="#3a5a18"
        strokeWidth={1.4 * s}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M 0 0 Q ${-1 * s} ${-13 * s} ${-2 * s} ${-21 * s}`}
        stroke="#7aa830"
        strokeWidth={1.2 * s}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M 0 0 Q ${3 * s} ${-12 * s} ${4 * s} ${-18 * s}`}
        stroke="#92be32"
        strokeWidth={1.1 * s}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  )
}

// ─── small leaf cluster (low-growing plants) ─────────────────────────────────

function LeafCluster({
  cx,
  cy,
  scale = 1,
}: {
  cx: number
  cy: number
  scale?: number
}) {
  const s = scale
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <ellipse
        cx={-4 * s}
        cy={1 * s}
        rx={5 * s}
        ry={3 * s}
        fill="#2a4814"
        stroke="#142008"
        strokeWidth={0.7}
        transform={`rotate(-30 ${-4 * s} ${1 * s})`}
      />
      <ellipse
        cx={4 * s}
        cy={0}
        rx={5 * s}
        ry={3 * s}
        fill="#2a4814"
        stroke="#142008"
        strokeWidth={0.7}
        transform={`rotate(25 ${4 * s} 0)`}
      />
      <ellipse
        cx={0}
        cy={-3 * s}
        rx={4.5 * s}
        ry={2.8 * s}
        fill="#3a6418"
        stroke="#142008"
        strokeWidth={0.7}
      />
      <ellipse
        cx={-1 * s}
        cy={-6 * s}
        rx={3.5 * s}
        ry={2.2 * s}
        fill="#5a8a28"
      />
    </g>
  )
}

// ─── algae blob (dark spot in water) ─────────────────────────────────────────

function AlgaeBlob({
  cx,
  cy,
  rx,
  ry,
  rot = 0,
  opacity = 0.55,
}: {
  cx: number
  cy: number
  rx: number
  ry: number
  rot?: number
  opacity?: number
}) {
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill="#2c4818"
      opacity={opacity}
      transform={`rotate(${rot} ${cx} ${cy})`}
    />
  )
}

// ─── moss patch (irregular dark blob on shore) ───────────────────────────────

function MossPatch({
  cx,
  cy,
  rx,
  ry,
  fill = '#1a2e0a',
  rot = 0,
  opacity = 0.6,
}: {
  cx: number
  cy: number
  rx: number
  ry: number
  fill?: string
  rot?: number
  opacity?: number
}) {
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill={fill}
      opacity={opacity}
      transform={`rotate(${rot} ${cx} ${cy})`}
    />
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export function SwampBackground() {
  const loc = useGameStore((s) => s.currentLocation)
  if (loc !== 1) return null

  const mount = getGameCanvasElement()
  if (!mount) return null

  return createPortal(
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox="0 0 400 600"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: '100%', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="geometricPrecision"
      >
        <defs>
          {/* water gradient — lighter olive in center, darker at edges */}
          <radialGradient id="sw-water" cx="50%" cy="48%" r="62%">
            <stop offset="0%" stopColor="#84a248" />
            <stop offset="40%" stopColor="#6a8a36" />
            <stop offset="80%" stopColor="#4d6e26" />
            <stop offset="100%" stopColor="#3a5418" />
          </radialGradient>

          {/* bright shore grass — yellow-lime band */}
          <radialGradient id="sw-shore" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#7e9c3a" />
            <stop offset="100%" stopColor="#5a7826" />
          </radialGradient>

          {/* dark outer moss border */}
          <radialGradient id="sw-moss" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="#2a4014" />
            <stop offset="100%" stopColor="#152a08" />
          </radialGradient>

          {/* lily pad gradient */}
          <radialGradient id="sw-pad" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#3e6820" />
            <stop offset="60%" stopColor="#1f3a10" />
            <stop offset="100%" stopColor="#0e1f06" />
          </radialGradient>

          {/* rock gradient */}
          <radialGradient id="sw-rock" cx="32%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#b4b4a0" />
            <stop offset="55%" stopColor="#74746a" />
            <stop offset="100%" stopColor="#3e3e36" />
          </radialGradient>

          {/* organic pond shape — irregular blob */}
          <clipPath id="sw-pond-clip">
            <path
              d="M 200 88
                 C 270 90, 320 130, 332 198
                 C 348 268, 340 350, 322 410
                 C 304 470, 268 510, 218 518
                 C 168 525, 118 504, 88 462
                 C 60 422, 56 360, 64 296
                 C 70 230, 86 170, 122 130
                 C 152 100, 180 86, 200 88 Z"
            />
          </clipPath>
        </defs>

        {/* ═══ LAYER 1: outer dark moss frame ═══ */}
        <rect width="400" height="600" fill="url(#sw-moss)" />

        {/* dark moss textural patches scattered along outer frame */}
        <MossPatch cx={28} cy={45} rx={22} ry={14} rot={-15} />
        <MossPatch cx={62} cy={20} rx={18} ry={9} rot={5} />
        <MossPatch cx={120} cy={12} rx={28} ry={10} rot={-8} />
        <MossPatch cx={210} cy={6} rx={34} ry={9} rot={4} />
        <MossPatch cx={300} cy={14} rx={28} ry={11} rot={-6} />
        <MossPatch cx={372} cy={32} rx={20} ry={13} rot={20} />
        <MossPatch cx={386} cy={120} rx={12} ry={28} rot={-5} />
        <MossPatch cx={392} cy={220} rx={10} ry={34} rot={3} />
        <MossPatch cx={388} cy={340} rx={11} ry={32} rot={-2} />
        <MossPatch cx={386} cy={460} rx={13} ry={30} rot={5} />
        <MossPatch cx={372} cy={560} rx={22} ry={14} rot={-15} />
        <MossPatch cx={290} cy={588} rx={28} ry={10} rot={3} />
        <MossPatch cx={180} cy={592} rx={32} ry={10} rot={-4} />
        <MossPatch cx={86} cy={588} rx={26} ry={11} rot={6} />
        <MossPatch cx={28} cy={552} rx={20} ry={18} rot={-22} />
        <MossPatch cx={14} cy={440} rx={11} ry={28} rot={-3} />
        <MossPatch cx={10} cy={328} rx={10} ry={34} rot={0} />
        <MossPatch cx={14} cy={210} rx={12} ry={30} rot={5} />
        <MossPatch cx={16} cy={110} rx={13} ry={24} rot={-6} />

        {/* ═══ LAYER 2: bright shore grass band — soft inner mask ═══ */}
        <ellipse cx={200} cy={300} rx={184} ry={282} fill="url(#sw-shore)" />

        {/* shore texture — light grassy specks */}
        {[...Array(60)].map((_, i) => {
          // pseudo-deterministic positions on shore band
          const a = i * 137.5 * DEG
          const r = 145 + ((i * 17) % 35)
          const x = 200 + Math.cos(a) * r
          const y = 300 + Math.sin(a) * r * 1.4
          if (x < 8 || x > 392 || y < 8 || y > 592) return null
          return (
            <circle
              key={`g${i}`}
              cx={x.toFixed(1)}
              cy={y.toFixed(1)}
              r={1 + (i % 3) * 0.5}
              fill={
                i % 3 === 0 ? '#9bc448' : i % 3 === 1 ? '#6e8a32' : '#4a6e22'
              }
              opacity={0.85}
            />
          )
        })}

        {/* ═══ LAYER 3: pond water (clipped to organic shape) ═══ */}
        <g clipPath="url(#sw-pond-clip)">
          {/* base water gradient */}
          <rect x={50} y={80} width={300} height={450} fill="url(#sw-water)" />

          {/* algae blobs (darker organic spots) */}
          <AlgaeBlob
            cx={150}
            cy={180}
            rx={28}
            ry={14}
            rot={-10}
            opacity={0.4}
          />
          <AlgaeBlob
            cx={250}
            cy={150}
            rx={22}
            ry={10}
            rot={20}
            opacity={0.45}
          />
          <AlgaeBlob
            cx={210}
            cy={230}
            rx={36}
            ry={16}
            rot={-5}
            opacity={0.35}
          />
          <AlgaeBlob cx={120} cy={310} rx={30} ry={14} rot={15} opacity={0.4} />
          <AlgaeBlob
            cx={290}
            cy={350}
            rx={26}
            ry={13}
            rot={-15}
            opacity={0.4}
          />
          <AlgaeBlob cx={180} cy={380} rx={32} ry={15} rot={5} opacity={0.45} />
          <AlgaeBlob cx={240} cy={420} rx={20} ry={9} rot={20} opacity={0.4} />
          <AlgaeBlob
            cx={130}
            cy={440}
            rx={24}
            ry={11}
            rot={-10}
            opacity={0.4}
          />
          <AlgaeBlob cx={210} cy={290} rx={18} ry={9} rot={0} opacity={0.5} />
          <AlgaeBlob cx={260} cy={250} rx={14} ry={7} rot={30} opacity={0.5} />
          <AlgaeBlob cx={170} cy={340} rx={16} ry={8} rot={-25} opacity={0.5} />
          <AlgaeBlob cx={220} cy={470} rx={22} ry={10} rot={10} opacity={0.4} />

          {/* very small darker dots — duckweed */}
          {[...Array(40)].map((_, i) => {
            const a = i * 91.7 * DEG
            const r = 30 + ((i * 11) % 110)
            const x = 200 + Math.cos(a) * r
            const y = 300 + Math.sin(a) * r * 1.3
            return (
              <circle
                key={`d${i}`}
                cx={x.toFixed(1)}
                cy={y.toFixed(1)}
                r={1.2 + (i % 3) * 0.4}
                fill="#3a5818"
                opacity={0.5 + (i % 5) * 0.06}
              />
            )
          })}

          {/* highlight specks — sun glints on water */}
          {[
            [180, 200],
            [240, 260],
            [160, 280],
            [280, 310],
            [200, 360],
            [140, 340],
            [260, 390],
            [220, 200],
            [180, 440],
            [240, 470],
          ].map(([x, y], i) => (
            <circle
              key={`h${i}`}
              cx={x}
              cy={y}
              r={1.4}
              fill="#c4d878"
              opacity={0.55}
            />
          ))}
        </g>

        {/* ═══ LAYER 4: shore moss patches (transition zone) ═══ */}
        <MossPatch
          cx={50}
          cy={300}
          rx={26}
          ry={50}
          fill="#1f3a10"
          rot={5}
          opacity={0.5}
        />
        <MossPatch
          cx={350}
          cy={300}
          rx={26}
          ry={50}
          fill="#1f3a10"
          rot={-3}
          opacity={0.5}
        />
        <MossPatch
          cx={200}
          cy={70}
          rx={70}
          ry={22}
          fill="#1f3a10"
          rot={2}
          opacity={0.4}
        />
        <MossPatch
          cx={200}
          cy={530}
          rx={80}
          ry={24}
          fill="#1f3a10"
          rot={-1}
          opacity={0.45}
        />

        {/* small shore mud specks (transition between bright shore & water) */}
        {[
          [80, 130, 8, 4, 10],
          [320, 130, 9, 4, -10],
          [70, 460, 10, 5, -15],
          [330, 470, 8, 4, 12],
          [110, 95, 6, 3, 5],
          [290, 95, 7, 3, -8],
          [140, 540, 6, 3, 0],
          [260, 540, 7, 4, 5],
          [60, 220, 7, 3, -5],
          [340, 230, 7, 3, 8],
          [56, 380, 8, 4, 0],
          [342, 380, 7, 4, -5],
        ].map(([x, y, rx, ry, rot], i) => (
          <ellipse
            key={`mud${i}`}
            cx={x}
            cy={y}
            rx={rx}
            ry={ry}
            fill="#3a5418"
            opacity={0.5}
            transform={`rotate(${rot} ${x} ${y})`}
          />
        ))}

        {/* ═══ LAYER 5: rocks (gray boulders) ═══ */}
        <Rock cx={42} cy={62} rx={20} ry={14} variant={0} />
        <Rock cx={350} cy={88} rx={18} ry={13} variant={1} />
        <Rock cx={378} cy={210} rx={14} ry={11} variant={2} />
        <Rock cx={372} cy={368} rx={20} ry={14} variant={0} />
        <Rock cx={56} cy={232} rx={15} ry={12} variant={2} />
        <Rock cx={48} cy={420} rx={17} ry={13} variant={1} />
        <Rock cx={26} cy={552} rx={16} ry={12} variant={0} />
        <Rock cx={114} cy={28} rx={13} ry={9} variant={2} />
        <Rock cx={262} cy={20} rx={11} ry={8} variant={1} />

        {/* ═══ LAYER 6: small leaf clusters & ground plants ═══ */}
        <LeafCluster cx={62} cy={85} />
        <LeafCluster cx={86} cy={50} />
        <LeafCluster cx={140} cy={28} scale={0.9} />
        <LeafCluster cx={250} cy={32} scale={1.1} />
        <LeafCluster cx={332} cy={50} />
        <LeafCluster cx={372} cy={140} scale={0.9} />
        <LeafCluster cx={376} cy={260} scale={1} />
        <LeafCluster cx={372} cy={420} scale={0.95} />
        <LeafCluster cx={356} cy={500} scale={1.1} />
        <LeafCluster cx={300} cy={550} scale={1} />
        <LeafCluster cx={170} cy={566} scale={1.1} />
        <LeafCluster cx={92} cy={538} scale={1} />
        <LeafCluster cx={30} cy={490} scale={0.9} />
        <LeafCluster cx={26} cy={380} scale={1} />
        <LeafCluster cx={28} cy={290} scale={0.95} />
        <LeafCluster cx={26} cy={172} scale={1.05} />

        {/* ═══ LAYER 7: bushes (densely packed perimeter) ═══ */}
        {/* Top row */}
        <BushBig cx={48} cy={48} scale={1.1} />
        <BushSmall cx={88} cy={42} scale={0.85} />
        <BushSmall cx={120} cy={36} scale={1} />
        <BushBig cx={168} cy={48} scale={0.92} />
        <BushSmall cx={210} cy={36} scale={0.95} />
        <BushSmall cx={246} cy={42} scale={1} mirror />
        <BushBig cx={290} cy={50} scale={1.0} />
        <BushSmall cx={328} cy={40} scale={0.95} mirror />
        <BushBig cx={362} cy={54} scale={1.05} />

        {/* Left side */}
        <BushBig cx={30} cy={120} scale={0.95} />
        <BushSmall cx={48} cy={170} scale={0.95} />
        <BushBig cx={28} cy={228} scale={1} />
        <BushSmall cx={42} cy={290} scale={0.9} />
        <BushBig cx={28} cy={358} scale={1.05} />
        <BushSmall cx={46} cy={420} scale={0.95} />
        <BushBig cx={30} cy={478} scale={0.95} />

        {/* Right side */}
        <BushBig cx={370} cy={118} scale={1.0} />
        <BushSmall cx={356} cy={172} scale={0.92} mirror />
        <BushBig cx={372} cy={230} scale={0.92} />
        <BushSmall cx={356} cy={290} scale={0.95} mirror />
        <BushBig cx={368} cy={348} scale={1.0} />
        <BushSmall cx={356} cy={420} scale={0.92} mirror />
        <BushBig cx={372} cy={476} scale={0.95} />

        {/* Bottom row */}
        <BushBig cx={56} cy={524} scale={1.05} />
        <BushSmall cx={108} cy={538} scale={1} mirror />
        <BushBig cx={150} cy={534} scale={0.92} />
        <BushSmall cx={196} cy={544} scale={0.95} />
        <BushBig cx={246} cy={534} scale={0.95} />
        <BushSmall cx={290} cy={542} scale={1} mirror />
        <BushBig cx={332} cy={528} scale={1.0} />
        <BushSmall cx={368} cy={544} scale={0.95} />

        {/* ═══ LAYER 9: lily pad clusters with pink lilies ═══ */}
        <LilyPadCluster cx={140} cy={188} variant={0} />
        <LilyPadCluster cx={278} cy={310} variant={1} />
        <LilyPadCluster cx={172} cy={486} variant={2} />

        {/* ═══ LAYER 10: bright grass tufts (foreground accent) ═══ */}
        {/* Inside shore — between bushes */}
        <GrassTuft cx={68} cy={110} scale={0.9} />
        <GrassTuft cx={56} cy={250} scale={1.0} />
        <GrassTuft cx={64} cy={380} scale={0.95} />
        <GrassTuft cx={78} cy={480} scale={1.0} />
        <GrassTuft cx={112} cy={64} scale={0.9} />
        <GrassTuft cx={188} cy={56} scale={0.85} />
        <GrassTuft cx={264} cy={62} scale={0.95} />
        <GrassTuft cx={342} cy={108} scale={0.9} />
        <GrassTuft cx={344} cy={252} scale={0.95} />
        <GrassTuft cx={344} cy={388} scale={1.0} />
        <GrassTuft cx={332} cy={482} scale={0.9} />
        <GrassTuft cx={216} cy={552} scale={0.95} />
        <GrassTuft cx={140} cy={558} scale={0.9} />
        <GrassTuft cx={278} cy={552} scale={1.0} />

        {/* in-water grass near edges */}
        <GrassTuft cx={104} cy={148} scale={0.7} />
        <GrassTuft cx={314} cy={158} scale={0.7} />
        <GrassTuft cx={92} cy={420} scale={0.65} />
        <GrassTuft cx={314} cy={426} scale={0.7} />
      </svg>
    </div>,
    mount,
  )
}
