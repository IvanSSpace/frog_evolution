// Миссии-путешествия (авто-раннер). Отряд лягушек идёт слева направо прыжками,
// камера едет за ними. Миссии делятся на planet (на нашей планете) и cosmos
// (по космосу). Сейчас реализован скелет planet-миссий: отряд доходит до финиша
// и получает слизь (gold). Препятствия/события и расход отряда — следующий этап.
//
// Общий модуль для JourneyScene (читает distance/reward) и React-оверлея
// JourneyMissionSelect (рендерит список + выбор отряда).

export type JourneyDomain = 'planet' | 'cosmos'

export interface JourneyMission {
  id: string
  name: string
  icon: string
  domain: JourneyDomain
  desc: string
  /** Длина забега в px мира. Влияет на длительность анимации и (позже) число событий. */
  distance: number
  /** Базовая награда (слизь/gold) за полный проход. Скелет: фиксированная. */
  reward: number
  /** Мин. размер отряда для старта. */
  minSquad: number
}

export const JOURNEY_MISSIONS: JourneyMission[] = [
  {
    id: 'planet_meadow',
    name: 'Прогулка по лугу',
    icon: '🌿',
    domain: 'planet',
    desc: 'Короткая вылазка по родному лугу. Спокойно и быстро.',
    distance: 2600,
    reward: 150,
    minSquad: 1,
  },
  {
    id: 'planet_forest',
    name: 'Тропа через лес',
    icon: '🌲',
    domain: 'planet',
    desc: 'Подлиннее, через лесную чащу. Награда побольше.',
    distance: 4200,
    reward: 320,
    minSquad: 2,
  },
  {
    id: 'planet_swamp',
    name: 'Поход через болото',
    icon: '🐸',
    domain: 'planet',
    desc: 'Долгий путь по топям. Лучший улов слизи.',
    distance: 6000,
    reward: 560,
    minSquad: 3,
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
