// Каждый уровень — свой SVG, имя, размер, цена покупки, темп роста цены, шансы какашек, тинт, локация
interface PoopChances {
  regular: number // обычная (1 монета)
  big: number // большая (10 монет)
  huge: number // огромная (100 монет)
}

interface FrogLevelConfig {
  path: string
  name: string // имя вида
  size: number // множитель относительно базовых 50×47 CSS-px
  basePrice: number // цена первой покупки (формула: 560 × 2.8^(T-1))
  growthRate: number // мультипликатор цены за каждую купленную (всегда 1.15)
  poopChances: PoopChances
  tint: number // тинт (Phaser hex)
  location: number // 1=Болото, 2=Лес, 3=Земля, 4=Космос
  availableInShop: boolean // true = можно купить за монеты; false = только через мерджи (L19+)
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

// Целевой доход в секунду на лягушку — официальная экономика.
// L19+ имеют одинаковый доход (cap). L19+ нельзя купить в магазине, только через мерджи.
export const TARGET_INCOME_PER_SEC: readonly number[] = [
  // Болото (L1-6)
  0.5, 1.5, 4.0, 9.5, 21.0, 44.5,
  // Лес (L7-12)
  92.0, 187.5, 379.0, 762.5, 1530.0, 3065.5,
  // Земля (L13-18)
  6137.0, 12280.5, 24568.0, 49143.5, 98295.0, 196598.5,
  // Космос (L19-24) — все одинаковые (cap)
  393206.0, 393206.0, 393206.0, 393206.0, 393206.0, 393206.0,
]

export function getTargetIncomePerSec(level: number): number {
  return (
    TARGET_INCOME_PER_SEC[
      Math.min(level - 1, TARGET_INCOME_PER_SEC.length - 1)
    ] ?? 0
  )
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

// L1-L6 имеют свои SVG. L7+ пока используют frog1.svg как placeholder
// (отличаются tint'ом). При появлении реальных SVG — заменить path.
const PLACEHOLDER = '/frogs_svg/frog1.svg'

// Ставки в общих poopChances для L7+ — много "огромных", redfер ярче
const HUGE_CHANCES: PoopChances = { regular: 0.05, big: 0.1, huge: 0.85 }

// Цены: формула 560 × 2.8^(T-1), округлено как в референсе.
// growthRate всегда 1.15 (множитель за каждую купленную лягушку).
// L19-24 не продаются в shop (availableInShop: false) — только через мерджи.
export const FROG_LEVELS: readonly FrogLevelConfig[] = [
  // ─── Болото (L1-6) — реальные SVG ───
  {
    path: '/frogs_svg/frog1.svg',
    name: 'Фрогги',
    size: 0.8,
    basePrice: 560,
    growthRate: 1.15,
    tint: 0xdef2cb,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 1.0, big: 0.0, huge: 0.0 },
  },
  {
    path: '/frogs_svg/frog2.svg',
    name: 'Фрог',
    size: 1.1,
    basePrice: 1_570,
    growthRate: 1.15,
    tint: 0xd0f0c0,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 0.83, big: 0.17, huge: 0.0 },
  },
  {
    path: '/frogs_svg/frog3.svg',
    name: 'Кваключка',
    size: 1.4,
    basePrice: 4_390,
    growthRate: 1.15,
    tint: 0xe5e8a8,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 0.36, big: 0.64, huge: 0.0 },
  },
  {
    path: '/frogs_svg/frog4.svg',
    name: 'Квакус',
    size: 1.6,
    basePrice: 12_290,
    growthRate: 1.15,
    tint: 0xa8d8b8,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 0.05, big: 0.66, huge: 0.29 },
  },
  {
    path: '/frogs_svg/frog5.svg',
    name: 'Квакер',
    size: 1.6,
    basePrice: 34_420,
    growthRate: 1.15,
    tint: 0xb8e0d0,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 0.05, big: 0.215, huge: 0.735 },
  },
  {
    path: '/frogs_svg/frog6.svg',
    name: 'Квакозавр',
    size: 1.9,
    basePrice: 96_380,
    growthRate: 1.15,
    tint: 0x90c898,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 0.05, big: 0.1, huge: 0.85 },
  },

  // ─── Лес (L7-12) — placeholder, тинты зелёно-коричневые ───
  {
    path: PLACEHOLDER,
    name: 'Глазастик',
    size: 2.0,
    basePrice: 269_860,
    growthRate: 1.15,
    tint: 0x9dc95a,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Громозека',
    size: 2.0,
    basePrice: 755_600,
    growthRate: 1.15,
    tint: 0x7aad3f,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Лягозилла',
    size: 2.0,
    basePrice: 2_100_000,
    growthRate: 1.15,
    tint: 0x5c9028,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Кваколось',
    size: 2.0,
    basePrice: 5_900_000,
    growthRate: 1.15,
    tint: 0x6b8e23,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Длиннолап',
    size: 2.0,
    basePrice: 16_600_000,
    growthRate: 1.15,
    tint: 0x556b2f,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Кикиморка',
    size: 2.0,
    basePrice: 46_400_000,
    growthRate: 1.15,
    tint: 0x3d5118,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },

  // ─── Земля (L13-18) — placeholder, тинты тёплые ───
  {
    path: PLACEHOLDER,
    name: 'Земляквак',
    size: 2.0,
    basePrice: 130_000_000,
    growthRate: 1.15,
    tint: 0xcd853f,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Жаброкус',
    size: 2.0,
    basePrice: 364_100_000,
    growthRate: 1.15,
    tint: 0xb8762e,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Треглаз',
    size: 2.0,
    basePrice: 1_000_000_000,
    growthRate: 1.15,
    tint: 0x8b5a2b,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Квакзавр',
    size: 2.0,
    basePrice: 2_900_000_000,
    growthRate: 1.15,
    tint: 0x9c4a2a,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Болотница',
    size: 2.0,
    basePrice: 8_000_000_000,
    growthRate: 1.15,
    tint: 0xa0522d,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Жаб-хан',
    size: 2.0,
    basePrice: 22_400_000_000,
    growthRate: 1.15,
    tint: 0x6b3410,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },

  // ─── Космос (L19-24) — НЕ продаются в shop, только через мерджи ───
  {
    path: PLACEHOLDER,
    name: 'Квакатлас',
    size: 2.0,
    basePrice: Infinity,
    growthRate: 1.15,
    tint: 0xb388eb,
    location: 4,
    availableInShop: false,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Лягобог',
    size: 2.0,
    basePrice: Infinity,
    growthRate: 1.15,
    tint: 0x9061c2,
    location: 4,
    availableInShop: false,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Вселенжаб',
    size: 2.0,
    basePrice: Infinity,
    growthRate: 1.15,
    tint: 0x6e3fa3,
    location: 4,
    availableInShop: false,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Уроборосква',
    size: 2.0,
    basePrice: Infinity,
    growthRate: 1.15,
    tint: 0x4b6fe6,
    location: 4,
    availableInShop: false,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Призмоляг',
    size: 2.0,
    basePrice: Infinity,
    growthRate: 1.15,
    tint: 0x3050b0,
    location: 4,
    availableInShop: false,
    poopChances: HUGE_CHANCES,
  },
  {
    path: PLACEHOLDER,
    name: 'Жаб-Провидец',
    size: 2.0,
    basePrice: Infinity,
    growthRate: 1.15,
    tint: 0x1e3a8a,
    location: 4,
    availableInShop: false,
    poopChances: HUGE_CHANCES,
  },
]

export const MAX_LEVEL = FROG_LEVELS.length

// Если у уровня placeholder-путь и это не L1 — переиспользуем текстуру L1 (не дублируем).
export const textureKeyForLevel = (level: number): string => {
  const cfg = FROG_LEVELS[Math.min(level - 1, FROG_LEVELS.length - 1)]
  if (level !== 1 && cfg && cfg.path === PLACEHOLDER) return 'frog_lvl_1'
  return `frog_lvl_${level}`
}

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

// Уровни лягушек, принадлежащих локации
export function frogLevelsForLocation(locationId: number): number[] {
  const result: number[] = []
  FROG_LEVELS.forEach((cfg, idx) => {
    if (cfg.location === locationId) result.push(idx + 1)
  })
  return result
}
