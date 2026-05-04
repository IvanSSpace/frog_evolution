// Каждый уровень — свой SVG + индивидуальный размер
interface FrogLevelConfig {
  path: string
  size: number // множитель относительно базовых 50×47 CSS-пикселей
}

export const FROG_LEVELS: readonly FrogLevelConfig[] = [
  { path: '/frogs_svg/frog1.svg', size: 0.8 },  // 1 — без изменений
  { path: '/frogs_svg/frog2.svg', size: 1.1 },  // 2 (+0.2)
  { path: '/frogs_svg/frog3.svg', size: 1.4 },  // 3 (+0.2)
  { path: '/frogs_svg/frog4.svg', size: 1.6 },  // 4 (+0.2)
  { path: '/frogs_svg/frog5.svg', size: 1.7 },  // 5 (+0.2)
  { path: '/frogs_svg/frog6.svg', size: 1.6 },  // 6 (+0.1)
  { path: '/frogs_svg/frog7.svg', size: 1.9 },  // 7 (+0.2)
]

export const MAX_LEVEL = FROG_LEVELS.length

export const textureKeyForLevel = (level: number): string => `frog_lvl_${level}`

export const configForLevel = (level: number): FrogLevelConfig =>
  FROG_LEVELS[Math.min(level - 1, FROG_LEVELS.length - 1)]
