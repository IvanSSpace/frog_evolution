import type { ClanSnapshot } from '../../api/clan'

interface Props {
  clan: ClanSnapshot['clan']
  memberCount: number
  onOpenRoster: () => void
}

export function ClanHeader({ clan, memberCount, onOpenRoster }: Props) {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-white/10">
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-lg text-xl"
        style={{
          width: 40,
          height: 40,
          background: clan.emblemColor,
        }}
      >
        {clan.emblemIcon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-white truncate">{clan.name}</div>
        <div className="text-xs text-white/50">Участников: {memberCount}/30</div>
      </div>
      <button
        onClick={onOpenRoster}
        title="Участники союза"
        className="flex-shrink-0 text-lg text-white/60 hover:text-white transition-colors"
      >
        ⚙
      </button>
    </div>
  )
}
