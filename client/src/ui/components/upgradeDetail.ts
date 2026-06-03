// upgradeDetail — общий механизм «2 тапа → крупная деталь прокачки».
//
// 1-й тап по апгрейду = выбор (подсветка), 2-й тап по нему же = открыть крупный
// детальный экран (UpgradeDetailOverlay), где и происходит покупка.
//
// Module-store (без Context) — переиспользуется всеми окнами прокачек
// (ShopModal/ConveyorModal/EctoDronerModal). Селекшн один на всё приложение.

import { useEffect, useState, type ReactNode } from 'react'

export interface UpgradeDetail {
  icon: ReactNode
  title: string
  /** Подробное описание (опц.). */
  desc?: ReactNode
  /** Текст текущего/следующего эффекта. */
  effect: ReactNode
  level: number
  maxLevel: number
  cost: number
  currency: 'gold' | 'ecto'
  isMax: boolean
  canAfford: boolean
  /** Покупка (вызывается из детального экрана). */
  onBuy: () => void
}

let selectedId: string | null = null
let detail: UpgradeDetail | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((f) => f())

/** 1-й тап выбирает, 2-й (по тому же id) открывает деталь. */
export function tapUpgrade(id: string, build: () => UpgradeDetail): void {
  if (selectedId === id) {
    detail = build()
    selectedId = null
  } else {
    selectedId = id
  }
  notify()
}

export function closeDetail(): void {
  detail = null
  notify()
}

export function clearSelection(): void {
  selectedId = null
  notify()
}

function useStore(): number {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((x) => x + 1)
    listeners.add(f)
    return () => {
      listeners.delete(f)
    }
  }, [])
  return 0
}

/** true если данный апгрейд сейчас выбран (1-й тап). */
export function useIsSelected(id: string): boolean {
  useStore()
  return selectedId === id
}

/** Текущая открытая деталь (или null). */
export function useDetail(): UpgradeDetail | null {
  useStore()
  return detail
}
