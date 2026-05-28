import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ClanRequestDto, ClanRequestType } from '../../api/clan'
import { createRequest } from '../../api/clan'
import {
  ESSENCE_REQUEST_CAP,
  SERUM_REQUEST_CAP,
  ELEMENT_LABELS,
  ELEMENT_KEYS,
  getSlimeCap,
} from '../../utils/clanLimits'
import { useModalLock } from '../../utils/modalLock'

interface Props {
  clanId: number
  onClose: () => void
  onCreated: (req: ClanRequestDto) => void
}

export function CreateRequestDialog({ clanId, onClose, onCreated }: Props) {
  useModalLock()
  const [type, setType] = useState<ClanRequestType>('SLIME')
  const [element, setElement] = useState<string>(ELEMENT_KEYS[0])
  const [amount, setAmount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 280)
  }, [closing, onClose])

  const slimeCap = getSlimeCap()

  function getMax(): number {
    if (type === 'SLIME') return slimeCap
    if (type === 'ESSENCE') return ESSENCE_REQUEST_CAP
    return SERUM_REQUEST_CAP
  }

  function clamp(val: number): number {
    const max = getMax()
    return Math.max(1, Math.min(max, val))
  }

  function handleTypeChange(t: ClanRequestType) {
    setType(t)
    setError(null)
    if (t === 'ESSENCE') setAmount(1)
    else if (t === 'SERUM') setAmount(clampForType(1, 'SERUM'))
    else setAmount(slimeCap > 0 ? 1 : 0)
  }

  function clampForType(val: number, t: ClanRequestType): number {
    const max = t === 'SLIME' ? slimeCap : t === 'ESSENCE' ? ESSENCE_REQUEST_CAP : SERUM_REQUEST_CAP
    return Math.max(1, Math.min(max, val))
  }

  async function handleSubmit() {
    if (loading) return
    const max = getMax()
    if (type === 'SLIME' && slimeCap === 0) {
      setError('Нет дохода слизи — нужен трактор')
      return
    }
    if (amount < 1 || amount > max) {
      setError(`Количество должно быть от 1 до ${max}`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const req = await createRequest(clanId, {
        type,
        element: type === 'SERUM' ? element : undefined,
        amount: String(amount),
      })
      onCreated(req)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка при создании запроса')
    } finally {
      setLoading(false)
    }
  }

  const max = getMax()
  const slimeDisabled = type === 'SLIME' && slimeCap === 0

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
              Новый запрос
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
              {/* Type */}
              <div className="ff-card p-4">
                <div className="text-xs mb-2" style={{ color: '#7a5a2f' }}>Тип запроса</div>
                <div className="flex gap-2">
                  {(['SLIME', 'ESSENCE', 'SERUM'] as ClanRequestType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleTypeChange(t)}
                      className={`ff-btn flex-1 py-1.5 text-xs ${type === t ? 'ff-btn-green' : 'ff-btn-grey'}`}
                    >
                      {t === 'SLIME' ? '💧 Слизь' : t === 'ESSENCE' ? '💎 Эссенция' : '🧪 Сыворотка'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Element */}
              {type === 'SERUM' && (
                <div className="ff-card p-4">
                  <div className="text-xs mb-2" style={{ color: '#7a5a2f' }}>Элемент</div>
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    {ELEMENT_KEYS.map((el) => (
                      <button
                        key={el}
                        onClick={() => setElement(el)}
                        className={`ff-btn py-1 text-xs ${element === el ? 'ff-btn-green' : 'ff-btn-grey'}`}
                      >
                        {ELEMENT_LABELS[el]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="ff-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs" style={{ color: '#7a5a2f' }}>Количество</span>
                  {slimeDisabled ? (
                    <span className="text-xs" style={{ color: '#92400e' }}>Нужен трактор-доход</span>
                  ) : (
                    <span className="text-xs" style={{ color: '#7a5a2f' }}>Максимум: {max.toLocaleString()}</span>
                  )}
                </div>
                {type === 'ESSENCE' ? (
                  <div className="text-sm px-1" style={{ color: '#2f1f0e' }}>1 (фиксировано)</div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAmount((a) => clamp(a - 1))}
                      disabled={slimeDisabled || amount <= 1}
                      className="ff-btn ff-btn-grey text-base font-bold"
                      style={{ width: 36, height: 36, padding: 0, opacity: slimeDisabled || amount <= 1 ? 0.3 : 1 }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={max}
                      value={slimeDisabled ? '' : amount}
                      disabled={slimeDisabled}
                      onChange={(e) => setAmount(clamp(Number(e.target.value)))}
                      className="flex-1 text-sm text-center focus:outline-none"
                      style={{
                        border: '2px solid #8b6914',
                        background: 'rgba(255,253,230,0.9)',
                        borderRadius: 12,
                        padding: '6px 8px',
                        color: '#2f1f0e',
                        opacity: slimeDisabled ? 0.4 : 1,
                      }}
                    />
                    <button
                      onClick={() => setAmount((a) => clamp(a + 1))}
                      disabled={slimeDisabled || amount >= max}
                      className="ff-btn ff-btn-grey text-base font-bold"
                      style={{ width: 36, height: 36, padding: 0, opacity: slimeDisabled || amount >= max ? 0.3 : 1 }}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

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
                  disabled={loading || slimeDisabled}
                  className="ff-btn ff-btn-green flex-1 py-2 text-sm"
                >
                  {loading ? 'Создание...' : 'Создать запрос'}
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
