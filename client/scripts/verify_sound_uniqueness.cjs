#!/usr/bin/env node
// Phase 8: verify_sound_uniqueness.cjs — реплицирует buildSoundSignature + refineSoundSeeds.
// Acceptance criterion: SPEC.md #3 — 1000/1000 unique sound signatures.
//
// Pipeline зеркалит production порядок:
//   1) refineTextureSeeds (mutation 0x85ebca6b)
//   2) refineAnimSeeds    (mutation 0x9e3779b9)
//   3) refineSoundSeeds   (mutation 0xc2b2ae3d)
//   4) refineTextureSeeds (Plan 06 stabilization — second pass)
// — потом финальный scan unique sound signatures.

const {
  mulberry32,
  loadPlanetMap,
  extractThemeComponents,
  allSystems,
  hashId,
} = require('./_shared.cjs')

const map = loadPlanetMap()
const THEME_COMPONENTS = extractThemeComponents()
const systems = allSystems(map)

const mainSeedOverride = new Map()

function getSeed(sys) {
  if (typeof sys.rngSeed === 'number') return sys.rngSeed
  const ovr = mainSeedOverride.get(sys.id)
  if (ovr !== undefined) return ovr
  return hashId(sys.id)
}

function setSeed(sys, newSeed) {
  if (sys._isMain) mainSeedOverride.set(sys.id, newSeed)
  else sys.rngSeed = newSeed
}

// ─── Texture signature (для texture refine) ───
function buildTextureSignature(bg) {
  const rng = mulberry32(bg.rngSeed)
  rng()
  const showAura =
    bg.archetype !== 'dead' && bg.archetype !== 'mineral' && bg.archetype !== 'desert'
  if (showAura) {
    rng(); rng()
    if (rng() < 0.3) rng()
  }
  rng(); rng(); rng(); rng()
  rng()
  const variant = Math.floor(rng() * 3)
  const c1 = Math.floor(rng() * 5)
  const c2 = Math.floor(rng() * 5)
  const c3 = Math.floor(rng() * 5)
  const surfaceLines = rng() < 0.15 ? 1 : 0
  const gradientBands = rng() < 0.12 ? 1 : 0
  const multiSpots = rng() < 0.15 ? 1 : 0
  const stackedRings = rng() < 0.08 ? 1 : 0
  const asym = rng() < 0.2 ? 1 : 0
  const speckle = rng() < 0.25 ? 1 : 0
  return `${bg.archetype}:v${variant}:c${c1}-${c2}-${c3}:m${surfaceLines}${gradientBands}${multiSpots}${stackedRings}${asym}${speckle}`
}

// ─── Anim signature ───
function quantize(value, thresholds) {
  let bestIdx = 0
  let bestDist = Math.abs(value - thresholds[0])
  for (let i = 1; i < thresholds.length; i++) {
    const d = Math.abs(value - thresholds[i])
    if (d < bestDist) { bestDist = d; bestIdx = i }
  }
  return bestIdx
}

function buildAnimSignature(sys) {
  const seed = getSeed(sys)
  const rng = mulberry32(seed)
  const theme = sys.archetype || sys.type
  const pool = THEME_COMPONENTS[theme] || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  const r1 = rng()
  const targetCount = r1 < 0.5 ? 2 : r1 < 0.85 ? 3 : 4
  const compCount = Math.min(targetCount, pool.length)
  const used = new Set()
  const components = []
  while (components.length < compCount) {
    const c = pool[Math.floor(rng() * pool.length)]
    if (!used.has(c)) { used.add(c); components.push(c) }
  }
  const useModifier = rng() < 0.25
  const modRotation = useModifier ? (rng() - 0.5) * Math.PI : 0
  const modScale = useModifier ? 0.7 + rng() * 0.6 : 1
  const rotationBin = useModifier
    ? quantize(modRotation, [-Math.PI / 2, -Math.PI / 4, Math.PI / 4, Math.PI / 2])
    : -1
  const scaleBin = useModifier
    ? quantize(modScale, [0.7, 0.85, 1.15, 1.3])
    : -1
  const hueBin = (seed >>> 5) & 0x7
  const delayBins = []
  for (let i = 1; i < components.length; i++) {
    const delay = Math.floor(rng() * 250) + 50
    let bin
    if (delay < 100) bin = 0
    else if (delay < 200) bin = 1
    else bin = 2
    delayBins.push(bin)
  }
  const compsKey = [...components].sort((a, b) => a - b).join(',')
  return `${compsKey}|m${useModifier ? 1 : 0}|r${rotationBin}|s${scaleBin}|h${hueBin}|d${delayBins.join(',')}|${theme}`
}

