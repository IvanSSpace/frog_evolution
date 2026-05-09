export type NumberFormat = 'short' | 'full'

let _format: NumberFormat = 'full'
export function setGlobalFormat(f: NumberFormat) {
  _format = f
}

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  if (n < 0) return `-${fmt(-n)}`
  if (_format === 'short') {
    if (n < 1_000) return Math.floor(n).toString()
    if (n < 1_000_000) return `${trim(n / 1_000)}K`
    if (n < 1_000_000_000) return `${trim(n / 1_000_000)}M`
    if (n < 1_000_000_000_000) return `${trim(n / 1_000_000_000)}B`
    return `${trim(n / 1_000_000_000_000)}T`
  }
  if (n < 1_000_000) return Math.floor(n).toLocaleString()
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
