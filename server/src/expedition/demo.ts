// Determinism demo + sample journal. No test framework needed.
//   npx ts-node src/expedition/demo.ts
// Exits non-zero if any invariant breaks.

import { simulate } from './engine'
import { DEMO_CONFIG, DEFAULT_SHIP_STATS } from './config'
import { toPlainText } from './render'
import { SCENARIOS } from './content'
import type { SimulateParams } from './types'

let failures = 0
function check(name: string, ok: boolean) {
  console.log(`${ok ? '✅' : '❌'} ${name}`)
  if (!ok) failures++
}

const base: SimulateParams = {
  seed: 1337,
  shipStats: DEFAULT_SHIP_STATS,
  outboundSec: 8 * 60, // 8 min out
  recalled: true,
}

// 1. Same inputs → byte-identical output.
const a = simulate(base, DEMO_CONFIG)
const b = simulate(base, DEMO_CONFIG)
check('determinism: same seed → identical result', JSON.stringify(a) === JSON.stringify(b))

// 2. Different seed → different journey (overwhelmingly likely).
const c = simulate({ ...base, seed: 4242 }, DEMO_CONFIG)
check('variation: different seed → different log', JSON.stringify(a.log) !== JSON.stringify(c.log))

// 3. Loot is monotonic in outbound time (longer trip ≥ shorter trip), barring loss.
const short = simulate({ ...base, outboundSec: 2 * 60, recalled: false }, DEMO_CONFIG)
const long = simulate({ ...base, outboundSec: 6 * 60, recalled: false }, DEMO_CONFIG)
check(
  'monotonic loot: longer outbound ≥ shorter (no loss)',
  short.shipLost || long.shipLost || long.loot.gold >= short.loot.gold,
)

// 4. Log timestamps are non-decreasing.
const sorted = a.log.every((l, i) => i === 0 || l.t >= a.log[i - 1].t)
check('ordering: timestamps non-decreasing', sorted)

// 5. Lost ship forfeits all loot.
//    Push far past the risk window with a seed that triggers catastrophe.
let lostFound = false
for (let s = 1; s <= 200 && !lostFound; s++) {
  const r = simulate(
    { seed: s, shipStats: DEFAULT_SHIP_STATS, outboundSec: 18 * 60, recalled: true },
    DEMO_CONFIG,
  )
  if (r.shipLost) {
    lostFound = true
    check('loss: forfeits loot', r.loot.gold === 0)
  }
}
check('loss: at least one seed triggers catastrophe in deep space', lostFound)

// 6. Continuity: a combat reaction never appears before a combat trigger.
// Маркеры выводятся ИЗ КОНТЕНТА (не хардкод), чтобы генеративные сценарии
// автоматически учитывались. Берём статический префикс первой строки до
// первого {токена} — он стабилен после подстановки в лог.
const staticPrefix = (text: string) => {
  const head = text.split('{')[0].trim().replace(/[.!?…,]+$/, '')
  return head
}
// Триггеры боя = первые строки сценариев с set:['combat'] (префиксы ≥6 симв.).
const TRIGGERS = Array.from(
  new Set(
    SCENARIOS.filter((s) => (s.set ?? []).includes('combat'))
      .map((s) => staticPrefix(s.lines[0].text))
      .filter((p) => p.length >= 6),
  ),
)
// Реакции боя = первые строки сценариев с needs==='combat'.
const REACTIONS = Array.from(
  new Set(
    SCENARIOS.filter((s) => s.needs === 'combat').map((s) =>
      staticPrefix(s.lines[0].text),
    ),
  ),
)
let continuityOk = true
let sawReaction = false
for (let s = 1; s <= 120; s++) {
  const r = simulate(
    { seed: s, shipStats: DEFAULT_SHIP_STATS, outboundSec: 12 * 60, recalled: false },
    DEMO_CONFIG,
  )
  for (let i = 0; i < r.log.length; i++) {
    if (REACTIONS.some((m) => r.log[i].text.includes(m))) {
      sawReaction = true
      const triggerBefore = r.log
        .slice(0, i)
        .some((l) => TRIGGERS.some((m) => l.text.includes(m)))
      if (!triggerBefore) continuityOk = false
    }
  }
}
check('continuity: combat reactions only follow a combat trigger', continuityOk)
check('continuity: combat reactions actually fire across seeds', sawReaction)

const sample = simulate(
  { seed: 1337, shipStats: DEFAULT_SHIP_STATS, outboundSec: 30, recalled: true },
  DEMO_CONFIG,
)
console.log('\n──────── SAMPLE JOURNAL (ЧЧ:ММ, recalled) ────────\n')
console.log(toPlainText(sample))

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
