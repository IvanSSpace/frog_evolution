import type { ClanListItem as ClanListItemType } from '../../api/clan'
import { useClanStore } from '../../store/clan/slice'
import { joinClan } from '../../api/clan'
import { useState } from 'react'
import { FrogEmblem } from './FrogEmblem'

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
    <div className="flex items-center gap-3 py-2 px-1" style={{ borderBottom: '1px solid rgba(77,107,31,0.15)' }}>
      <div className="flex-shrink-0">
        <FrogEmblem
          variant={item.emblem.variant}
          style={item.emblem.style}
          bg={item.emblem.bg}
          frog={item.emblem.frog}
          topColor={item.emblem.topColor}
          stripeColor={item.emblem.stripeColor}
          size={48}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate" style={{ color: '#1f2937' }}>{item.name}</div>
        <div className="text-xs" style={{ color: '#6b7280' }}>
          👥 {item.memberCount}/30
          {item.minEssence > 0 && <span className="ml-2">💎 ≥{item.minEssence}</span>}
        </div>
        {error && <div className="text-xs text-red-500 mt-0.5">{error}</div>}
      </div>

      <button
        onClick={handleJoin}
        disabled={disabled || loading}
        className="flex-shrink-0 text-xs px-3 py-1.5 rounded font-semibold transition-opacity"
        style={{
          background: disabled ? 'rgba(0,0,0,0.1)' : '#16a34a',
          color: disabled ? '#9ca3af' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {buttonLabel()}
      </button>
    </div>
  )
}
