import type { ClanSnapshot } from '../../api/clan'
import { FrogEmblem } from './FrogEmblem'

interface Props {
  clan: ClanSnapshot['clan']
  memberCount: number
  onOpenRoster: () => void
}

export function ClanHeader({ clan, memberCount, onOpenRoster }: Props) {
  return (
    <div className="ff-card flex items-center gap-3 flex-shrink-0" style={{ padding: '12px 14px', margin: '0 0 8px' }}>
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
        <div className="ff-display truncate" style={{ fontSize: 17, color: '#2f1f0e' }}>{clan.name}</div>
        <div className="text-xs mt-0.5" style={{ color: '#7a5a2f' }}>👥 {memberCount}/30</div>
      </div>
      <button
        onClick={onOpenRoster}
        title="Участники союза"
        className="ff-tile w-10 h-10 text-xl flex-shrink-0"
        style={{
          ['--ff-tile-from' as never]: '#c4b5fd',
          ['--ff-tile-to' as never]: '#7c3aed',
          ['--ff-tile-border' as never]: '#3b0764',
          color: '#fff',
        }}
      >
        ⚙
      </button>
    </div>
  )
}
