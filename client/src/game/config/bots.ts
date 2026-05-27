// Bot opponents — типы данных противника для рейдов.
//
// Генераторы (generateBot/generateBotPool) удалены 2026-05-25: выбор противника
// теперь через планеты (InvestigateModal / RaidScoutScene), deck строится из
// botDeckLevels (battleUnits.ts). Здесь остались только типы.
// Реальные PvP игроки заменят это в Этапе server-side matchmaking.

export interface BotDeckEntry {
  level: number // 1..18
  cellIdx: number // 0..11 — позиция в верхних 3 рядах battle grid (ENEMY zone)
}

export interface BotVat {
  /** Накопленная слизь (💧, = gold) в чане для этой локации. */
  slime: number
}

export interface BotData {
  id: string
  name: string
  /** 0..2 — индекс локации (loc1/loc2/loc3). Decks per location. */
  decks: [BotDeckEntry[], BotDeckEntry[], BotDeckEntry[]]
  /** Накопленные чаны (слизь) per location 0..2. */
  vats: [BotVat, BotVat, BotVat]
  /** Аватар-emoji для UI. */
  avatar: string
}
