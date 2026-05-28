import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ClanRequestDto } from '../../api/clan'
import { donate } from '../../api/clan'
import { useGameStore } from '../../store/gameStore'
import { ELEMENT_LABELS } from '../../utils/clanLimits'
import type { Element } from '../../store/cosmic/types'
import { useModalLock } from '../../utils/modalLock'

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
  useModalLock()
  const gold = useGameStore((s) => s.gold)
  const essence = useGameStore((s) => s.essence)
  const serums = useGameStore((s) => s.serums)
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 280)
  }, [closing, onClose])

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

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        pointerEvents: 'auto',
        background: 'transparent',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad))',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 251,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div
          className={closing ? 'ff-slide-up' : 'ff-slide-down'}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, #f5fbe9 0%, #d9eeb6 100%)',
            border: '4px solid #4d6b1f',
            borderRadius: 0,
            boxShadow: '0 0 0 3px #f7ffe0 inset',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center gap-1.5 px-3 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
          >
            <span className="ff-display flex-1" style={{ fontSize: 20, color: '#2f4a1f' }}>
              Пожертвовать
            </span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Закрыть"
              className="ff-tile w-10 h-10 text-xl flex-shrink-0"
              style={{
                ['--ff-tile-from' as never]: '#fca5a5',
                ['--ff-tile-to' as never]: '#dc2626',
                ['--ff-tile-border' as never]: '#7f1d1d',
                color: '#fff',
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div
            className="flex-1 min-h-0 overflow-y-auto ff-no-scrollbar px-4 py-3"
            style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
          >
            <div className="flex flex-col gap-4">
              {/* Info card */}
              <div className="ff-card p-4">
                <div className="mb-0.5" style={{ color: '#2f1f0e' }}>Нужно: {label}</div>
                <div className="text-xs mt-1" style={{ color: '#7a5a2f' }}>
                  Осталось собрать: {remaining.toLocaleString()} / {target.toLocaleString()}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#7a5a2f' }}>
                  У вас: {available.toLocaleString()}
                </div>
              </div>

              {noAvailable ? (
                <div className="text-sm text-center py-2" style={{ color: '#92400e' }}>Нет в наличии</div>
              ) : (
                <div className="ff-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{ color: '#7a5a2f' }}>Количество</span>
                    <span className="text-xs" style={{ color: '#7a5a2f' }}>Максимум: {maxAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAmount((a) => clamp(a - 1))}
                      disabled={amount <= 1}
                      className="ff-btn ff-btn-grey text-base font-bold"
                      style={{ width: 36, height: 36, padding: 0, opacity: amount <= 1 ? 0.3 : 1 }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxAmount}
                      value={amount}
                      onChange={(e) => setAmount(clamp(Number(e.target.value)))}
                      className="flex-1 text-sm text-center focus:outline-none"
                      style={{
                        border: '2px solid #8b6914',
                        background: 'rgba(255,253,230,0.9)',
                        borderRadius: 12,
                        padding: '6px 8px',
                        color: '#2f1f0e',
                      }}
                    />
                    <button
                      onClick={() => setAmount((a) => clamp(a + 1))}
                      disabled={amount >= maxAmount}
                      className="ff-btn ff-btn-grey text-base font-bold"
                      style={{ width: 36, height: 36, padding: 0, opacity: amount >= maxAmount ? 0.3 : 1 }}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {error && <div className="text-red-500 text-xs px-1">{error}</div>}

              {/* Footer */}
              <div className="flex gap-3 pb-2">
                <button
                  onClick={handleClose}
                  className="ff-btn ff-btn-grey flex-1 py-2 text-sm"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || noAvailable}
                  className="ff-btn ff-btn-green flex-1 py-2 text-sm"
                >
                  {loading ? 'Отправка...' : 'Пожертвовать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
