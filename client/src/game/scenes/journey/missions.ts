// Миссии-путешествия (авто-раннер). Отряд лягушек идёт слева направо прыжками,
// камера едет за ними. Миссии делятся на planet (на нашей планете) и cosmos
// (по космосу). Сейчас реализован скелет planet-миссий: отряд доходит до финиша
// и получает слизь (gold). Препятствия/события и расход отряда — следующий этап.
//
// Общий модуль для JourneyScene (читает distance/reward) и React-оверлея
// JourneyMissionSelect (рендерит список + выбор отряда).

export type JourneyDomain = 'planet' | 'cosmos'

// Типы препятствий на пути. Без оружия: отряд преодолевает их телом, ценой
// лягушек (cost). icon — мультяшный спрайт-эмодзи в сцене.
export type ObstacleType = 'rock' | 'chasm' | 'creature' | 'gate'

export interface JourneyObstacle {
  /** Позиция вдоль дистанции (0..1). Сцена считает x = atFrac * distance. */
  atFrac: number
  type: ObstacleType
  /** Сколько лягушек гибнет при «продолжить» (расход отряда = риск). */
  cost: number
  /** Слизь за преодоление (копится; теряется при провале). */
  loot: number
}

export const OBSTACLE_ICON: Record<ObstacleType, string> = {
  rock: '🪨',
  chasm: '🕳️',
  creature: '👾',
  gate: '⛩️',
}

export const OBSTACLE_LABEL: Record<ObstacleType, string> = {
  rock: 'Камень',
  chasm: 'Пропасть',
  creature: 'Существо',
  gate: 'Барьер',
}

export interface JourneyMission {
  id: string
  name: string
  icon: string
  domain: JourneyDomain
  desc: string
  /** Длина забега в px мира. Влияет на длительность анимации и число событий. */
  distance: number
  /** Финишный бонус слизи за полный проход (сверх лута с препятствий). */
  reward: number
  /** Мин. размер отряда для старта. */
  minSquad: number
  /** Препятствия на пути (push-your-luck: перед каждым — отступить/продолжить). */
  obstacles: JourneyObstacle[]
}

export const JOURNEY_MISSIONS: JourneyMission[] = [
  {
    id: 'planet_meadow',
    name: 'Прогулка по лугу',
    icon: '🌿',
    domain: 'planet',
    desc: 'Короткая вылазка по родному лугу. Спокойно и быстро.',
    distance: 2600,
    reward: 90,
    minSquad: 1,
    obstacles: [
      { atFrac: 0.45, type: 'rock', cost: 1, loot: 90 },
      { atFrac: 0.8, type: 'creature', cost: 1, loot: 110 },
    ],
  },
  {
    id: 'planet_forest',
    name: 'Тропа через лес',
    icon: '🌲',
    domain: 'planet',
    desc: 'Подлиннее, через лесную чащу. Награда побольше.',
    distance: 4200,
    reward: 140,
    minSquad: 2,
    obstacles: [
      { atFrac: 0.3, type: 'rock', cost: 1, loot: 120 },
      { atFrac: 0.6, type: 'gate', cost: 2, loot: 160 },
      { atFrac: 0.85, type: 'creature', cost: 2, loot: 190 },
    ],
  },
  {
    id: 'planet_swamp',
    name: 'Поход через болото',
    icon: '🐸',
    domain: 'planet',
    desc: 'Долгий путь по топям. Лучший улов слизи.',
    distance: 6000,
    reward: 200,
    minSquad: 3,
    obstacles: [
      { atFrac: 0.22, type: 'rock', cost: 1, loot: 150 },
      { atFrac: 0.44, type: 'chasm', cost: 2, loot: 200 },
      { atFrac: 0.67, type: 'creature', cost: 3, loot: 240 },
      { atFrac: 0.88, type: 'gate', cost: 2, loot: 280 },
    ],
  },
]

/** Миссии указанного домена (planet / cosmos). */
export function journeyMissionsByDomain(
  domain: JourneyDomain,
): JourneyMission[] {
  return JOURNEY_MISSIONS.filter((m) => m.domain === domain)
}

/** Миссия по id (или undefined). */
export function journeyMissionById(id: string): JourneyMission | undefined {
  return JOURNEY_MISSIONS.find((m) => m.id === id)
}

/** Максимально возможный лут (лут всех препятствий + финишный бонус). */
export function journeyMaxLoot(m: JourneyMission): number {
  return m.obstacles.reduce((s, o) => s + o.loot, 0) + m.reward
}

/** Сколько лягушек минимум нужно, чтобы преодолеть все препятствия (сумма cost). */
export function journeyTotalCost(m: JourneyMission): number {
  return m.obstacles.reduce((s, o) => s + o.cost, 0)
}
