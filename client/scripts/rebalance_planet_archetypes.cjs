// Rebalance planet archetypes → ~равномерное распределение по 12 типам.
//
// Зачем: было desert=6, dead=38 (перекос). Юзер хочет всех видов +- поровну.
// Что делает: среди 334 bg-планет (kind:bg, есть archetype) переназначает
// archetype так, чтобы каждый из 12 типов имел ~28 планет. При смене типа
// копирует color/accent/brightness из планеты-донора того же НОВОГО типа
// (палитра в рендере зависит от archetype — иначе LOD-точка не совпадёт).
//
// Детерминировано: планеты сортируются по id, донор берётся по счётчику.
// Не трогает: x/y/size/rngSeed/type/kind/inhabitant/position, 16 main-планет.
//
// Запуск: node scripts/rebalance_planet_archetypes.cjs

const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '../src/game/data/planetMap.json')

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const planets = data.planets

// Индексы bg-планет с archetype (детерминированный порядок по id).
const bgIdx = planets
  .map((p, i) => ({ p, i }))
  .filter((e) => e.p.archetype)
  .sort((a, b) => String(a.p.id).localeCompare(String(b.p.id)))
  .map((e) => e.i)

const archetypes = [
  ...new Set(bgIdx.map((i) => planets[i].archetype)),
].sort()

// Палитры-доноры по текущему типу (color/accent/brightness).
const donors = {}
for (const a of archetypes) donors[a] = []
for (const i of bgIdx) {
  const p = planets[i]
  donors[p.archetype].push({
    color: p.color,
    accent: p.accent,
    brightness: p.brightness,
  })
}

// Целевые количества: base = floor(N/12), остаток раскидываем по первым типам.
const N = bgIdx.length
const base = Math.floor(N / archetypes.length)
let rem = N - base * archetypes.length
const target = {}
for (const a of archetypes) {
  target[a] = base + (rem > 0 ? 1 : 0)
  if (rem > 0) rem--
}

// Назначение: проходим планеты по порядку, заполняем типы до target.
const assignOrder = []
for (const a of archetypes) {
  for (let k = 0; k < target[a]; k++) assignOrder.push(a)
}

const donorCounter = {}
for (const a of archetypes) donorCounter[a] = 0

const before = {}
for (const i of bgIdx) before[planets[i].archetype] = (before[planets[i].archetype] || 0) + 1

bgIdx.forEach((planetIndex, k) => {
  const a = assignOrder[k]
  const p = planets[planetIndex]
  p.archetype = a
  // Палитра под новый тип — циклически из доноров.
  const pool = donors[a]
  const donor = pool[donorCounter[a] % pool.length]
  donorCounter[a]++
  p.color = donor.color
  p.accent = donor.accent
  if (typeof donor.brightness === 'number') p.brightness = donor.brightness
})

const after = {}
for (const i of bgIdx) after[planets[i].archetype] = (after[planets[i].archetype] || 0) + 1

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')

console.log('Planets rebalanced:', N, 'bg planets across', archetypes.length, 'archetypes')
console.log('Before:', before)
console.log('After:', after)
