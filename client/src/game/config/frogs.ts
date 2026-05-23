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
  location: number // 1=Болото, 2=Лес, 3=Континент
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
// Source-of-truth: frog_obsidian_archive/Frog Evolution/Economy/
//   Экономика лягушек — 24 уровня.md
// Формула: income(T) = 2 × income(T-1) + (T-1)/2, L1 = 0.5.
// 2026-05-18 fix: L13-L18 имели cap 393206 (legacy от L19+ когда была 4-я
// локация Космос). После удаления — natural progression по архивной формуле.
export const TARGET_INCOME_PER_SEC: readonly number[] = [
  // Лужа (L1-6)
  0.5, 1.5, 4.0, 9.5, 21.0, 44.5,
  // Болото (L7-12)
  92.0, 187.5, 379.0, 762.5, 1530.0, 3065.5,
  // Лес (L13-18) — точные значения по формуле из архива
  6137.0, 12280.5, 24568.0, 49143.5, 98295.0, 196598.5,
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
const PLACEHOLDER = '/frogs_svg/frog1_t0.svg'

// Ставки в общих poopChances для L7+ — много "огромных", redfер ярче
const HUGE_CHANCES: PoopChances = { regular: 0.05, big: 0.1, huge: 0.85 }

// Цены: формула 560 × 2.8^(T-1), округлено как в референсе.
// growthRate всегда 1.15 (множитель за каждую купленную лягушку).
export const FROG_LEVELS: readonly FrogLevelConfig[] = [
  // ─── Лужа (L1-6) — реальные SVG ───
  // Тёплые жёлто-оливковые зелёные. Светлее к L1, темнее к L6.
  // Намеренно НЕ похожи на элементы: forest=0x4ade80 (яркий лайм) и toxic=0x86efac (бледная мята).
  {
    path: '/frogs_svg/frog1_t0.svg',
    name: 'Фрогги',
    size: 0.8,
    basePrice: 560,  /* formula: 560 × 2.8^0 */
    growthRate: 1.15,
    tint: 0xcbeb83,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 1.0, big: 0.0, huge: 0.0 },
  },
  {
    path: '/frogs_svg/frog2_t0.svg',
    name: 'Фрог',
    size: 0.95,
    basePrice: 1_568,  /* formula: 560 × 2.8^1 */
    growthRate: 1.15,
    tint: 0xcfeb87,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 0.83, big: 0.17, huge: 0.0 },
  },
  {
    path: '/frogs_svg/frog3_t0.svg',
    name: 'Кваключка',
    size: 1.1,
    basePrice: 4_390,  /* formula: 560 × 2.8^2 */
    growthRate: 1.15,
    tint: 0xbddb73,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 0.36, big: 0.64, huge: 0.0 },
  },
  {
    path: '/frogs_svg/frog4_t0.svg',
    name: 'Квакус',
    size: 1.25,
    basePrice: 12_293,  /* formula: 560 × 2.8^3 */
    growthRate: 1.15,
    tint: 0xd2ef88,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 0.05, big: 0.66, huge: 0.29 },
  },
  {
    path: '/frogs_svg/frog5_t0.svg',
    name: 'Квакер',
    size: 1.4,
    basePrice: 34_421,  /* formula: 560 × 2.8^4 */
    growthRate: 1.15,
    tint: 0xc1df79,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 0.05, big: 0.215, huge: 0.735 },
  },
  {
    path: '/frogs_svg/frog6_t0.svg',
    name: 'Квакозавр',
    size: 1.6,
    basePrice: 96_378,  /* formula: 560 × 2.8^5 */
    growthRate: 1.15,
    tint: 0xafcf6b,
    location: 1,
    availableInShop: true,
    poopChances: { regular: 0.05, big: 0.1, huge: 0.85 },
  },

  // ─── Болото (L7-12) — продолжение жёлто-оливковой палитры локации 1 ───
  {
    path: '/frogs_svg/frog7_t0.svg',
    name: 'Глазастик',
    size: 1.4,
    basePrice: 269_859,  /* formula: 560 × 2.8^6 */
    growthRate: 1.15,
    tint: 0xcbeb83,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog8_t0.svg',
    name: 'Громозека',
    size: 1.6,
    basePrice: 755_604,  /* formula: 560 × 2.8^7 */
    growthRate: 1.15,
    tint: 0xcfeb87,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog9_t0.svg',
    name: 'Лягозилла',
    size: 1.8,
    basePrice: 2_115_691,  /* formula: 560 × 2.8^8 */
    growthRate: 1.15,
    tint: 0xbddb73,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog10_t0.svg',
    name: 'Кваколось',
    size: 2,
    basePrice: 5_923_935,  /* formula: 560 × 2.8^9 */
    growthRate: 1.15,
    tint: 0xd2ef88,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog11_t0.svg',
    name: 'Длиннолап',
    size: 2.25,
    basePrice: 16_587_019,  /* formula: 560 × 2.8^10 */
    growthRate: 1.15,
    tint: 0xc1df79,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog12_t0.svg',
    name: 'Кикиморка',
    size: 2.5,
    basePrice: 46_443_653,  /* formula: 560 × 2.8^11 */
    growthRate: 1.15,
    tint: 0xafcf6b,
    location: 2,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },

  // ─── Лес (L13-18) — natural ×2.8 prices progression от L12=46.4M ───
  // 2026-05-18 fix: prices были billions (legacy от L19+ когда была 4-я
  // локация Континент). После удаления Континента — natural progression.
  // Палитра — продолжение жёлто-оливковой гаммы локации 1, тёмные оттенки.
  {
    path: '/frogs_svg/frog13_t0.svg',
    name: 'Квакатлас',
    size: 0.8,
    basePrice: 130_000_000,  /* original 3-этап (rounded), formula approx 560 × 2.8^12 */
    growthRate: 1.15,
    tint: 0xcbeb83,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog14_t0.svg',
    name: 'Лягобог',
    size: 0.95,
    basePrice: 364_100_000,  /* original 3-этап */
    growthRate: 1.15,
    tint: 0xcfeb87,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog15_t0.svg',
    name: 'Вселенжаб',
    size: 1.1,
    basePrice: 1_000_000_000,  /* original 3-этап */
    growthRate: 1.15,
    tint: 0xbddb73,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog16_t0.svg',
    name: 'Уроборосква',
    size: 1.25,
    basePrice: 2_900_000_000,  /* original 3-этап */
    growthRate: 1.15,
    tint: 0xd2ef88,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog17_t0.svg',
    name: 'Призмоляг',
    size: 1.4,
    basePrice: 8_000_000_000,  /* original 3-этап */
    growthRate: 1.15,
    tint: 0xc1df79,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
  {
    path: '/frogs_svg/frog18_t0.svg',
    name: 'Жаб-Провидец',
    size: 1.6,
    basePrice: 22_400_000_000,  /* original 3-этап */
    growthRate: 1.15,
    tint: 0xafcf6b,
    location: 3,
    availableInShop: true,
    poopChances: HUGE_CHANCES,
  },
]

