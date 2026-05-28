import { useState } from 'react'
import type { ClanPinDto } from '../../api/clan'
import { createPin } from '../../api/clan'

interface Props {
  clanId: number
  existingPin: ClanPinDto | null
  onClose: () => void
  onCreated: (pin: ClanPinDto) => void
}

export function CreatePinDialog({ clanId, existingPin, onClose, onCreated }: Props) {
  const [text, setText] = useState('')
  const [missionRef, setMissionRef] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (loading || !text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const pin = await createPin(clanId, { text: text.trim(), missionRef: missionRef.trim() || undefined })
      onCreated(pin)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка при публикации маршрута')
    } finally {
      setLoading(false)
    }
  }

  const remaining = 300 - text.length

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
          <span className="text-white font-semibold text-base">Звёздный маршрут</span>
          <button onClick={onClose} className="text-white/50 hover:text-white text-lg leading-none">✕</button>
        </div>

        {existingPin && (
          <div
            className="rounded px-3 py-2 text-xs"
            style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', color: 'rgba(253,224,71,0.85)' }}
          >
            Это заменит текущий маршрут
          </div>
        )}

        <div>
          <div className="text-xs text-white/50 mb-1.5">Текст маршрута</div>
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              placeholder="Опишите маршрут союза..."
              rows={4}
              className="w-full rounded px-2 py-1.5 text-sm bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-white/40 resize-none"
            />
            <span
              className="absolute bottom-1.5 right-2 text-xs"
              style={{ color: remaining < 20 ? 'rgba(248,113,113,0.8)' : 'rgba(255,255,255,0.3)' }}
            >
              {remaining}
            </span>
          </div>
        </div>

        <div>
          <div className="text-xs text-white/50 mb-1.5">Цель миссии (placeholder)</div>
          <input
            type="text"
            value={missionRef}
            onChange={(e) => setMissionRef(e.target.value)}
            placeholder="миссии в разработке. Пока произвольный текст"
            className="w-full rounded px-2 py-1.5 text-sm bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-white/40"
          />
        </div>

        <div className="text-xs text-white/40">Маршрут будет закреплён в чате на 24 часа</div>

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
            disabled={loading || !text.trim()}
            className="flex-1 py-2 rounded text-sm font-semibold transition-opacity"
            style={{
              background: 'rgba(99,102,241,0.5)',
              color: '#e0e7ff',
              opacity: loading || !text.trim() ? 0.4 : 1,
            }}
          >
            {loading ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
      </div>
    </div>
  )
}
