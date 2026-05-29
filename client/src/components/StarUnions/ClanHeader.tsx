import type { ClanSnapshot } from '../../api/clan'
import { FrogEmblem } from './FrogEmblem'

interface Props {
  clan: ClanSnapshot['clan']
  memberCount: number
  onOpenRoster: () => void
}

export function ClanHeader({ clan, memberCount, onOpenRoster }: Props) {
  return (
    <button
      type="button"
      onClick={onOpenRoster}
      title="Участники союза"
      className="ff-card flex items-center gap-3 w-full text-left"
      style={{ padding: '12px 14px', margin: 0 }}
    >
      <div className="flex-shrink-0">
        <FrogEmblem
          variant={clan.emblem.variant}
          style={clan.emblem.style}
          bg={clan.emblem.bg}
          frog={clan.emblem.frog}
          topColor={clan.emblem.topColor}
          stripeColor={clan.emblem.stripeColor}
          size={48}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="ff-display truncate"
          style={{
            fontSize: 17,
            color: '#e6ffd0',
            fontWeight: 800,
            textShadow:
              '0 2px 0 rgba(0,0,0,0.3), 0 0 12px rgba(95,216,58,0.25)',
          }}
        >
          {clan.name}
        </div>
        <div
          className="text-xs mt-0.5"
          style={{ color: 'var(--ff-text-dim)' }}
        >
          👥 {memberCount}/30
        </div>
      </div>
    </button>
  )
}