export const MAX_LEVEL = FROG_LEVELS.length

// 2026-05-23: лорный размер лягушки для бестиария.
// L1 (Болото) — реалистичные см, L2 (Лес) — гигантские метры,
// L3 (Континент) — мифические км. Чисто display-only (canvas scale = `size`).
const DISPLAY_SIZE_BY_LEVEL: Readonly<Record<number, string>> = {
  // L1 (Болото): см → 1.5 м (~×1.5-2 ступень)
  1: '10 см',
  2: '25 см',
  3: '30 см',
  4: '55 см',
  5: '1 м',
  6: '1.5 м',
  // L2 (Лес): метры, продолжение ramp
  7: '2.5 м',
  8: '4 м',
  9: '6 м',
  10: '9 м',
  11: '15 м',
  12: '25 м',
  // L3 (Континент): большие метры → 1 км
  13: '40 м',
  14: '70 м',
  15: '120 м',
  16: '250 м',
  17: '500 м',
  18: '1 км',
}

export function getDisplaySize(level: number): string {
  return DISPLAY_SIZE_BY_LEVEL[level] ?? '—'
}

// Tier-aware texture key. `tier=0` совместим с прежним форматом ключа для t0,
// но добавляет суффикс для t1/t2. PLACEHOLDER-fallback применяется только к t0.
export const textureKeyForLevel = (level: number, tier: number = 0): string => {
  const t = Math.max(0, Math.min(2, Math.floor(tier)))
  const cfg = FROG_LEVELS[Math.min(level - 1, FROG_LEVELS.length - 1)]
  if (t === 0 && level !== 1 && cfg && cfg.path === PLACEHOLDER) return 'frog_lvl_1_t0'
  return `frog_lvl_${level}_t${t}`
}

export const configForLevel = (level: number): FrogLevelConfig =>
  FROG_LEVELS[Math.min(level - 1, FROG_LEVELS.length - 1)]

// Путь к SVG для конкретного тира эволюции. Файлы лежат в public/frogs_svg/
// по конвенции `frog{N}_t{0|1|2}.svg`. Tier 0 — базовый, t1/t2 — evolved.
// До появления файла превью просто 404'нется, fallback не делаем.
export function getFrogPath(level: number, tier: number): string {
  const t = Math.max(0, Math.min(2, Math.floor(tier)))
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
  return `/frogs_svg/frog${lvl}_t${t}.svg`
}

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
