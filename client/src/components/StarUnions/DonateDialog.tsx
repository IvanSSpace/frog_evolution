import { useState } from 'react'
import type { ClanRequestDto } from '../../api/clan'
import { donate } from '../../api/clan'
import { useGameStore } from '../../store/gameStore'
import { ELEMENT_LABELS } from '../../utils/clanLimits'
import type { Element } from '../../store/cosmic/types'

interface Props {
  req: ClanRequestDto
  onClose: () => void
  onDonated: (updated: ClanRequestDto) => void
}

const TYPE_LABEL: Record<string, string> = {
  SLIME: 'Слизь',
  ESSENCE: 'Эссенция',
  SERUM: 'Сыворотка',
}

function safeNumber(val: string | number): number {
  if (typeof val === 'number') return val
  try {
    const n = Number(BigInt(val))
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function DonateDialog({ req, onClose, onDonated }: Props) {
  const gold = useGameStore((s) => s.gold)
  const essence = useGameStore((s) => s.essence)
  const serums = useGameStore((s) => s.serums)

  const target = safeNumber(req.targetAmount)
  const current = safeNumber(req.currentAmount)
  const remaining = Math.max(0, target - current)

  let available = 0
  if (req.type === 'SLIME') {
    available = Math.min(gold, Number.MAX_SAFE_INTEGER)
    if (available > Number.MAX_SAFE_INTEGER) available = Number.MAX_SAFE_INTEGER
    available = Math.floor(available)
  } else if (req.type === 'ESSENCE') {
    available = essence
  } else if (req.type === 'SERUM' && req.element) {
    available = serums[req.element as Element] ?? 0
  }

  const maxAmount = Math.min(remaining, available)

  const [amount, setAmount] = useState(() => (maxAmount > 0 ? 1 : 0))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function clamp(val: number): number {
    return Math.max(1, Math.min(maxAmount, val))
  }

  const label =
    TYPE_LABEL[req.type] +
    (req.element ? ` (${ELEMENT_LABELS[req.element] ?? req.element})` : '')

  async function handleSubmit() {
    if (loading || available === 0 || maxAmount === 0) return
    setLoading(true)
    setError(null)
    try {
      const updated = await donate(req.id, String(amount))
      onDonated(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка при пожертвовании')
    } finally {
      setLoading(false)
    }
  }

  const noAvailable = available === 0 || maxAmount === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-4 flex flex-col gap-3"
        style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold text-base">Пожертвовать в запрос</span>
          <button onClick={onClose} className="text-white/50 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="text-white/70 mb-0.5">Нужно: {label}</div>
          <div className="text-white/50 text-xs">
            Осталось собрать: {remaining.toLocaleString()} / {target.toLocaleString()}
          </div>
          <div className="text-white/50 text-xs mt-0.5">
            У вас: {available.toLocaleString()}
          </div>
        </div>

        {noAvailable ? (
          <div className="text-yellow-400/80 text-sm text-center py-2">Нет в наличии</div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/50">Количество</span>
              <span className="text-xs text-white/40">Максимум: {maxAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAmount((a) => clamp(a - 1))}
                disabled={amount <= 1}
                className="w-8 h-8 rounded text-white text-base font-bold transition-opacity"
                style={{ background: 'rgba(255,255,255,0.08)', opacity: amount <= 1 ? 0.3 : 1 }}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={maxAmount}
                value={amount}
                onChange={(e) => setAmount(clamp(Number(e.target.value)))}
                className="flex-1 rounded px-2 py-1.5 text-sm text-center bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
              />
              <button
                onClick={() => setAmount((a) => clamp(a + 1))}
                disabled={amount >= maxAmount}
                className="w-8 h-8 rounded text-white text-base font-bold transition-opacity"
                style={{ background: 'rgba(255,255,255,0.08)', opacity: amount >= maxAmount ? 0.3 : 1 }}
              >
                +
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-400 text-xs px-1">{error}</div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded text-sm text-white/60 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || noAvailable}
            className="flex-1 py-2 rounded text-sm font-semibold transition-opacity"
            style={{
              background: 'rgba(99,102,241,0.5)',
              color: '#e0e7ff',
              opacity: loading || noAvailable ? 0.4 : 1,
            }}
          >
            {loading ? 'Отправка...' : 'Пожертвовать'}
          </button>
        </div>
      </div>
    </div>
  )
}
