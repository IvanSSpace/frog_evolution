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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-4 flex flex-col gap-3"
        style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold text-base">Новый запрос</span>
          <button onClick={onClose} className="text-white/50 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div>
          <div className="text-xs text-white/50 mb-1.5">Тип запроса</div>
          <div className="flex gap-2">
            {(['SLIME', 'ESSENCE', 'SERUM'] as ClanRequestType[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className="flex-1 py-1.5 rounded text-sm font-medium transition-all"
                style={{
                  background: type === t ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${type === t ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.1)'}`,
                  color: type === t ? '#e0e7ff' : 'rgba(255,255,255,0.6)',
                }}
              >
                {t === 'SLIME' ? '💧 Слизь' : t === 'ESSENCE' ? '💎 Эссенция' : '🧪 Сыворотка'}
              </button>
            ))}
          </div>
        </div>

        {type === 'SERUM' && (
          <div>
            <div className="text-xs text-white/50 mb-1.5">Элемент</div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {ELEMENT_KEYS.map((el) => (
                <button
                  key={el}
                  onClick={() => setElement(el)}
                  className="py-1 rounded text-xs transition-all"
                  style={{
                    background: element === el ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${element === el ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.08)'}`,
                    color: element === el ? '#e0e7ff' : 'rgba(255,255,255,0.55)',
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
            <span className="text-xs text-white/50">Количество</span>
            {slimeDisabled && (
              <span className="text-xs text-yellow-400/70">Нужен трактор-доход</span>
            )}
            {!slimeDisabled && (
              <span className="text-xs text-white/40">Максимум: {max.toLocaleString()}</span>
            )}
          </div>
          {type === 'ESSENCE' ? (
            <div className="text-white/70 text-sm px-1">1 (фиксировано)</div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAmount((a) => clamp(a - 1))}
                disabled={slimeDisabled || amount <= 1}
                className="w-8 h-8 rounded text-white text-base font-bold transition-opacity"
                style={{ background: 'rgba(255,255,255,0.08)', opacity: slimeDisabled || amount <= 1 ? 0.3 : 1 }}
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
                className="flex-1 rounded px-2 py-1.5 text-sm text-center bg-white/10 border border-white/20 text-white focus:outline-none focus:border-white/40"
                style={{ opacity: slimeDisabled ? 0.4 : 1 }}
              />
              <button
                onClick={() => setAmount((a) => clamp(a + 1))}
                disabled={slimeDisabled || amount >= max}
                className="w-8 h-8 rounded text-white text-base font-bold transition-opacity"
                style={{ background: 'rgba(255,255,255,0.08)', opacity: slimeDisabled || amount >= max ? 0.3 : 1 }}
              >
                +
              </button>
            </div>
          )}
        </div>

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
            disabled={loading || slimeDisabled}
            className="flex-1 py-2 rounded text-sm font-semibold transition-opacity"
            style={{
              background: 'rgba(99,102,241,0.5)',
              color: '#e0e7ff',
              opacity: loading || slimeDisabled ? 0.4 : 1,
            }}
          >
            {loading ? 'Создание...' : 'Создать запрос'}
          </button>
        </div>
      </div>
    </div>
  )
}
