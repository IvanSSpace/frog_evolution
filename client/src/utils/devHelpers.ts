// Phase 18: dev-only helpers для тестирования бестиария.
// Подключаются в App.tsx через `if (import.meta.env.DEV) installBestiaryDevHelpers()`.

import { useGameStore } from '../store/gameStore'
import { ELEMENTS, RARITIES, type Element, type Rarity } from '../store/cosmic/types'

declare global {
  interface Window {
    __unlockBestiaryCells?: (count: number) => void
    __bestiaryCount?: () => number
    __resetBestiary?: () => void
  }
}

function bitCount(bitset: ReadonlyArray<number>): number {
  let c = 0
  for (let i = 0; i < bitset.length; i++) {
    let b = bitset[i] ?? 0
    while (b) { b &= b - 1; c++ }
  }
  return c
}

/**
 * Unlocks N random cells (skipping already-unlocked).
 * Triggers milestone toasts as crossed (через slice.setBestiaryBit).
 */
function unlockRandomCells(count: number): void {
  const setBestiaryBit = useGameStore.getState().setBestiaryBit
  if (typeof setBestiaryBit !== 'function') {
    console.warn('[bestiary-dev] setBestiaryBit action not found')
    return
  }

  let unlocked = 0
  let attempts = 0
  const maxAttempts = count * 20  // защита от infinite loop когда bitset почти полный

  while (unlocked < count && attempts < maxAttempts) {
    attempts++
    const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)] as Element
    const rarity = RARITIES[Math.floor(Math.random() * RARITIES.length)] as Rarity
    const level = Math.floor(Math.random() * 24) + 1

    const before = bitCount(useGameStore.getState().bestiaryBitset)
    setBestiaryBit(element, rarity, level)
    const after = bitCount(useGameStore.getState().bestiaryBitset)
    if (after > before) unlocked++
  }

  console.log(`[bestiary-dev] unlocked ${unlocked} cells (attempts: ${attempts})`)
}

export function installBestiaryDevHelpers(): void {
  if (typeof window === 'undefined') return
  window.__unlockBestiaryCells = unlockRandomCells
  window.__bestiaryCount = () =>
    bitCount(useGameStore.getState().bestiaryBitset)
  window.__resetBestiary = () => {
    useGameStore.setState({
      bestiaryBitset: new Array(192).fill(0),
      frogExclusiveUnlocked: false,
    })
    console.log('[bestiary-dev] bitset reset')
  }
  console.log('[bestiary-dev] helpers installed: __unlockBestiaryCells(N), __bestiaryCount(), __resetBestiary()')
}
