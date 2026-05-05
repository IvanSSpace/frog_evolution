// Каждый уровень — свой SVG, имя, размер, цена покупки, темп роста цены, шансы какашек, тинт
interface PoopChances {
  regular: number  // обычная (1 монета)
  big: number      // большая (10 монет)
  huge: number     // огромная (100 монет)
}

interface FrogLevelConfig {
  path: string
  name: string         // имя вида
  size: number         // множитель относительно базовых 50×47 CSS-px
  basePrice: number    // цена первой покупки
  growthRate: number   // мультипликатор цены за каждую купленную лягушку этого уровня
  poopChances: PoopChances
  tint: number         // мягкий тинт (Phaser hex), близко к белому
}

// Стоимости разных типов какашек (фикс)
export const POOP_VALUES = {
  regular: 1,
  big: 10,
  huge: 100,
} as const

export type PoopType = keyof typeof POOP_VALUES

// Интервал какания одинаковый для всех (фикс)
export const POOP_INTERVAL_MS = 1700

// Целевой доход в секунду на лягушку — точные значения, заданные продюсером.
// Визуальные шансы какашек (poopChances) определяют только спрайт и цвет,
// сама сумма приходит от этой таблицы через stochasticRound.
export const TARGET_INCOME_PER_SEC: readonly number[] = [
  0.5,   // L1 Фрогги
  1.5,   // L2 Фрог
  4,     // L3 Кваключка
  9.5,   // L4 Шипоквак
  21,    // L5 Квакус
  44.5,  // L6 Квакер
  92,    // L7 Квакозавр
]

export function getTargetIncomePerSec(level: number): number {
  return TARGET_INCOME_PER_SEC[Math.min(level - 1, TARGET_INCOME_PER_SEC.length - 1)] ?? 0
}

// Сколько монет должна принести одна какашка в среднем (= target × interval секунд)
export function getPoopValueExact(level: number): number {
  return getTargetIncomePerSec(level) * (POOP_INTERVAL_MS / 1000)
}

// Стохастическое округление: для x=0.85 → 1 с вероятностью 85%, иначе 0.
// Среднее за много тиков точно равно x, а каждый тик — целое число.
export function stochasticRound(x: number): number {
  const floor = Math.floor(x)
  return floor + (Math.random() < x - floor ? 1 : 0)
}

// poopChances подобраны так, чтобы средний доход в секунду на лягушку
// соответствовал целям: L1=0.5, L2=1.5, L3=4, L4=9.5, L5=21, L6=44.5, L7=92.
// L1 минимум = 0.59/сек (всегда regular = 1, не меньше), L7 максимум = 58.82/сек
// (всегда huge = 100). Эти потолки/полы дают ограничения на крайние уровни.
export const FROG_LEVELS: readonly FrogLevelConfig[] = [
  { path: '/frogs_svg/frog1.svg', name: 'Фрогги',     size: 0.8, basePrice: 500,    growthRate: 1.15, tint: 0xdef2cb, poopChances: { regular: 1.000, big: 0.000, huge: 0.000 } }, // 0.59/сек (мин)
  { path: '/frogs_svg/frog2.svg', name: 'Фрог',       size: 1.1, basePrice: 1_200,  growthRate: 1.20, tint: 0xd0f0c0, poopChances: { regular: 0.830, big: 0.170, huge: 0.000 } }, // 1.49/сек ≈ 1.5
  { path: '/frogs_svg/frog3.svg', name: 'Кваключка',  size: 1.4, basePrice: 2_900,  growthRate: 1.18, tint: 0xe5e8a8, poopChances: { regular: 0.360, big: 0.640, huge: 0.000 } }, // 3.98/сек ≈ 4
  { path: '/frogs_svg/frog4.svg', name: 'Шипоквак',   size: 1.6, basePrice: 7_000,  growthRate: 1.17, tint: 0xb8d8a8, poopChances: { regular: 0.050, big: 0.875, huge: 0.075 } }, // 9.59/сек ≈ 9.5
  { path: '/frogs_svg/frog5.svg', name: 'Квакус',     size: 1.6, basePrice: 17_000, growthRate: 1.16, tint: 0xa8d8b8, poopChances: { regular: 0.050, big: 0.660, huge: 0.290 } }, // 20.97/сек ≈ 21
  { path: '/frogs_svg/frog6.svg', name: 'Квакер',     size: 1.6, basePrice: 40_000, growthRate: 1.15, tint: 0xb8e0d0, poopChances: { regular: 0.050, big: 0.215, huge: 0.735 } }, // 44.53/сек ≈ 44.5
  { path: '/frogs_svg/frog7.svg', name: 'Квакозавр',  size: 1.9, basePrice: 96_000, growthRate: 1.15, tint: 0x90c898, poopChances: { regular: 0.000, big: 0.000, huge: 1.000 } }, // 58.82/сек (макс)
]

export const MAX_LEVEL = FROG_LEVELS.length

export const textureKeyForLevel = (level: number): string => `frog_lvl_${level}`

export const configForLevel = (level: number): FrogLevelConfig =>
  FROG_LEVELS[Math.min(level - 1, FROG_LEVELS.length - 1)]

export function getFrogPrice(level: number, purchases: number): number {
  const cfg = configForLevel(level)
  return Math.floor(cfg.basePrice * Math.pow(cfg.growthRate, purchases))
}

// Случайно выбрать тип какашки по таблице шансов
export function rollPoopType(level: number): PoopType {
  const c = configForLevel(level).poopChances
  const r = Math.random()
  if (r < c.regular) return 'regular'
  if (r < c.regular + c.big) return 'big'
  return 'huge'
}

// Средний доход за пук на уровне (для UI) — выводится из точной цели в секунду
export function avgIncomePerPoop(level: number): number {
  return getPoopValueExact(level)
}
