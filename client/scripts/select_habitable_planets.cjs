// Phase 26 Plan 26-02: Habitable planet selection (one-time reproducible script).
//
// Selects 30 of 350 planets from planetMap.json и attaches `inhabitant: {raceId, role}`.
// Distribution: 1 home + 2 colonies × 10 races = 30 unique IDs.
//
// Algorithm (deterministic, seed-based — per Plan 26-02 CONTEXT D-DeterministicSeed):
//   1. Seed = 19450718 (planetMap.json meta.seed + 11 — derivative для cross-distinction).
//   2. Mulberry32 PRNG (simple 32-bit, well-known sequence).
//   3. Race order — фиксирован: RACE_ORDER (canonical order из 26-CONTEXT.md table).
//   4. Affinity mapping: each race → archetype Element (см. config/races.ts).
//   5. Для each race in order:
//        a. Find planets where planet.type === race.affinity (matching pool).
//        b. Exclude planet.id === 'home' (player base) и already-assigned planets.
//        c. Если matching pool >= 3 → shuffle PRNG'ом, take first 3.
//        d. Если matching pool < 3 → take all matching as candidates; добрать random
//           из unassigned non-'home' pool до 3.
//        e. First selected = home, оставшиеся 2 = colonies.
//        f. Sort 2 colonies по distFromHome ASC (colonies ближе к home — визуально логично).
//   6. Validate: 30 unique IDs, 10 home + 20 colonies, каждая race = 3 planets,
//      'home' planet (id='home') не assigned, остальные 320 planets без inhabitant.
//
// Reproducibility:
//   $ node client/scripts/select_habitable_planets.cjs
//   → читает client/src/game/data/planetMap.json,
//     in-place patches `inhabitant` поле на 30 entries,
//     записывает обратно (preserve formatting), prints summary.
//   Repeat runs дают identical output (seed deterministic, race order fixed).

'use strict'

const fs = require('fs')
const path = require('path')

const PLANET_MAP_PATH = path.join(
  __dirname,
  '..',
  'src',
  'game',
  'data',
  'planetMap.json'
)

// === Constants (must match config/races.ts canonical order) ===

const SEED = 19450718 // planetMap.json meta.seed (19450707) + 11 derivative

// Каноническая порядок 10 рас. Должна совпадать с RACES в config/races.ts.
const RACE_ORDER = [
  { id: 'crystalloids', affinity: 'crystal' },
  { id: 'gasouls', affinity: 'gas' },
  { id: 'mechanidons', affinity: 'mechanical' },
  { id: 'fireworms', affinity: 'fire' },
  { id: 'liquidoids', affinity: 'water' },
  { id: 'tenebrians', affinity: 'shadow' },
  { id: 'plasmaspirits', affinity: 'plasma' },
  { id: 'forestcores', affinity: 'forest' },
  { id: 'timeweavers', affinity: 'void' },
  { id: 'cometfolk', affinity: 'binary' },
]

// === PRNG (Mulberry32 — 32-bit seedable, well-known sequence) ===

