import type { ShipStats } from './types'

// ──────────────────────────────────────────────────────────────────────────
// Expedition tuning. All gameplay knobs live here — balance by editing these,
// not the engine. See docs/expedition.md "Балансировка".
// ──────────────────────────────────────────────────────────────────────────

export interface ExpeditionConfig {
  // REAL pacing: how many real seconds pass per journal beat. Demo = fast,
  // prod = a beat per real minute. Drives how fast the log fills + risk.
  tickIntervalSec: number
  // FICTION pacing: how much the *displayed* clock (ЧЧ:ММ) advances per beat.
  // ~45s → beats land ~1 journal-minute apart, 1-3 lines per minute (FS look).
  // Independent of real time, so the journal reads the same at any tempo.
  fictionGapSec: number
  returnSpeedMultiplier: number // return leg = outbound / this (player asked: 3x)
  returnRiskFactor: number // catastrophe chance on the return leg, ×normal (0.25 = 75% safer)
  maxOutboundSec: number // hard cap on how far a ship may travel out

  // Per-ship concurrency. v1 grants `base`; upgrades raise toward `max`.
  ships: { base: number; max: number }

  // Ship health. maxHp = baseHp + hpPerFrog × (лягушек во флоте). v1 fleet=0,
  // so maxHp = baseHp (100). HP is full while alive, 0 if the ship is lost.
  baseHp: number
  hpPerFrog: number

  // Loot yields, applied per tick (scaled by ship stats + scenario rolls).
  goldPerTickBase: number
  serumChancePerTick: number // base chance a tick drops a serum
  // Авто-левелинг золота к доходу: gold события = flat × incomePerSec × этот коэф.
  // Так награда растёт с прогрессом игрока, но за полёт суммарно меньше чистого idle.
  // flat-числа сценариев трактуются как «вес» (≈ income-секунды × 100).
  goldIncomeRate: number

  // Risk model — "recall in time". No danger early; risk ramps after.
  riskFreeSec: number // grace window with zero risk
  riskRampSec: number // after grace, risk climbs to max over this span
  catastrophePerTickMax: number // (legacy) peak per-tick instant-loss chance — больше не используется
  dmgPerTickMax: number // (legacy) peak HP-урон за бит — больше не используется (урон теперь только от hazard-событий)
  // Урон наносят ТОЛЬКО hazard-события. Каждое бьёт на ПЛОСКИЙ урон в диапазоне
  // [hazardDmgMin .. hazardDmgMax] × текущий риск (× hull-резист). Плоский (не
  // доля maxHp) — поэтому больше HP / экипаж реально продлевают жизнь.
  // Кап hazardHitMaxFrac×maxHp — анти-ваншот: одно событие не снимает больше
  // этой доли (минимум 1/maxFrac событий до гибели). Гибель только при HP=0.
  hazardDmgMin: number
  hazardDmgMax: number
  hazardHitMaxFrac: number
  // 2026-05-28: нерф дропа сывороток/мутагена в экспедициях. Каждое loot-event
  // с серумом/мутагеном проходит через roll: < multiplier → keep; else skip.
  // Целевые ставки: 1 сыворотка/50-75 мин, 1 мутаген/110-180 мин.
  serumDropMultiplier: number
  mutagenDropMultiplier: number
}

// Production tempo: hour-scale idle, FS-style.
export const EXPEDITION_CONFIG: ExpeditionConfig = {
  tickIntervalSec: 60,
  fictionGapSec: 60,
  returnSpeedMultiplier: 3,
  returnRiskFactor: 0.25,
  maxOutboundSec: 8 * 3600,
  ships: { base: 3, max: 3 },
  baseHp: 100,
  hpPerFrog: 25,
  // Пассивный доход выключен (0): весь лут идёт только из событий журнала,
  // чтобы каждое пополнение инвентаря сопровождалось строкой «+N» в рапорте.
  goldPerTickBase: 0,
  serumChancePerTick: 0,
  // gold = flat × incomePerSec × 0.16 → событие flat:250 ≈ 40 income-секунд.
  // За полёт ~3-5 событий ≈ 30% дохода за то же время: заметно, но < чистого idle.
  goldIncomeRate: 0.16,
  riskFreeSec: 45 * 60,
  riskRampSec: 150 * 60,
  catastrophePerTickMax: 0.04,
  dmgPerTickMax: 14,
  // При полном риске hazard бьёт на 4..11 HP (плоско). База maxHp=125 (1 лягушка)
  // → ~16-30 hazard-событий до гибели; с экипажем/корпусом HP больше → дольше.
  // Кап 0.5×maxHp — анти-ваншот.
  hazardDmgMin: 4,
  hazardDmgMax: 11,
  hazardHitMaxFrac: 0.5,
  // 2026-05-28: 12 сывороток + 3 мутагена за 3ч ломали баланс. Нерф 0.25/0.4.
  serumDropMultiplier: 0.25,
  mutagenDropMultiplier: 0.4,
}

// Demo/test tempo: minute-scale so a full arc runs in seconds.
export const DEMO_CONFIG: ExpeditionConfig = {
  ...EXPEDITION_CONFIG,
  tickIntervalSec: 2,
  maxOutboundSec: 20 * 60,
  riskFreeSec: 60,
  riskRampSec: 120,
}

export const DEFAULT_SHIP_STATS: ShipStats = {
  speed: 1,
  luck: 1,
  cargo: 1,
  hull: 0,
}

// ── Per-ship upgrades (bought for gold, server-validated) ───────────────────
// Player-facing stats; each level раскачивается отдельно на каждом корабле.
export type ShipUpgKey = 'corpus' | 'armor' | 'engine' | 'scanner'

export interface ShipUpg {
  corpus: number // ❤️ Корпус → max HP
  armor: number // 🛡 Броня → ↓ урон/риск
  engine: number // ⚡ Двигатель → ↑ золото/темп
  scanner: number // 🍀 Сканер → ↑ сыворотка/редкие находки
}

export const SHIP_UPG_MAX = 5
// Цены малые → растут (старт 50k, ×4 за уровень). costs[i] = i→i+1.
export const SHIP_UPG_COSTS: readonly number[] = [
  50_000, 200_000, 800_000, 3_200_000, 12_800_000,
]

export const SHIP_UPG_KEYS: readonly ShipUpgKey[] = [
  'corpus',
  'armor',
  'engine',
  'scanner',
]

export function emptyShipUpg(): ShipUpg {
  return { corpus: 0, armor: 0, engine: 0, scanner: 0 }
}

export function shipUpgCost(currentLevel: number): number {
  return SHIP_UPG_COSTS[currentLevel] ?? Infinity
}

// Derive sim stats + maxHp from a ship's upgrade levels.
export function deriveShip(upg: ShipUpg): { stats: ShipStats; maxHp: number } {
  return {
    stats: {
      speed: 1 + upg.engine * 0.25,
      luck: 1 + upg.scanner * 0.3,
      cargo: 1,
      hull: Math.min(0.6, upg.armor * 0.12), // catastrophe/damage reduction
    },
    maxHp: 100 + upg.corpus * 40,
  }
}

// Risk at a given travel time, 0..1. Drives both catastrophe rolls and the
// warning lines shown to the player (so they know to recall).
export function riskAt(sec: number, cfg: ExpeditionConfig): number {
  if (sec <= cfg.riskFreeSec) return 0
  const t = (sec - cfg.riskFreeSec) / cfg.riskRampSec
  return Math.max(0, Math.min(1, t))
}
