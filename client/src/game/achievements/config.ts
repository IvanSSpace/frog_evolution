// Ачивки: определения + награда в премиум-валюте (⭐ звёзды).
// Условия снимаются со снапшота состояния (см. evaluator.ts) — не нужны новые
// счётчики в gameStore. Метрика → текущее значение, target → порог.
//
// i18n: строки пока RU-хардкод (как и journey-скелет). Полный RU/EN/ES — follow-up.

export type AchMetric =
  | 'discoveredCount' // открыто видов лягушек
  | 'maxLevel' // максимально достигнутый уровень
  | 'gold' // накоплено слизи (снапшот-порог)
  | 'frogsOwned' // лягушек на поле (все локации)
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
    id: 'crowd',
    title: 'Полный двор',
    desc: 'Держи 25 лягушек на поле',
    icon: '🐸',
    metric: 'frogsOwned',
    target: 25,
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
]

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}
