import { useState } from 'react'
import { createClan } from '../../api/clan'
import { useClanStore } from '../../store/clan/slice'

const ICONS = [
  { key: 'rocket', emoji: '🚀' },
  { key: 'star',   emoji: '⭐' },
  { key: 'crown',  emoji: '👑' },
  { key: 'shield', emoji: '🛡️' },
  { key: 'comet',  emoji: '☄️' },
  { key: 'planet', emoji: '🪐' },
  { key: 'galaxy', emoji: '🌌' },
  { key: 'moon',   emoji: '🌙' },
]

const COLORS = [
  { key: 'teal',   hex: '#0d9488' },
  { key: 'purple', hex: '#9333ea' },
  { key: 'amber',  hex: '#d97706' },
  { key: 'rose',   hex: '#e11d48' },
  { key: 'sky',    hex: '#0284c7' },
  { key: 'mint',   hex: '#16a34a' },
]

const MIN_ESSENCE_OPTIONS = [0, 1, 3, 5, 10]

const NAME_RE = /^[a-zA-Zа-яА-ЯёЁ0-9 \-_]+$/

interface Props {
  playerEssence: number
  onClose: () => void
}

export function CreateClanDialog({ playerEssence, onClose }: Props) {
  const setSnapshot = useClanStore((s) => s.setSnapshot)
  const setCooldown = useClanStore((s) => s.setCooldown)

  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('rocket')
  const [selectedColor, setSelectedColor] = useState('teal')
  const [minEssence, setMinEssence] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const nameValid = name.length >= 2 && name.length <= 24 && NAME_RE.test(name)
  const canAfford = playerEssence >= 3
  const submitDisabled = !nameValid || !canAfford || loading

  async function handleSubmit() {
    if (submitDisabled) return
    setLoading(true)
    setError(null)
    try {
      const r = await createClan({
        name,
        emblemIcon: selectedIcon,
        emblemColor: selectedColor,
        minEssence,
      })
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
      onClick={onClose}
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
          <div className="text-base font-semibold" style={{ color: '#1f2937' }}>Создать союз</div>
          <button onClick={onClose} style={{ color: '#4b5563' }}>✕</button>
        </div>

        <div className="p-4 flex flex-col gap-4 text-sm">
          {/* Name */}
          <div>
            <div className="flex justify-between mb-1">
              <label style={{ color: '#374151' }}>Название</label>
              <span className="text-xs" style={{ color: name.length > 24 ? '#ef4444' : '#6b7280' }}>
                {name.length}/24
              </span>
            </div>
            <input
              type="text"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название союза..."
              className="w-full rounded px-3 py-2 text-sm focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)', color: '#1f2937' }}
            />
            {name.length > 0 && !nameValid && (
              <div className="text-xs text-red-500 mt-1">
                {name.length < 2 ? 'Минимум 2 символа' : !NAME_RE.test(name) ? 'Только буквы, цифры, пробел, - _' : ''}
              </div>
            )}
          </div>

          {/* Icon */}
          <div>
            <div className="mb-2" style={{ color: '#374151' }}>Иконка эмблемы</div>
            <div className="grid grid-cols-4 gap-2">
              {ICONS.map((ic) => (
                <button
                  key={ic.key}
                  onClick={() => setSelectedIcon(ic.key)}
                  className="flex items-center justify-center text-2xl rounded"
                  style={{
                    height: 44,
                    background: selectedIcon === ic.key ? 'rgba(77,107,31,0.2)' : 'rgba(0,0,0,0.06)',
                    border: selectedIcon === ic.key ? '2px solid #4d6b1f' : '2px solid transparent',
                  }}
                >
                  {ic.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <div className="mb-2" style={{ color: '#374151' }}>Цвет эмблемы</div>
            <div className="flex gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSelectedColor(c.key)}
                  className="rounded-full transition-transform"
                  style={{
                    width: 32,
                    height: 32,
                    background: c.hex,
                    border: selectedColor === c.key ? '3px solid #1f2937' : '3px solid transparent',
                    transform: selectedColor === c.key ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* minEssence */}
          <div>
            <div className="mb-2" style={{ color: '#374151' }}>Минимум 💎 для вступления</div>
            <div className="flex gap-2">
              {MIN_ESSENCE_OPTIONS.map((v) => (
                <button
                  key={v}
                  onClick={() => setMinEssence(v)}
                  className="flex-1 py-1.5 rounded text-xs font-semibold"
                  style={{
                    background: minEssence === v ? '#16a34a' : 'rgba(0,0,0,0.08)',
                    color: minEssence === v ? '#fff' : '#374151',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div
            className="rounded px-3 py-2 text-xs"
            style={{
              background: canAfford ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)',
              color: '#1f2937',
            }}
          >
            Стоимость: 3 💎. У тебя: {playerEssence} 💎.
            {!canAfford && <span className="ml-1 text-red-500">Недостаточно</span>}
          </div>

          {error && <div className="text-xs text-red-500">{error}</div>}

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded text-sm"
              style={{ background: 'rgba(0,0,0,0.08)', color: '#374151' }}
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="flex-1 py-2 rounded text-sm font-semibold transition-opacity"
              style={{
                background: submitDisabled ? 'rgba(0,0,0,0.1)' : '#16a34a',
                color: submitDisabled ? '#9ca3af' : '#fff',
                cursor: submitDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '...' : 'Создать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
