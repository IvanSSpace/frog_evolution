export type NumberFormat = 'short' | 'full'

// numberFormat UI toggle removed — формат всегда 'short'. Тип и setGlobalFormat
// сохранены для совместимости с store/sync (см. gameStore.numberFormat).
export function setGlobalFormat(_f: NumberFormat) {
  /* no-op — формат всегда short */
}

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  if (n < 0) return `-${fmt(-n)}`
  if (n < 1_000) return Math.floor(n).toString()
  if (n < 1_000_000) return `${trim(n / 1_000)}K`
  if (n < 1_000_000_000) return `${trim(n / 1_000_000)}M`
  if (n < 1_000_000_000_000) return `${trim(n / 1_000_000_000)}B`
  return `${trim(n / 1_000_000_000_000)}T`
}

export function fmtRate(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  if (n < 1000) return n.toFixed(n >= 10 ? 0 : 1)
  if (n < 1_000_000) return `${trim(n / 1000)}K`
  return fmt(n)
}

function trim(v: number): string {
  const r = Math.round(v * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

export function currencyFormatter(
  amount: number,
  currencySymbol = '$',
): string {
  return `${currencySymbol}${amount.toFixed(2)}`
}
