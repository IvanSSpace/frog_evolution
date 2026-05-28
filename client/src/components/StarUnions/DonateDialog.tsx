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
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.35)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="ff-panel ff-pop"
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#E8F5D2',
          borderRadius: 14,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3" style={{ borderBottom: '1px solid rgba(77,107,31,0.3)' }}>
          <span className="font-semibold text-base" style={{ color: '#1f2937' }}>Пожертвовать в запрос</span>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: '#4b5563' }}>✕</button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)' }}
          >
            <div className="mb-0.5" style={{ color: '#374151' }}>Нужно: {label}</div>
            <div className="text-xs" style={{ color: '#6b7280' }}>
              Осталось собрать: {remaining.toLocaleString()} / {target.toLocaleString()}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
              У вас: {available.toLocaleString()}
            </div>
          </div>

          {noAvailable ? (
            <div className="text-sm text-center py-2" style={{ color: '#92400e' }}>Нет в наличии</div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs" style={{ color: '#6b7280' }}>Количество</span>
                <span className="text-xs" style={{ color: '#6b7280' }}>Максимум: {maxAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAmount((a) => clamp(a - 1))}
                  disabled={amount <= 1}
                  className="w-8 h-8 rounded text-base font-bold transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.08)', color: '#1f2937', opacity: amount <= 1 ? 0.3 : 1 }}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={maxAmount}
                  value={amount}
                  onChange={(e) => setAmount(clamp(Number(e.target.value)))}
                  className="flex-1 rounded px-2 py-1.5 text-sm text-center focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)', color: '#1f2937' }}
                />
                <button
                  onClick={() => setAmount((a) => clamp(a + 1))}
                  disabled={amount >= maxAmount}
                  className="w-8 h-8 rounded text-base font-bold transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.08)', color: '#1f2937', opacity: amount >= maxAmount ? 0.3 : 1 }}
                >
                  +
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-500 text-xs px-1">{error}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded text-sm transition-opacity"
              style={{ background: 'rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.1)', color: '#374151' }}
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || noAvailable}
              className="flex-1 py-2 rounded text-sm font-semibold transition-opacity"
              style={{
                background: '#16a34a',
                color: '#fff',
                opacity: loading || noAvailable ? 0.4 : 1,
              }}
            >
              {loading ? 'Отправка...' : 'Пожертвовать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