function makeMulberry32(seed) {
  let state = seed >>> 0
  return function () {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Fisher-Yates shuffle (returns NEW array, original untouched).
function shuffle(arr, rng) {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// === Selection ===

function selectHabitable(planetMap) {
  const rng = makeMulberry32(SEED)
  const planets = planetMap.planets
  const assigned = new Set() // planet.id'ы которые уже взяты
  const assignments = [] // {planetId, raceId, role}
  const stats = { affinityMatched: 0, fallback: 0 }

  for (const race of RACE_ORDER) {
    // Step a-b: matching pool (type === affinity, не 'home', не assigned)
    const matching = planets.filter(
      (p) =>
        p.type === race.affinity && p.id !== 'home' && !assigned.has(p.id)
    )

    let chosen = []
    if (matching.length >= 3) {
      // c: shuffle + take 3
      chosen = shuffle(matching, rng).slice(0, 3)
      stats.affinityMatched += 1
    } else {
      // d: take all matching + добрать random'ом из unassigned non-'home'
      chosen = matching.slice() // 0..matching.length
      const pool = planets.filter(
        (p) =>
          p.id !== 'home' &&
          !assigned.has(p.id) &&
          !chosen.includes(p)
      )
      const shuffledPool = shuffle(pool, rng)
      while (chosen.length < 3) {
        const next = shuffledPool.shift()
        if (!next) {
          throw new Error(
            `Cannot find 3 planets for race ${race.id} — pool exhausted`
          )
        }
        chosen.push(next)
      }
      stats.fallback += 1
    }

    // e: first = home, остальные 2 = colonies
    // f: sort 2 colonies by distFromHome ASC (colonies ближе к home расы)
    const homePlanet = chosen[0]
    const colonyCandidates = chosen.slice(1)
    colonyCandidates.sort((a, b) => a.distFromHome - b.distFromHome)
    const colonies = colonyCandidates

    assignments.push({
      planetId: homePlanet.id,
      raceId: race.id,
      role: 'home',
    })
    assigned.add(homePlanet.id)
    for (const c of colonies) {
      assignments.push({
        planetId: c.id,
        raceId: race.id,
        role: 'colony',
      })
      assigned.add(c.id)
    }
  }

  return { assignments, stats }
}

// === Apply assignments → planetMap.planets ===

function applyAssignments(planetMap, assignments) {
  const byId = new Map(planetMap.planets.map((p) => [p.id, p]))
  for (const a of assignments) {
    const p = byId.get(a.planetId)
    if (!p) throw new Error(`Planet ${a.planetId} not found`)
    p.inhabitant = { raceId: a.raceId, role: a.role }
  }
}

// === Validation ===

function validate(planetMap) {
  const inhabited = planetMap.planets.filter((p) => p.inhabitant !== undefined)
  if (inhabited.length !== 30)
    throw new Error(`expected 30 inhabited, got ${inhabited.length}`)

  const homes = inhabited.filter((p) => p.inhabitant.role === 'home')
  const colonies = inhabited.filter((p) => p.inhabitant.role === 'colony')
  if (homes.length !== 10)
    throw new Error(`expected 10 homes, got ${homes.length}`)
  if (colonies.length !== 20)
    throw new Error(`expected 20 colonies, got ${colonies.length}`)

  const byRace = new Map()
  for (const p of inhabited) {
    const r = p.inhabitant.raceId
    byRace.set(r, (byRace.get(r) || 0) + 1)
  }
  if (byRace.size !== 10)
    throw new Error(`expected 10 races covered, got ${byRace.size}`)
  for (const [race, count] of byRace.entries()) {
    if (count !== 3)
      throw new Error(`race ${race} has ${count} planets (expected 3)`)
  }

  const ids = inhabited.map((p) => p.id)
  if (new Set(ids).size !== 30)
    throw new Error(`30 inhabited planet IDs must be unique`)

  const playerHome = planetMap.planets.find((p) => p.id === 'home')
  if (playerHome && playerHome.inhabitant)
    throw new Error(`player home planet (id='home') must never be inhabitant`)

  if (planetMap.planets.length !== 350)
    throw new Error(
      `total planet count changed to ${planetMap.planets.length} (expected 350)`
    )
}

// === Main ===

function main() {
  const raw = fs.readFileSync(PLANET_MAP_PATH, 'utf8')
  const planetMap = JSON.parse(raw)

  // Очищаем любые pre-existing inhabitant поля (для re-run idempotency).
  for (const p of planetMap.planets) {
    if (p.inhabitant !== undefined) delete p.inhabitant
  }

  const { assignments, stats } = selectHabitable(planetMap)
  applyAssignments(planetMap, assignments)
  validate(planetMap)

  // Write back с trailing newline. JSON.stringify(..., null, 2) сохраняет
  // existing 2-space indentation. Поле `inhabitant` будет последним в записи
  // (preserve relative order остальных fields).
  const out = JSON.stringify(planetMap, null, 2) + '\n'
  fs.writeFileSync(PLANET_MAP_PATH, out, 'utf8')

  // Summary
  console.log(`Habitable planet selection (seed=${SEED}):`)
  console.log(`  affinity-matched races: ${stats.affinityMatched}/10`)
  console.log(`  fallback races         : ${stats.fallback}/10`)
  console.log(`  total inhabited planets: 30 (10 home + 20 colonies)`)
  console.log(``)
  console.log(`Per-race summary:`)
  for (const race of RACE_ORDER) {
    const raceAssigns = assignments.filter((a) => a.raceId === race.id)
    const home = raceAssigns.find((a) => a.role === 'home')
    const cols = raceAssigns.filter((a) => a.role === 'colony')
    console.log(
      `  ${race.id.padEnd(14)} affinity=${race.affinity.padEnd(11)} home=${home.planetId.padEnd(10)} colonies=[${cols.map((c) => c.planetId).join(', ')}]`
    )
  }
}

main()