// ─── Sound signature (target — точная копия planetVoice.deriveModulations) ───
function deriveModulations(seed) {
  const rng = mulberry32(seed)
  return {
    pitchStep: Math.floor(rng() * 14),
    rotationIdx: Math.floor(rng() * 6),
    inversionIdx: Math.floor(rng() * 3),
    detuneBin: Math.floor(rng() * 4),
    cutoffBin: Math.floor(rng() * 4),
  }
}

function buildSoundSignature(sys) {
  const archetype = sys.archetype || sys.type
  const seed = getSeed(sys)
  const m = deriveModulations(seed)
  return `${archetype}|${m.pitchStep}|${m.rotationIdx}|${m.inversionIdx}|${m.detuneBin}|${m.cutoffBin}`
}

// ─── Refine passes ───
function refineTextureSeeds() {
  const sigs = new Map()
  for (const sys of systems) {
    if (sys._isMain) continue
    let attempt = 0
    let sig = buildTextureSignature(sys)
    while (sigs.has(sig) && attempt < 10) {
      sys.rngSeed = (sys.rngSeed ^ ((attempt + 1) * 0x85ebca6b)) >>> 0
      sig = buildTextureSignature(sys)
      attempt++
    }
    sigs.set(sig, sys.id)
  }
}

function refineAnimSeeds() {
  const sigs = new Map()
  for (const sys of systems) {
    let attempt = 0
    let sig = buildAnimSignature(sys)
    while (sigs.has(sig) && attempt < 10) {
      const cur = getSeed(sys)
      const newSeed = (cur ^ ((attempt + 1) * 0x9e3779b9)) >>> 0
      setSeed(sys, newSeed)
      sig = buildAnimSignature(sys)
      attempt++
    }
    sigs.set(sig, sys.id)
  }
}

function refineSoundSeeds() {
  const sigs = new Map()
  let conflicts = 0
  for (const sys of systems) {
    let attempt = 0
    let sig = buildSoundSignature(sys)
    while (sigs.has(sig) && attempt < 10) {
      const cur = getSeed(sys)
      const newSeed = (cur ^ ((attempt + 1) * 0xc2b2ae3d)) >>> 0
      setSeed(sys, newSeed)
      sig = buildSoundSignature(sys)
      attempt++
      if (attempt === 10 && sigs.has(sig)) conflicts++
    }
    sigs.set(sig, sys.id)
  }
  return conflicts
}

// ─── Initial scan для отчёта ───
const initialSigs = new Map()
const initialPerArchetype = {}
for (const sys of systems) {
  const sig = buildSoundSignature(sys)
  const arch = sys.archetype || sys.type
  if (!initialPerArchetype[arch]) initialPerArchetype[arch] = new Set()
  initialPerArchetype[arch].add(sig)
  if (!initialSigs.has(sig)) initialSigs.set(sig, sys.id)
}
console.log(`[sound] initial: ${initialSigs.size}/${systems.length} unique signatures (pre-refine)`)

// ─── Run pipeline (texture → anim → sound → texture-stabilize) ───
refineTextureSeeds()
refineAnimSeeds()
const refineConflicts = refineSoundSeeds()
refineTextureSeeds() // Plan 06 stabilization

// ─── Final scan: проверяем uniqueness sound signatures на финальных seed ───
const finalSigs = new Map()
const collisions = new Map()
const perArchetype = {}

for (const sys of systems) {
  const sig = buildSoundSignature(sys)
  const arch = sys.archetype || sys.type
  if (!perArchetype[arch]) perArchetype[arch] = new Set()
  perArchetype[arch].add(sig)
  if (finalSigs.has(sig)) {
    if (!collisions.has(sig)) collisions.set(sig, [finalSigs.get(sig)])
    collisions.get(sig).push(sys.id)
  } else {
    finalSigs.set(sig, sys.id)
  }
}

const total = systems.length
const unique = finalSigs.size
console.log(`[sound] ${unique}/${total} unique sound signatures after full pipeline (${refineConflicts} unresolved during sound refine)`)

if (collisions.size > 0) {
  console.log(`Collisions (top 5):`)
  for (const [sig, ids] of [...collisions.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5)) {
    console.log(`  ${ids.length}x ${sig} → [${ids.slice(0, 3).join(', ')}${ids.length > 3 ? ', ...' : ''}]`)
  }
} else {
  console.log(`OK — no collisions`)
}

console.log(`Per archetype/type unique (final, out of 4032 possible):`)
for (const k of Object.keys(perArchetype).sort()) {
  console.log(`  ${k}: ${perArchetype[k].size} unique`)
}

process.exit(unique === total && refineConflicts === 0 ? 0 : 1)
