import { useState } from 'react'
import type { ClanRequestDto, ClanRequestType } from '../../api/clan'
import { createRequest } from '../../api/clan'
import {
  ESSENCE_REQUEST_CAP,
  SERUM_REQUEST_CAP,
  ELEMENT_LABELS,
  ELEMENT_KEYS,
  getSlimeCap,
} from '../../utils/clanLimits'

interface Props {
  clanId: number
  onClose: () => void
  onCreated: (req: ClanRequestDto) => void
}

export function CreateRequestDialog({ clanId, onClose, onCreated }: Props) {
  const [type, setType] = useState<ClanRequestType>('SLIME')
  const [element, setElement] = useState<string>(ELEMENT_KEYS[0])
  const [amount, setAmount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          <span className="font-semibold text-base" style={{ color: '#1f2937' }}>Новый запрос</span>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: '#4b5563' }}>✕</button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div>
            <div className="text-xs mb-1.5" style={{ color: '#6b7280' }}>Тип запроса</div>
            <div className="flex gap-2">
              {(['SLIME', 'ESSENCE', 'SERUM'] as ClanRequestType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className="flex-1 py-1.5 rounded text-sm font-medium transition-all"
                  style={{
                    background: type === t ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.06)',
                    border: `1px solid ${type === t ? 'rgba(99,102,241,0.5)' : 'rgba(0,0,0,0.1)'}`,
                    color: type === t ? '#3730a3' : '#374151',
                  }}
                >
                  {t === 'SLIME' ? '💧 Слизь' : t === 'ESSENCE' ? '💎 Эссенция' : '🧪 Сыворотка'}
                </button>
              ))}
            </div>
          </div>

          {type === 'SERUM' && (
            <div>
              <div className="text-xs mb-1.5" style={{ color: '#6b7280' }}>Элемент</div>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {ELEMENT_KEYS.map((el) => (
                  <button
                    key={el}
                    onClick={() => setElement(el)}
                    className="py-1 rounded text-xs transition-all"
                    style={{
                      background: element === el ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.05)',
                      border: `1px solid ${element === el ? 'rgba(99,102,241,0.5)' : 'rgba(0,0,0,0.08)'}`,
                      color: element === el ? '#3730a3' : '#374151',
                    }}
                  >
                    {ELEMENT_LABELS[el]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: '#6b7280' }}>Количество</span>
              {slimeDisabled && (
                <span className="text-xs" style={{ color: '#92400e' }}>Нужен трактор-доход</span>
              )}
              {!slimeDisabled && (
                <span className="text-xs" style={{ color: '#6b7280' }}>Максимум: {max.toLocaleString()}</span>
              )}
            </div>
            {type === 'ESSENCE' ? (
              <div className="text-sm px-1" style={{ color: '#374151' }}>1 (фиксировано)</div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAmount((a) => clamp(a - 1))}
                  disabled={slimeDisabled || amount <= 1}
                  className="w-8 h-8 rounded text-base font-bold transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.08)', color: '#1f2937', opacity: slimeDisabled || amount <= 1 ? 0.3 : 1 }}
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
                  className="flex-1 rounded px-2 py-1.5 text-sm text-center focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)', color: '#1f2937', opacity: slimeDisabled ? 0.4 : 1 }}
                />
                <button
                  onClick={() => setAmount((a) => clamp(a + 1))}
                  disabled={slimeDisabled || amount >= max}
                  className="w-8 h-8 rounded text-base font-bold transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.08)', color: '#1f2937', opacity: slimeDisabled || amount >= max ? 0.3 : 1 }}
                >
                  +
                </button>
              </div>
            )}
          </div>

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
              disabled={loading || slimeDisabled}
              className="flex-1 py-2 rounded text-sm font-semibold transition-opacity"
              style={{
                background: '#16a34a',
                color: '#fff',
                opacity: loading || slimeDisabled ? 0.4 : 1,
              }}
            >
              {loading ? 'Создание...' : 'Создать запрос'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
