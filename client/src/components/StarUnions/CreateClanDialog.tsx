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
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        className="ff-panel ff-pop"
        style={{ width: 'min(400px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="text-base font-semibold">Создать союз</div>
          <button onClick={onClose} className="text-white/70 hover:text-white">✕</button>
        </div>

        <div className="p-4 flex flex-col gap-4 text-sm">
          {/* Name */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-white/70">Название</label>
              <span className={`text-xs ${name.length > 24 ? 'text-red-400' : 'text-white/40'}`}>
                {name.length}/24
              </span>
            </div>
            <input
              type="text"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название союза..."
              className="w-full rounded px-3 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-white/40"
            />
            {name.length > 0 && !nameValid && (
              <div className="text-xs text-red-400 mt-1">
                {name.length < 2 ? 'Минимум 2 символа' : !NAME_RE.test(name) ? 'Только буквы, цифры, пробел, - _' : ''}
              </div>
            )}
          </div>

          {/* Icon */}
          <div>
            <div className="text-white/70 mb-2">Иконка эмблемы</div>
            <div className="grid grid-cols-4 gap-2">
              {ICONS.map((ic) => (
                <button
                  key={ic.key}
                  onClick={() => setSelectedIcon(ic.key)}
                  className="flex items-center justify-center text-2xl rounded"
                  style={{
                    height: 44,
                    background: selectedIcon === ic.key ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                    border: selectedIcon === ic.key ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
                  }}
                >
                  {ic.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <div className="text-white/70 mb-2">Цвет эмблемы</div>
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
                    border: selectedColor === c.key ? '3px solid #fff' : '3px solid transparent',
                    transform: selectedColor === c.key ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* minEssence */}
          <div>
            <div className="text-white/70 mb-2">Минимум 💎 для вступления</div>
            <div className="flex gap-2">
              {MIN_ESSENCE_OPTIONS.map((v) => (
                <button
                  key={v}
                  onClick={() => setMinEssence(v)}
                  className="flex-1 py-1.5 rounded text-xs font-semibold"
                  style={{
                    background: minEssence === v ? '#16a34a' : 'rgba(255,255,255,0.08)',
                    color: minEssence === v ? '#fff' : 'rgba(255,255,255,0.6)',
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
            style={{ background: canAfford ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)' }}
          >
            Стоимость: 3 💎. У тебя: {playerEssence} 💎.
            {!canAfford && <span className="ml-1 text-red-400">Недостаточно</span>}
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded text-sm text-white/60 hover:text-white"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="flex-1 py-2 rounded text-sm font-semibold transition-opacity"
              style={{
                background: submitDisabled ? 'rgba(255,255,255,0.1)' : '#16a34a',
                color: submitDisabled ? 'rgba(255,255,255,0.3)' : '#fff',
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
