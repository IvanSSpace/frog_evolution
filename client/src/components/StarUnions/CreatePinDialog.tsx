import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ClanPinDto } from '../../api/clan'
import { createPin } from '../../api/clan'
import { useModalLock } from '../../utils/modalLock'

interface Props {
  clanId: number
  existingPin: ClanPinDto | null
  onClose: () => void
  onCreated: (pin: ClanPinDto) => void
}

export function CreatePinDialog({ clanId, existingPin, onClose, onCreated }: Props) {
  useModalLock()
  const [text, setText] = useState('')
  const [missionRef, setMissionRef] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 280)
  }, [closing, onClose])

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
              Звёздный маршрут
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
              {existingPin && (
                <div
                  className="ff-card px-3 py-2 text-xs"
                  style={{ color: '#92400e', borderColor: '#b45309' }}
                >
                  ⚠️ Это заменит текущий маршрут
                </div>
              )}

              {/* Text */}
              <div className="ff-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs" style={{ color: '#7a5a2f' }}>Текст маршрута</span>
                  <span className="text-xs" style={{ color: remaining < 20 ? '#ef4444' : '#7a5a2f' }}>
                    {remaining}
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 300))}
                  placeholder="Опишите маршрут союза..."
                  rows={4}
                  className="w-full text-sm focus:outline-none resize-none"
                  style={{
                    border: '2px solid #8b6914',
                    background: 'rgba(255,253,230,0.9)',
                    borderRadius: 12,
                    padding: '8px 12px',
                    color: '#2f1f0e',
                  }}
                />
              </div>

              {/* Mission ref */}
              <div className="ff-card p-4">
                <div className="text-xs mb-2" style={{ color: '#7a5a2f' }}>Цель миссии (placeholder)</div>
                <input
                  type="text"
                  value={missionRef}
                  onChange={(e) => setMissionRef(e.target.value)}
                  placeholder="миссии в разработке. Пока произвольный текст"
                  className="w-full text-sm focus:outline-none"
                  style={{
                    border: '2px solid #8b6914',
                    background: 'rgba(255,253,230,0.9)',
                    borderRadius: 999,
                    padding: '8px 14px',
                    color: '#2f1f0e',
                  }}
                />
              </div>

              <div className="text-xs" style={{ color: '#7a5a2f' }}>Маршрут будет закреплён в чате на 24 часа</div>

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
                  disabled={loading || !text.trim()}
                  className="ff-btn ff-btn-green flex-1 py-2 text-sm"
                >
                  {loading ? 'Публикация...' : 'Опубликовать'}
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
