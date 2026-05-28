// Phase 22 Plan 22-06: cosmos gate selector + React hook.
//
// Источник истины: useGameStore.hasCosmosUnlocked (top-level boolean, persisted
// под отдельным ключом COSMOS_UNLOCKED_KEY в persistence.ts).
//
// Все серум-связанные UI компоненты (SerumBar, Cosmic Hub button, Star Map
// controls, серум tabs) используют useCosmosUnlocked для conditional rendering.
// Триггер unlock'а — MergeController L18+L18 normal sentinel вызывает markCosmosUnlocked().
//
// Реактивно: Zustand selector → mass re-render всех gated компонентов БЕЗ reload.
//
// FIXME Plan 22-07 (legacy migration): на load — если legacy state имеет
// discovered[19]=true но hasCosmosUnlocked отсутствует, выставить true.
// См. client/src/store/migrations/phase22.ts.

import { useGameStore } from '../store/gameStore'

// Узкий тип чтобы избежать импорта GameStoreState (циклический риск).
interface GateState {
  hasCosmosUnlocked: boolean
}

export function selectCosmosUnlocked(state: GateState): boolean {
  return state.hasCosmosUnlocked === true
}

/**
 * React hook: возвращает true если cosmos unlocked'нут (первый L18+L18 был).
 * Реактивен — пере-рендерит компонент при изменении флага.
 */
export function useCosmosUnlocked(): boolean {
  return useGameStore(selectCosmosUnlocked)
}
