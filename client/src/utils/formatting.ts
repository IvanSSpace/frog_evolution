// Числа меньше 1 миллиона показываем полностью с локальными разделителями.
// От миллиона — сокращаем: 1.1М, 2.5Б, 3.4Т.
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  if (n < 0) return `-${fmt(-n)}`
  if (n < 1_000_000) return Math.floor(n).toLocaleString('ru-RU')
  if (n < 1_000_000_000)        return `${trim(n / 1_000_000)} М`
  if (n < 1_000_000_000_000)    return `${trim(n / 1_000_000_000)} Б`
  return `${trim(n / 1_000_000_000_000)} Т`
}

// Формат скорости (income/sec): мелкие — с десятыми, крупные — сокращённо.
export function fmtRate(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  if (n < 1000) return n.toFixed(n >= 10 ? 0 : 1)
  if (n < 1_000_000) return `${trim(n / 1000)}К`
  return fmt(n)
}

// Один знак после запятой; ".0" убираем (1.0 → 1, 1.1 → 1.1)
function trim(v: number): string {
  const r = Math.round(v * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

// Старая обёртка — оставляем на случай старых вызовов
export function currencyFormatter(amount: number, currencySymbol = '$'): string {
  return `${currencySymbol}${amount.toFixed(2)}`
}
