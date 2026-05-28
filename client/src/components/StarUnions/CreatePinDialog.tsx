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
          <span className="font-semibold text-base" style={{ color: '#1f2937' }}>Звёздный маршрут</span>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: '#4b5563' }}>✕</button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {existingPin && (
            <div
              className="rounded px-3 py-2 text-xs"
              style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)', color: '#92400e' }}
            >
              Это заменит текущий маршрут
            </div>
          )}

          <div>
            <div className="text-xs mb-1.5" style={{ color: '#6b7280' }}>Текст маршрута</div>
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 300))}
                placeholder="Опишите маршрут союза..."
                rows={4}
                className="w-full rounded px-2 py-1.5 text-sm focus:outline-none resize-none"
                style={{ background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)', color: '#1f2937' }}
              />
              <span
                className="absolute bottom-1.5 right-2 text-xs"
                style={{ color: remaining < 20 ? '#ef4444' : '#9ca3af' }}
              >
                {remaining}
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs mb-1.5" style={{ color: '#6b7280' }}>Цель миссии (placeholder)</div>
            <input
              type="text"
              value={missionRef}
              onChange={(e) => setMissionRef(e.target.value)}
              placeholder="миссии в разработке. Пока произвольный текст"
              className="w-full rounded px-2 py-1.5 text-sm focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)', color: '#1f2937' }}
            />
          </div>

          <div className="text-xs" style={{ color: '#6b7280' }}>Маршрут будет закреплён в чате на 24 часа</div>

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
              disabled={loading || !text.trim()}
              className="flex-1 py-2 rounded text-sm font-semibold transition-opacity"
              style={{
                background: '#16a34a',
                color: '#fff',
                opacity: loading || !text.trim() ? 0.4 : 1,
              }}
            >
              {loading ? 'Публикация...' : 'Опубликовать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
