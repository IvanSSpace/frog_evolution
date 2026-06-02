// Ачивки: определения + награда в премиум-валюте (⭐ звёзды).
// Условия снимаются со снапшота состояния (см. evaluator.ts) — не нужны новые
// счётчики в gameStore. Метрика → текущее значение, target → порог.
//
// i18n: строки пока RU-хардкод (как и journey-скелет). Полный RU/EN/ES — follow-up.

export type AchMetric =
  | 'discoveredCount' // открыто видов лягушек
  | 'maxLevel' // максимально достигнутый уровень
  | 'maxTier' // макс. тир эволюции (0/1/2)
  | 'gold' // накоплено слизи (снапшот-порог)
  | 'incomePerSec' // доход слизи/сек (снапшот)
  | 'ectoplasm' // эктоплазма (Loc2)
  | 'currencyY' // валюта Y (Loc3)
  | 'frogsOwned' // лягушек на поле (все локации)
  | 'boxesOpened' // открыто боксов всего
  | 'shipsOwned' // куплено кораблей
  | 'cosmosUnlocked' // открыт космос (0/1)
  | 'l18Merges' // число L18+L18 мерджей

export interface AchievementDef {
  id: string
  title: string
  desc: string
  icon: string
  metric: AchMetric
  target: number
  /** Награда в звёздах (⭐ премиум) за закрытие. */
  reward: number
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_steps',
    title: 'Первые шаги',
    desc: 'Открой 3 вида лягушек',
    icon: '🐸',
    metric: 'discoveredCount',
    target: 3,
    reward: 1,
  },
  {
    id: 'collector',
    title: 'Коллекционер',
    desc: 'Открой 8 видов лягушек',
    icon: '📒',
    metric: 'discoveredCount',
    target: 8,
    reward: 2,
  },
  {
    id: 'zoologist',
    title: 'Зоолог',
    desc: 'Открой 14 видов лягушек',
    icon: '🔬',
    metric: 'discoveredCount',
    target: 14,
    reward: 3,
  },
  {
    id: 'evolve_10',
    title: 'Эволюция',
    desc: 'Дорасти лягушку до L10',
    icon: '🧬',
    metric: 'maxLevel',
    target: 10,
    reward: 2,
  },
  {
    id: 'king_croak',
    title: 'Король Кваков',
    desc: 'Дорасти лягушку до L18',
    icon: '👑',
    metric: 'maxLevel',
    target: 18,
    reward: 5,
  },
  {
    id: 'rich',
    title: 'Богатей',
    desc: 'Накопи 5 000 слизи',
    icon: '💧',
    metric: 'gold',
    target: 5000,
    reward: 1,
  },
  {
    id: 'magnate',
    title: 'Магнат',
    desc: 'Накопи 100 000 слизи',
    icon: '💎',
    metric: 'gold',
    target: 100000,
    reward: 4,
  },
  {
    id: 'complete_dex',
    title: 'Полный бестиарий',
    desc: 'Открой все 18 видов лягушек',
    icon: '📖',
    metric: 'discoveredCount',
    target: 18,
    reward: 8,
  },
  // ─── Эволюция (уровень) ───
  {
    id: 'evolve_6',
    title: 'Лесной житель',
    desc: 'Дорасти лягушку до L6',
    icon: '🌲',
    metric: 'maxLevel',
    target: 6,
    reward: 1,
  },
  {
    id: 'evolve_12',
    title: 'Континентал',
    desc: 'Дорасти лягушку до L12',
    icon: '🌍',
    metric: 'maxLevel',
    target: 12,
    reward: 3,
  },
  // ─── Тиры мутаций ───
  {
    id: 'mutant',
    title: 'Первая мутация',
    desc: 'Прокачай тир эволюции до 1',
    icon: '🧪',
    metric: 'maxTier',
    target: 1,
    reward: 2,
  },
  {
    id: 'apex',
    title: 'Высшая форма',
    desc: 'Прокачай тир эволюции до 2',
    icon: '☢️',
    metric: 'maxTier',
    target: 2,
    reward: 4,
  },
  // ─── Слизь (gold) ───
  {
    id: 'tycoon',
    title: 'Слизевой барон',
    desc: 'Накопи 10 000 000 слизи',
    icon: '🏦',
    metric: 'gold',
    target: 10_000_000,
    reward: 6,
  },
  {
    id: 'ocean',
    title: 'Океан слизи',
    desc: 'Накопи 1 000 000 000 слизи',
    icon: '🌊',
    metric: 'gold',
    target: 1_000_000_000,
    reward: 9,
  },
  // ─── Доход/сек ───
  {
    id: 'steady_income',
    title: 'Стабильный доход',
    desc: 'Достигни 1 000 слизи/сек',
    icon: '📈',
    metric: 'incomePerSec',
    target: 1000,
    reward: 2,
  },
  {
    id: 'gusher',
    title: 'Фонтан',
    desc: 'Достигни 1 000 000 слизи/сек',
    icon: '⛲',
    metric: 'incomePerSec',
    target: 1_000_000,
    reward: 5,
  },
  // ─── Эктоплазма (Loc2) ───
  {
    id: 'ecto_first',
    title: 'Эктоплазма',
    desc: 'Накопи 50 эктоплазмы',
    icon: '🟣',
    metric: 'ectoplasm',
    target: 50,
    reward: 2,
  },
  {
    id: 'ecto_rich',
    title: 'Призрачный запас',
    desc: 'Накопи 500 эктоплазмы',
    icon: '👻',
    metric: 'ectoplasm',
    target: 500,
    reward: 4,
  },
  // ─── Валюта Y (Loc3) ───
  {
    id: 'continent_first',
    title: 'Первопроходец',
    desc: 'Добудь 10 валюты Континента',
    icon: '🏔️',
    metric: 'currencyY',
    target: 10,
    reward: 3,
  },
  {
    id: 'continent_rich',
    title: 'Хозяин гор',
    desc: 'Добудь 100 валюты Континента',
    icon: '🗿',
    metric: 'currencyY',
    target: 100,
    reward: 5,
  },
  // ─── Лягушки на поле ───
  {
    id: 'crowd',
    title: 'Полный двор',
    desc: 'Держи 25 лягушек на поле',
    icon: '🐸',
    metric: 'frogsOwned',
    target: 25,
    reward: 2,
  },
  {
    id: 'swarm',
    title: 'Нашествие',
    desc: 'Держи 40 лягушек на поле',
    icon: '🐾',
    metric: 'frogsOwned',
    target: 40,
    reward: 3,
  },
  // ─── Боксы ───
  {
    id: 'opener',
    title: 'Открывашка',
    desc: 'Открой 50 боксов',
    icon: '📦',
    metric: 'boxesOpened',
    target: 50,
    reward: 1,
  },
  {
    id: 'box_addict',
    title: 'Коробочник',
    desc: 'Открой 500 боксов',
    icon: '🎁',
    metric: 'boxesOpened',
    target: 500,
    reward: 3,
  },
  {
    id: 'box_hoarder',
    title: 'Складовщик',
    desc: 'Открой 5 000 боксов',
    icon: '🗃️',
    metric: 'boxesOpened',
    target: 5000,
    reward: 6,
  },
  // ─── Космос ───
  {
    id: 'to_the_stars',
    title: 'К звёздам',
    desc: 'Открой космос',
    icon: '✨',
    metric: 'cosmosUnlocked',
    target: 1,
    reward: 5,
  },
  {
    id: 'captain',
    title: 'Капитан',
    desc: 'Купи первый корабль',
    icon: '🚀',
    metric: 'shipsOwned',
    target: 1,
    reward: 3,
  },
  {
    id: 'fleet',
    title: 'Флот',
    desc: 'Купи 3 корабля',
    icon: '🛸',
    metric: 'shipsOwned',
    target: 3,
    reward: 6,
  },
  // ─── Слияния L18 ───
  {
    id: 'first_fusion',
    title: 'Слияние',
    desc: 'Сделай первое слияние L18 + L18',
    icon: '✨',
    metric: 'l18Merges',
    target: 1,
    reward: 2,
  },
  {
    id: 'l18_master',
    title: 'Мастер слияний',
    desc: 'Сделай 5 слияний L18 + L18',
    icon: '🌀',
    metric: 'l18Merges',
    target: 5,
    reward: 6,
  },
  {
    id: 'fusion_lord',
    title: 'Властелин слияний',
    desc: 'Сделай 15 слияний L18 + L18',
    icon: '💥',
    metric: 'l18Merges',
    target: 15,
    reward: 10,
  },
]

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}
