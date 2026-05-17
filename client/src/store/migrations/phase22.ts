// Phase 22 Plan 22-07: migration legacy cosmic state → Phase 22 shape.
//
// Чистая функция migratePhase22(legacy) → newState. Безопасна для idempotent
// вызовов (повторный migrate не ломает state).
//
// Триггеры:
//   1. Carriers: strip rarity/stabilized/feedCount/ceiling/rollHistory; level default = 1.
//   2. Serums: nested {fire: {common, rare, epic, legendary}} → flat {fire: sum}.
//   3. hasCosmosUnlocked: если undefined → инфер из discovered[19] | discoveredLevels[19].
//   4. Phase 22 fields (essence, ascendedCarriers, permaSlotBonus, permaShipSpeedBonus,
//      permaSerumDropBonus, shopPurchaseCounts): default values если отсутствуют.
//
// Used:
//   - persistence.loadCosmicSlice → пропускает результат через migratePhase22 ДО типизации.
//   - persistence.loadCosmosUnlocked / gameStore init — может вычитать
//     hasCosmosUnlocked из inferred path.

export interface LegacyCarrierShape {
  frogId?: string
  element?: string
  rarity?: string
  feedCount?: number
  stabilized?: boolean
  ceiling?: number
  rollHistory?: unknown[]
  level?: number
}

export interface MigratedCarrier {
  frogId: string
  element: string
  level: number
}

/**
 * Идемпотентная миграция legacy cosmic state в Phase 22 shape.
 *
 * Безопасна для:
 *   - already-Phase-22 state (no-op)
 *   - null / undefined / non-object input (passthrough)
 *   - частично legacy / частично новый (selective migrate)
 */
export function migratePhase22<T = unknown>(legacy: T): T {
  if (!legacy || typeof legacy !== 'object') return legacy

  const out = { ...(legacy as Record<string, unknown>) } as Record<
    string,
    unknown
  >

  // 1. Carriers: strip Phase 21 fields.
  if (Array.isArray(out.carriers)) {
    out.carriers = (out.carriers as LegacyCarrierShape[])
      .filter(
        (c): c is LegacyCarrierShape =>
          c != null && typeof c === 'object' && typeof c.frogId === 'string',
      )
      .map<MigratedCarrier>((c) => ({
        frogId: c.frogId as string,
        element: typeof c.element === 'string' ? c.element : 'fire',
        level: typeof c.level === 'number' && c.level > 0 ? c.level : 1,
      }))
  }

  // 2. Serums: flatten nested rarity → single count.
  if (out.serums && typeof out.serums === 'object') {
    const flat: Record<string, number> = {}
    for (const [el, val] of Object.entries(out.serums as Record<string, unknown>)) {
      if (typeof val === 'number') {
        flat[el] = val
      } else if (val && typeof val === 'object') {
        flat[el] = Object.values(val as Record<string, unknown>).reduce<number>(
          (acc, v) => acc + (typeof v === 'number' ? v : 0),
          0,
        )
      } else {
        flat[el] = 0
      }
    }
    out.serums = flat
  }

  // 3. hasCosmosUnlocked: infer from legacy discovered[19] / discoveredLevels[19].
  if (out.hasCosmosUnlocked === undefined) {
    const discovered =
      (out.discovered as unknown[] | undefined) ??
      (out.discoveredLevels as unknown[] | undefined) ??
      []
    out.hasCosmosUnlocked = Array.isArray(discovered) && discovered.includes(19)
  }

  // 4. Phase 22 new fields — defaults если отсутствуют.
  if (out.essence === undefined) out.essence = 0
  if (out.ascendedCarriers === undefined) out.ascendedCarriers = []
  if (out.permaSlotBonus === undefined) out.permaSlotBonus = 0
  if (out.permaShipSpeedBonus === undefined) out.permaShipSpeedBonus = 0
  if (out.permaSerumDropBonus === undefined) out.permaSerumDropBonus = 0
  if (out.shopPurchaseCounts === undefined) out.shopPurchaseCounts = {}

  return out as T
}
