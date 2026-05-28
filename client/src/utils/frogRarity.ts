// 2026-05-28: Rarity-классификация лягушек для визуальной иерархии карточек.
//
// Маппинг по уровню (универсальный — работает на любой frog reference):
//   L1-6   (Болото)     → common      (серый)
//   L7-12  (Лес)        → rare        (синий)
//   L13-17 (Континент)  → epic        (фиолетовый)
//   L18+   (космос)     → legendary   (золотой, пульсирует)
//
// Маппинг по тиру эволюции (T0=common, T1=rare, T2=epic).
// Для эволюционных карточек комбинируем — max(rarityByLevel, rarityByTier).

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary']
const TIER_RARITY: Rarity[] = ['common', 'rare', 'epic']

export function rarityForLevel(level: number): Rarity {
  if (level >= 18) return 'legendary'
  if (level >= 13) return 'epic'
  if (level >= 7) return 'rare'
  return 'common'
}

export function rarityForTier(tier: number): Rarity {
  return TIER_RARITY[Math.max(0, Math.min(2, tier))]
}

export function maxRarity(...rs: Rarity[]): Rarity {
  const i = Math.max(...rs.map((r) => RARITY_ORDER.indexOf(r)))
  return RARITY_ORDER[i] ?? 'common'
}

/** CSS-класс для применения rarity-кольца + glow. Парный с правилами в index.css. */
export function rarityClass(r: Rarity): string {
  return `ff-rarity-${r}`
}
