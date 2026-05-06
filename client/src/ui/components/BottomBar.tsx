import React from 'react'

type BadgeProps = { children: React.ReactNode }

function NotifBadge({ children }: BadgeProps) {
  return <span className="ff-badge">{children}</span>
}

type TileSkin = 'mint' | 'green' | 'purple' | 'red' | 'teal' | 'amber' | 'cream'

type TileProps = {
  emoji: string
  skin: TileSkin
  size?: 'md' | 'lg'
  badge?: boolean
  onClick?: () => void
}

const SKIN_VARS: Record<TileSkin, React.CSSProperties> = {
  mint:   { ['--ff-tile-from' as never]: '#a7f3d0', ['--ff-tile-to' as never]: '#34d399', ['--ff-tile-border' as never]: '#065f46' },
  green:  { ['--ff-tile-from' as never]: '#86efac', ['--ff-tile-to' as never]: '#16a34a', ['--ff-tile-border' as never]: '#14532d' },
  purple: { ['--ff-tile-from' as never]: '#d8b4fe', ['--ff-tile-to' as never]: '#9333ea', ['--ff-tile-border' as never]: '#3b0764' },
  red:    { ['--ff-tile-from' as never]: '#fca5a5', ['--ff-tile-to' as never]: '#dc2626', ['--ff-tile-border' as never]: '#7f1d1d' },
  teal:   { ['--ff-tile-from' as never]: '#5eead4', ['--ff-tile-to' as never]: '#0d9488', ['--ff-tile-border' as never]: '#134e4a' },
  amber:  { ['--ff-tile-from' as never]: '#fcd34d', ['--ff-tile-to' as never]: '#d97706', ['--ff-tile-border' as never]: '#78350f' },
  cream:  { ['--ff-tile-from' as never]: '#fef3c7', ['--ff-tile-to' as never]: '#fbbf24', ['--ff-tile-border' as never]: '#78350f' },
}

function Tile({ emoji, skin, size = 'md', badge = false, onClick }: TileProps) {
  const dim = size === 'lg' ? 'w-16 h-16 text-3xl' : 'w-12 h-12 text-2xl'
  return (
    <button
      onClick={onClick}
      style={{ pointerEvents: 'auto', ...SKIN_VARS[skin] }}
      className={`ff-tile flex-shrink-0 ${dim} active:scale-100`}
    >
      <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' }}>{emoji}</span>
      {badge && <NotifBadge>!</NotifBadge>}
    </button>
  )
}

type BottomBarProps = {
  onOpenShop?: () => void
  onOpenFrogShop?: () => void
  onOpenSettings?: () => void
}

export function BottomBar({ onOpenShop, onOpenFrogShop, onOpenSettings }: BottomBarProps) {
  return (
    <div className="ff-bar bottom w-full h-full flex items-center justify-between px-3 py-2"
         style={{ pointerEvents: 'auto' }}>
      {/* Слева — лавка лягушек */}
      <Tile emoji="🐸" skin="mint" size="lg" onClick={onOpenFrogShop} />

      {/* Центр — действия */}
      <div className="flex gap-2 items-center">
        <Tile emoji="⬆️"  skin="green"  onClick={onOpenShop} />
        <Tile emoji="🎨"  skin="purple" badge />
        <Tile emoji="🎁"  skin="red"    badge />
        <Tile emoji="🛍️" skin="teal" />
      </div>

      {/* Справа — журнал */}
      <Tile emoji="📖" skin="cream" size="lg" badge onClick={onOpenSettings} />
    </div>
  )
}
