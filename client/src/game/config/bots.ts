// Bot opponents — генератор противников для рейдов.
//
// MVP: in-memory pool из N синтетических игроков. Каждый имеет имя,
// 3 чана (slime per locId), и pre-built deck per location.
// Реальные PvP игроки заменят это в Этапе server-side matchmaking.

import { WARRIORS, type WarriorClass } from './warriors'

export interface BotDeckEntry {
  level: number // 1..18
  cellIdx: number // 0..11 — позиция в верхних 3 рядах battle grid (ENEMY zone)
}

export interface BotVat {
  /** Накопленный slime в чане для этой локации. */
  slime: number
}

export interface BotData {
  id: string
  name: string
  /** 0..2 — индекс локации (loc1/loc2/loc3). Decks per location. */
  decks: [BotDeckEntry[], BotDeckEntry[], BotDeckEntry[]]
  /** Накопленные чаны (slime) per location 0..2. */
  vats: [BotVat, BotVat, BotVat]
  /** Аватар-emoji для UI. */
  avatar: string
}

const BOT_NAMES = [
  'Болотный Тиран',
  'Барон Тины',
  'Лорд Топи',
  'Княгиня Камышей',
  'Граф Болотников',
  'Жабий Хан',
  'Принц Кваков',
  'Господарь Слизи',
] as const

const BOT_AVATARS = ['🐸', '👑', '🎩', '🦴', '👹', '🤴', '⚔️', '🦎'] as const

/** Создать синтетического бота с заданным "tier'ом сложности" (0..2). */
export function generateBot(difficulty: number = 1): BotData {
  const id = `bot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]
  const avatar = BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)]

  // Decks per location:
  //   loc1 — воины (warrior-level пресет, 4-6 юнитов)
  //   loc2/loc3 — обычные слабые лягушки (1-2 юнита L1-L3)
  const loc1Levels = pickWarriorLevels(difficulty)
  const decks: BotData['decks'] = [
    buildEnemyDeck(loc1Levels),
    buildEnemyDeck(pickRegularLevels(2 + difficulty)),
    buildEnemyDeck(pickRegularLevels(3 + difficulty)),
  ]

  // Vats — slime растёт с difficulty. Базы из rewardForLocation в BattleScene.
  const vats: BotData['vats'] = [
    { slime: Math.floor((800 + difficulty * 400) * (0.7 + Math.random() * 0.6)) },
    {
      slime: Math.floor(
        (4000 + difficulty * 1500) * (0.7 + Math.random() * 0.6),
      ),
    },
    {
      slime: Math.floor(
        (16000 + difficulty * 6000) * (0.7 + Math.random() * 0.6),
      ),
    },
  ]

  return { id, name, decks, vats, avatar }
}

/** Пул случайных N ботов для выбора в RaidPickModal. */
export function generateBotPool(count: number = 5): BotData[] {
  const out: BotData[] = []
  for (let i = 0; i < count; i++) {
    out.push(generateBot(Math.floor(Math.random() * 3)))
  }
  return out
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function pickWarriorLevels(difficulty: number): number[] {
  // Чем выше difficulty, тем мощнее воины.
  const pool = difficulty === 0 ? [1, 2, 3] : difficulty === 1 ? [3, 4, 5, 6] : [5, 6, 7, 8]
  const count = 4 + difficulty // 4-6 юнитов
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(pool[Math.floor(Math.random() * pool.length)])
  }
  return out
}

function pickRegularLevels(count: number): number[] {
  const pool = [1, 2, 3] // слабые мирные жабы
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(pool[Math.floor(Math.random() * pool.length)])
  }
  return out
}

function buildEnemyDeck(levels: number[]): BotDeckEntry[] {
  // Enemy zone в battle grid = rows 0,1,2 × cols 0..3 = idx 0..11.
  const cells: number[] = []
  for (let i = 0; i < 12; i++) cells.push(i)
  cells.sort(() => Math.random() - 0.5)
  return levels.slice(0, 12).map((level, idx) => ({
    level,
    cellIdx: cells[idx],
  }))
}

/** Класс-преобразование (для UI badge'ей). */
export function classForLevel(level: number): WarriorClass | undefined {
  return WARRIORS[level - 1]?.class
}
