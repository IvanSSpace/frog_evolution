// Survivor-миссии — выбор перед стартом VS-арены. Общий модуль для сцены
// (SurvivorScene читает множители + уровни врагов) и React-оверлея
// (SurvivorMissionSelect рендерит список). enemyMult множит HP/урон/частоту;
// rewardMult — золото на win; mobLevels — какие жабы-враги спавнятся (визуал +
// тематика); bossLevel — уровень жабы-босса.

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
  /** Уровни жаб-врагов (textureKeyForLevel) — для визуального разнообразия. */
  mobLevels: number[]
  /** Уровень жабы-босса. */
  bossLevel: number
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
    mobLevels: [1, 2, 3],
    bossLevel: 11,
  },
  {
    id: 'blitz',
    name: 'Блиц',
    icon: '⚡',
    desc: 'Очень быстрый забег — босс уже на 30 секунде.',
    enemyMult: 1,
    bossTimeMs: 30_000,
    rewardMult: 1.3,
    mobLevels: [2, 3, 4],
    bossLevel: 13,
  },
  {
    id: 'swarm',
    name: 'Зачистка роя',
    icon: '🐝',
    desc: 'Плотные волны, средняя сложность.',
    enemyMult: 1.2,
    bossTimeMs: 70_000,
    rewardMult: 1.7,
    mobLevels: [2, 3, 4, 5],
    bossLevel: 15,
  },
  {
    id: 'horde',
    name: 'Орда',
    icon: '🌊',
    desc: 'Огромные толпы. Тонешь, если стоишь на месте.',
    enemyMult: 1.5,
    bossTimeMs: 80_000,
    rewardMult: 2,
    mobLevels: [1, 2, 3, 4, 5, 6],
    bossLevel: 16,
  },
  {
    id: 'elite',
    name: 'Элита',
    icon: '🛡',
    desc: 'Мало врагов, но очень жирные и больно бьют.',
    enemyMult: 1.7,
    bossTimeMs: 85_000,
    rewardMult: 2.3,
    mobLevels: [6, 7, 8, 9],
    bossLevel: 17,
  },
  {
    id: 'lair',
    name: 'Логово босса',
    icon: '👑',
    desc: 'Жёстко и долго. Жирная награда.',
    enemyMult: 1.5,
    bossTimeMs: 95_000,
    rewardMult: 2.6,
    mobLevels: [4, 5, 6, 7],
    bossLevel: 18,
  },
  {
    id: 'marathon',
    name: 'Марафон',
    icon: '⏳',
    desc: 'Долгий забег, босс поздно. Максимальная награда.',
    enemyMult: 1.3,
    bossTimeMs: 130_000,
    rewardMult: 3.2,
    mobLevels: [3, 4, 5, 6, 7, 8],
    bossLevel: 18,
  },
]

export function getMission(id?: string): SurvivorMission {
  return SURVIVOR_MISSIONS.find((m) => m.id === id) ?? SURVIVOR_MISSIONS[0]
}
