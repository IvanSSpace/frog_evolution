import type { Element } from '../config/cosmic'
import type { EventCategory, ExpeditionResult, LogLine } from './types'

// Journal timestamp ЧЧ:ММ (hours:minutes since departure), Fallout-Shelter
// style. `sec` is fiction/journal time; minutes tick over per beat.
export function formatTime(sec: number): string {
  const m = Math.floor((sec / 60) % 60)
  const h = Math.floor(sec / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}`
}

export interface RenderedLine {
  time: string
  text: string
  category: EventCategory
  revealSec: number // real seconds since departure when the UI should show it
}

// Wire-ready journal rows. The Mini App maps these straight to list items,
// revealing each once wall-clock elapsed ≥ revealSec.
export function renderJournal(log: LogLine[]): RenderedLine[] {
  return log.map((l) => ({
    time: formatTime(l.t),
    text: l.text,
    category: l.category,
    revealSec: l.revealSec,
  }))
}

// Plain-text dump — handy for the demo and for debugging.
export function toPlainText(result: ExpeditionResult): string {
  const head = renderJournal(result.log)
    .map((l) => `${l.time}  ${l.text}`)
    .join('\n')
  const serums = Object.entries(result.loot.serums)
    .filter(([, n]) => n > 0)
    .map(([e, n]) => `${e}×${n}`)
    .join(', ')
  const tail = result.shipLost
    ? '\n\n💀 КОРАБЛЬ ПОТЕРЯН — лут не доставлен.'
    : `\n\n🛬 Доставлено: ${result.loot.gold} золота${serums ? `, сыворотки: ${serums}` : ''}.`
  return head + tail
}

// Compact loot summary for API responses.
export function lootSummary(result: ExpeditionResult): {
  gold: number
  serums: Partial<Record<Element, number>>
} {
  const serums: Partial<Record<Element, number>> = {}
  for (const [e, n] of Object.entries(result.loot.serums)) {
    if (n > 0) serums[e as Element] = n
  }
  return { gold: result.loot.gold, serums }
}
