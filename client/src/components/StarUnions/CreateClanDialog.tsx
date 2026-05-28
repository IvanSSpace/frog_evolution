import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClan } from '../../api/clan'
import { useClanStore } from '../../store/clan/slice'
import { useGameStore } from '../../store/gameStore'
import { EmblemPicker } from './EmblemPicker'
import type { ClanEmblem } from '../../utils/frogEmblem'
import { useModalLock } from '../../utils/modalLock'

const MIN_ESSENCE_OPTIONS = [0, 1, 3, 5, 10]

const NAME_RE = /^[a-zA-Zа-яА-ЯёЁ0-9 \-_]+$/

interface Props {
  playerEssence: number
  onClose: () => void
}

export function CreateClanDialog({ playerEssence, onClose }: Props) {
  useModalLock()
  const setSnapshot = useClanStore((s) => s.setSnapshot)
  const setCooldown = useClanStore((s) => s.setCooldown)
  const devFlags = useGameStore((s) => s.devFlags)
  const allowStripes = devFlags.includes('clan_admin_emblem')

  const [name, setName] = useState('')
  const [emblem, setEmblem] = useState<ClanEmblem>({
    variant: Math.floor(Math.random() * 50),
    style: 'pond',
    bg: '#5e8b2a',
    frog: '#6aab3c',
  })
  const [minEssence, setMinEssence] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 280)
  }, [closing, onClose])

  const nameValid = name.length >= 2 && name.length <= 24 && NAME_RE.test(name)
  const canAfford = playerEssence >= 3
  const submitDisabled = !nameValid || !canAfford || loading

  async function handleSubmit() {
    if (submitDisabled) return
    setLoading(true)
    setError(null)
    try {
      const r = await createClan({ name, emblem, minEssence })
      setCooldown(r.cooldownUntil)
      if (r.clan) {
        setSnapshot({
          clan: r.clan,
          me: r.me!,
          members: r.members ?? [],
          messages: r.messages ?? [],
          requests: r.requests ?? [],
          pin: r.pin ?? null,
        })
      }
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка создания')
    } finally {
      setLoading(false)
    }
  }

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
          className={`ff-panel ${closing ? 'ff-slide-up' : 'ff-slide-down'}`}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center gap-1.5 px-3 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
          >
            <span className="ff-display flex-1" style={{ fontSize: 20, color: '#2f4a1f' }}>
              Создание союза
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
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden ff-no-scrollbar px-4 py-3"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
            }}
          >
            <div className="flex flex-col gap-4">
              {/* Name */}
              <div className="ff-card p-4">
                <div className="flex justify-between mb-2">
                  <span style={{ color: '#2f1f0e', fontWeight: 600 }}>Название</span>
                  <span className="text-xs" style={{ color: name.length > 24 ? '#ef4444' : '#7a5a2f' }}>
                    {name.length}/24
                  </span>
                </div>
                <input
                  type="text"
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Название союза..."
                  className="w-full text-sm focus:outline-none"
                  style={{
                    border: '2px solid #8b6914',
                    background: 'rgba(255,253,230,0.9)',
                    borderRadius: 999,
                    padding: '8px 14px',
                    color: '#2f1f0e',
                  }}
                />
                {name.length > 0 && !nameValid && (
                  <div className="text-xs text-red-500 mt-1">
                    {name.length < 2 ? 'Минимум 2 символа' : !NAME_RE.test(name) ? 'Только буквы, цифры, пробел, - _' : ''}
                  </div>
                )}
              </div>

              {/* Emblem Picker */}
              <div className="ff-card p-4">
                <div className="mb-2" style={{ color: '#2f1f0e', fontWeight: 600 }}>Эмблема</div>
                <EmblemPicker value={emblem} onChange={setEmblem} allowStripes={allowStripes} />
              </div>

              {/* minEssence */}
              <div className="ff-card p-4">
                <div className="mb-2" style={{ color: '#2f1f0e', fontWeight: 600 }}>Минимум 💎 для вступления</div>
                <div className="flex gap-2">
                  {MIN_ESSENCE_OPTIONS.map((v) => (
                    <button
                      key={v}
                      onClick={() => setMinEssence(v)}
                      className={`ff-btn flex-1 py-1.5 text-xs ${minEssence === v ? 'ff-btn-green' : 'ff-btn-grey'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div
                className="ff-balance self-start"
              >
                3 💎 / У тебя: {playerEssence} 💎
                {!canAfford && <span className="ml-2 text-red-400">Недостаточно</span>}
              </div>

              {error && <div className="text-xs text-red-500">{error}</div>}

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
                  disabled={submitDisabled}
                  className="ff-btn ff-btn-amber flex-1 py-2 text-sm"
                >
                  {loading ? '...' : 'Создать'}
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
