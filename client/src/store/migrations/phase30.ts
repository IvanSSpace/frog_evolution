// Phase 30 Plan 30-08: migration — idempotent strip of dead factory/drone fields.
//
// Чистая функция migratePhase30(legacy) → newState. Безопасна для idempotent
// вызовов (повторный migrate не ломает state).
//
// Что strip'ает (мёртвые поля — удалены в Plans 30-01..30-05):
//   - ectoplasm         (top-level, удалён в Plan 30-05)
//   - loc2Upgrades      (top-level, удалён в Plan 30-05)
//   - currencyY         (top-level, удалён в Plan 30-05)
//   - upgrades.droneSlots      (вложено в upgrades, удалено в Plan 30-05)
//   - upgrades.collectorDrones (вложено в upgrades, удалено в Plan 30-05)
//   - upgrades.magnetDrones    (вложено в upgrades, удалено в Plan 30-05)
//
// Что НЕ трогает (D-03 — passive QoL upgrades, СОХРАНЕНЫ):
//   - upgrades.autoCollect  — passive field, выжил в cut; old-save value валидна
//   - upgrades.magnet       — passive field, выжил в cut
//   - upgrades.magnet2      — passive field, выжил в cut
//   - upgrades.magnet3      — passive field, выжил в cut
//   - gold / coins          — core currency
//   - cosmicSlice и все cosmic fields
//   - все остальные non-factory/drone данные
//
// Used:
//   - persistence.loadGameState → пропускает через migratePhase30 ДО типизации
//     (по паттерну migratePhase22 в persistence.ts)
//
// NOTE: эта миграция — read-only strip. snapshotForSave() больше не включает
// мёртвые поля, поэтому после следующего server PUT они пропадут с сервера
// органически (no server migration needed).

/**
 * Идемпотентная миграция legacy gameStore state — strip мёртвых factory/drone полей.
 *
 * Безопасна для:
 *   - already-Phase-30 state (no-op)
 *   - null / undefined / non-object input (passthrough)
 *   - частично legacy / частично новый (selective strip)
 */
export function migratePhase30<T = unknown>(data: T): T {
  if (!data || typeof data !== 'object') return data

  const out = { ...(data as Record<string, unknown>) }

  // Strip factory/drone top-level fields — безопасно даже если отсутствуют
  delete out.ectoplasm
  delete out.loc2Upgrades
  delete out.currencyY

  // Strip drone-machinery fields из upgrades (если upgrades присутствует)
  if (out.upgrades && typeof out.upgrades === 'object') {
    const upg = { ...(out.upgrades as Record<string, unknown>) }
    // NOTE: droneSlots НЕ удаляем — это purchasable upgrade, сохранён в коде (Plan 30-05)
    delete upg.collectorDrones
    delete upg.magnetDrones
    // NOTE: НЕ удаляем upg.autoCollect — это passive QoL field, выживший cut (D-03)
    // NOTE: НЕ удаляем upg.magnet / magnet2 / magnet3 — passive QoL (D-03)
    out.upgrades = upg
  }

  return out as T
}
