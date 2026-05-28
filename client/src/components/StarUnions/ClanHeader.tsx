import type { ClanSnapshot } from '../../api/clan'
import { FrogEmblem } from './FrogEmblem'

interface Props {
  clan: ClanSnapshot['clan']
  memberCount: number
  onOpenRoster: () => void
}

export function ClanHeader({ clan, memberCount, onOpenRoster }: Props) {
  return (
    <div className="flex items-center gap-3 p-3" style={{ borderBottom: '1px solid rgba(77,107,31,0.3)' }}>
      <div className="flex-shrink-0">
        <FrogEmblem
          variant={clan.emblem.variant}
          style={clan.emblem.style}
          bg={clan.emblem.bg}
          frog={clan.emblem.frog}
          topColor={clan.emblem.topColor}
          stripeColor={clan.emblem.stripeColor}
          size={40}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold truncate" style={{ color: '#1f2937' }}>{clan.name}</div>
        <div className="text-xs" style={{ color: '#6b7280' }}>Участников: {memberCount}/30</div>
      </div>
      <button
        onClick={onOpenRoster}
        title="Участники союза"
        className="flex-shrink-0 text-lg transition-colors"
        style={{ color: '#4b5563' }}
      >
        ⚙
      </button>
    </div>
  )
}
