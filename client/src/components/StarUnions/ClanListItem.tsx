import type { ClanListItem as ClanListItemType } from '../../api/clan'
import { useClanStore } from '../../store/clan/slice'
import { joinClan } from '../../api/clan'
import { useState } from 'react'

const ICON_MAP: Record<string, string> = {
  rocket: '🚀',
  star: '⭐',
  crown: '👑',
  shield: '🛡️',
  comet: '☄️',
  planet: '🪐',
  galaxy: '🌌',
  moon: '🌙',
}

const COLOR_MAP: Record<string, string> = {
  teal: '#0d9488',
  purple: '#9333ea',
  amber: '#d97706',
  rose: '#e11d48',
  sky: '#0284c7',
  mint: '#16a34a',
}

interface Props {
  item: ClanListItemType
  disabled: boolean
  disabledReason: 'cooldown' | 'essence' | 'full' | null
}

export function ClanListItem({ item, disabled, disabledReason }: Props) {
  const setSnapshot = useClanStore((s) => s.setSnapshot)
  const setCooldown = useClanStore((s) => s.setCooldown)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const emblemBg = COLOR_MAP[item.emblemColor] ?? '#4b5563'
  const emblemIcon = ICON_MAP[item.emblemIcon] ?? '⭐'

  async function handleJoin() {
    if (disabled || loading) return
    setLoading(true)
    setError(null)
    try {
      const r = await joinClan(item.id)
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function buttonLabel(): string {
    if (disabledReason === 'cooldown') return 'Кулдаун'
    if (disabledReason === 'full') return 'Полно'
    if (disabledReason === 'essence') return `💎 нужно ${item.minEssence}`
    return loading ? '...' : 'Вступить'
  }

  return (
    <div className="flex items-center gap-3 py-2 px-1 border-b border-white/10">
      <div
        className="flex-shrink-0 flex items-center justify-center rounded text-2xl"
        style={{
          width: 48,
          height: 48,
          background: emblemBg,
        }}
      >
        {emblemIcon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{item.name}</div>
        <div className="text-xs text-white/60">
          👥 {item.memberCount}/30
          {item.minEssence > 0 && <span className="ml-2">💎 ≥{item.minEssence}</span>}
        </div>
        {error && <div className="text-xs text-red-400 mt-0.5">{error}</div>}
      </div>

      <button
        onClick={handleJoin}
        disabled={disabled || loading}
        className="flex-shrink-0 text-xs px-3 py-1.5 rounded font-semibold transition-opacity"
        style={{
          background: disabled ? 'rgba(255,255,255,0.1)' : '#16a34a',
          color: disabled ? 'rgba(255,255,255,0.4)' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {buttonLabel()}
      </button>
    </div>
  )
}
