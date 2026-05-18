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
  location: number // 1=Лужа, 2=Болото, 3=Лес
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
// Прогрессия ~2× на каждый level (continuing ratio from Болото L7-L12).
// 2026-05-18 fix: L13-L18 имели cap 393206 (legacy от L19+ когда была 4-я
// локация Континент). После удаления Континента — natural ×2 progression
// от L12=3065.5.
export const TARGET_INCOME_PER_SEC: readonly number[] = [
  // Лужа (L1-6)
  0.5, 1.5, 4.0, 9.5, 21.0, 44.5,
  // Болото (L7-12)
  92.0, 187.5, 379.0, 762.5, 1530.0, 3065.5,
  // Лес (L13-18) — natural ×2 progression
  6131.0, 12262.0, 24524.0, 49048.0, 98096.0, 196192.0,
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

// L1-L18 имеют свои SVG. PLACEHOLDER оставлен на случай возврата к подмене
// (например, для будущих L19+ из мерджей).
const PLACEHOLDER = '/frogs_svg/frog1.svg'

// Ставки в общих poopChances для L7+ — много "огромных", redfер ярче
const HUGE_CHANCES: PoopChances = { regular: 0.05, big: 0.1, huge: 0.85 }

// Цены: формула 560 × 2.8^(T-1), округлено как в референсе.
// growthRate всегда 1.15 (множитель за каждую купленную лягушку).
export const FROG_LEVELS: readonly FrogLevelConfig[] = [
  // ─── Лужа (L1-6) — реальные SVG ───
  // Тёплые жёлто-оливковые зелёные. Светлее к L1, темнее к L6.
  // Намеренно НЕ похожи на элементы: forest=0x4ade80 (яркий лайм) и toxic=0x86efac (бледная мята).
  {
    path: '/frogs_svg/frog1.svg',
    name: 'Фрогги',
    size: 0.8,
    basePrice: 560,
    growthRate: 1.15,
    tint: 0xcbeb83,
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
    tint: 0xcfeb87,
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
    tint: 0xbddb73,
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
    tint: 0xabcb61,
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
    tint: 0x99b951,
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
    tint: 0x87a743,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 0.05, big: 0.1, huge: 0.85 },
  },

  // ─── Болото (L7-12) — натуральные зелёные, светлее предыдущей версии ───
  {
    path: '/frogs_svg/frog7.svg',
    name: 'Глазастик',
    size: 2.0,
    basePrice: 269_860,
    growthRate: 1.15,
    tint: 0xb3db71,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog8.svg',
    name: 'Громозека',
    size: 2.0,
    basePrice: 755_600,
    growthRate: 1.15,
    tint: 0x8bcf6f,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog9.svg',
    name: 'Лягозилла',
    size: 2.0,
    basePrice: 2_100_000,
    growthRate: 1.15,
    tint: 0x7dbf61,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog10.svg',
    name: 'Кваколось',
    size: 2.0,
    basePrice: 5_900_000,
    growthRate: 1.15,
    tint: 0x71af57,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog11.svg',
    name: 'Длиннолап',
    size: 2.0,
    basePrice: 16_600_000,
    growthRate: 1.15,
    tint: 0x659f4f,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog12.svg',
    name: 'Кикиморка',
    size: 2.0,
    basePrice: 46_400_000,
    growthRate: 1.15,
    tint: 0x5b8f47,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },

  // ─── Лес (L13-18) — natural ×2.8 prices progression от L12=46.4M ───
  // 2026-05-18 fix: prices были billions (legacy от L19+ когда была 4-я
  // локация Континент). После удаления Континента — natural progression.
  {
    path: '/frogs_svg/frog13.svg',
    name: 'Квакатлас',
    size: 2.0,
    basePrice: 130_000_000,
    growthRate: 1.15,
    tint: 0x99db6b,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog14.svg',
    name: 'Лягобог',
    size: 2.0,
    basePrice: 364_000_000,
    growthRate: 1.15,
    tint: 0x89cb5f,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog15.svg',
    name: 'Вселенжаб',
    size: 2.0,
    basePrice: 1_020_000_000,
    growthRate: 1.15,
    tint: 0x7bbd55,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog16.svg',
    name: 'Уроборосква',
    size: 2.0,
    basePrice: 2_850_000_000,
    growthRate: 1.15,
    tint: 0x6fad4b,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog17.svg',
    name: 'Призмоляг',
    size: 2.0,
    basePrice: 7_990_000_000,
    growthRate: 1.15,
    tint: 0x639d43,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog18.svg',
    name: 'Жаб-Провидец',
    size: 2.0,
    basePrice: 22_360_000_000,
    growthRate: 1.15,
    tint: 0x578d3b,
    location: 3,
    availableInShop: true,
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
