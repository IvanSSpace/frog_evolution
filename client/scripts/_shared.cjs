// Phase 8: shared helpers для verify_*_uniqueness.cjs.
// Все 3 verifier'а (anim/texture/sound) реплицируют RNG + signature logic
// из StarMapScene.ts. Этот файл — single source of truth для общих helpers,
// чтобы избежать дрифта между verifier'ами и production кодом.

const fs = require('fs')
const path = require('path')

// Точная копия StarMapScene.ts:72-81 (mulberry32 PRNG).
// Использует signed-arith внутри (как в source) — критично для воспроизводимости
// порядка rng() calls.
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Копия StarMapScene.ts:2952-2956 (hashId).
function hashId(id) {
  let h = 5381
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0
  return h
}

// Загружает planetMap.json из стандартного location.
// Структура: { generatedAt, meta: {...}, planets: [...] }
// Каждая планета имеет kind: 'main' | 'bg'.
function loadPlanetMap() {
  const p = path.resolve(__dirname, '../src/game/data/planetMap.json')
  const raw = fs.readFileSync(p, 'utf8')
  return JSON.parse(raw)
}

// Извлекает THEME_COMPONENTS Record из StarMapScene.ts.
// Парсит блок `private readonly THEME_COMPONENTS: Record<string, number[]> = { ... }`.
// Гарантирует что verifier всегда работает с актуальным state кода (не stale копией).
function extractThemeComponents() {
  const p = path.resolve(__dirname, '../src/game/scenes/StarMapScene.ts')
  const src = fs.readFileSync(p, 'utf8')
  const m = src.match(
    /THEME_COMPONENTS:\s*Record<string,\s*number\[\]>\s*=\s*\{([\s\S]*?)\n\s*\}/,
  )
  if (!m) throw new Error('THEME_COMPONENTS not found in StarMapScene.ts')
  const body = m[1]
  const result = {}
  const lineRe = /^\s*([a-z_]+):\s*\[([^\]]+)\]/gm
  let mm
  while ((mm = lineRe.exec(body)) !== null) {
    result[mm[1]] = mm[2]
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n))
  }
  return result
}

// effectiveSeed для verifier-логики (без mainSeedOverride — verifier работает на static
// snapshot, до runtime refine). Для main races без rngSeed → hashId.
// Сам verifier симулирует refine через mutation seed внутри _isMain объектов
// (в `verify_*` каждый держит локальный override map).
function effectiveSeed(sys) {
  if (typeof sys.rngSeed === 'number') return sys.rngSeed
  return hashId(sys.id)
}

// Возвращает все системы (main + bg) flat.
// Помечает _isMain для удобства downstream verifier'ов (texture filters BG-only).
function allSystems(map) {
  const planets = map.planets || []
  return planets.map((p) => ({ ...p, _isMain: p.kind === 'main' }))
}

module.exports = {
  mulberry32,
  hashId,
  loadPlanetMap,
  extractThemeComponents,
  effectiveSeed,
  allSystems,
}
