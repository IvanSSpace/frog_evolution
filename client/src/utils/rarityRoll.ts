// Phase 22: упрощённый serum-drop roller.
// Старая 4-tier rarity rolling логика (rollRarity / updatePity / pity guarantees)
// удалена вместе с Rarity типом. Серум теперь дропается boolean-y (есть/нет).

export function rollSerumDrop(
  chance: number,
  rng: () => number = Math.random,
): boolean {
  return rng() < chance
}
