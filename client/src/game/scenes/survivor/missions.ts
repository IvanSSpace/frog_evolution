// Survivor-миссии — выбор перед стартом VS-арены. Общий модуль для сцены
// (SurvivorScene читает множители) и React-оверлея (SurvivorMissionSelect рендерит
// список). enemyMult множит HP/урон/частоту врагов; rewardMult — золото на win.

export interface SurvivorMission {
  id: string
  name: string
  icon: string
  desc: string
  /** Множитель силы врагов (HP, урон, частота спавна). */
  enemyMult: number
  /** Через сколько мс появляется босс. */
  bossTimeMs: number
  /** Множитель награды (золото) за победу. */
  rewardMult: number
}

export const SURVIVOR_MISSIONS: SurvivorMission[] = [
  {
    id: 'scout',
    name: 'Разведка',
    icon: '🛰',
    desc: 'Слабые враги, короткий забег. Награда скромная.',
    enemyMult: 0.8,
    bossTimeMs: 45_000,
    rewardMult: 1,
  },
  {
    id: 'swarm',
    name: 'Зачистка роя',
    icon: '🐝',
    desc: 'Плотные волны, средняя сложность.',
    enemyMult: 1.15,
    bossTimeMs: 70_000,
    rewardMult: 1.7,
  },
  {
    id: 'lair',
    name: 'Логово босса',
    icon: '👑',
    desc: 'Жёстко и долго. Жирная награда.',
    enemyMult: 1.5,
    bossTimeMs: 95_000,
    rewardMult: 2.6,
  },
]

export function getMission(id?: string): SurvivorMission {
  return SURVIVOR_MISSIONS.find((m) => m.id === id) ?? SURVIVOR_MISSIONS[0]
}
