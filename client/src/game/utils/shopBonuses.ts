// Phase 22 Plan 22-05: pure helpers, читающие cosmic shop perma upgrades.
//
// Helpers — чистые функции, принимающие raw bonus counter. Это:
//   - убирает зависимость от gameStore (нет циклических import'ов)
//   - делает тесты простыми (просто числа)
//   - оставляет caller'у решение когда и как читать store
//
// Caller-side pattern:
//   const cap = effectiveSlotCap(MAX_ENTITIES, useGameStore.getState().permaSlotBonus)
//   const mult = shipSpeedMultiplier(state.cosmic.permaShipSpeedBonus)
//   const chance = serumDropChance(BASE_CHANCE, store.permaSerumDropBonus)

/** +1 slot за каждый купленный «slot_plus_one». */
export function effectiveSlotCap(baseCap: number, permaSlotBonus: number): number {
  return baseCap + Math.max(0, Math.floor(permaSlotBonus || 0))
}

/**
 * +5% к скорости корабля за каждый купленный «ship_speed».
 * Множитель применяется как `effectiveDuration = baseDuration / multiplier`.
 * 1.0 = без бонуса; 1.05 = -4.76% времени полёта; 1.5 = -33% времени.
 */
export function shipSpeedMultiplier(permaShipSpeedBonus: number): number {
  return 1 + 0.05 * Math.max(0, Math.floor(permaShipSpeedBonus || 0))
}

/**
 * +0.5% к chance дропа серума за каждый купленный «serum_drop_chance».
 * Возвращает effective chance в диапазоне [0, 1].
 */
export function serumDropChance(
  baseChance: number,
  permaSerumDropBonus: number,
): number {
  const inc = 0.005 * Math.max(0, Math.floor(permaSerumDropBonus || 0))
  return Math.min(1, Math.max(0, baseChance + inc))
}
