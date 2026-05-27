import React from 'react'
import { useGameStore } from '../../store/gameStore'
// Phase 22 Plan 22-06: cosmos gate — 🧬 Cosmic Hub button disabled до L18+L18.
import { useCosmosUnlocked } from '../../utils/cosmosGate'
import { Icon } from '../icons/Icon'
import type { IconName } from '../icons/iconRegistry'

type BadgeProps = { children: React.ReactNode }

function NotifBadge({ children }: BadgeProps) {
  return <span className="ff-badge">{children}</span>
}

type TileSkin = 'mint' | 'green' | 'purple' | 'red' | 'teal' | 'amber' | 'cream'

type TileProps = {
  icon: IconName
  // Emoji-фолбэк: рисуется вместо Icon, когда в iconRegistry нет подходящей
  // иконки (напр. инвентарь 🎒). `icon` всё равно обязателен для lock-стейта.
  emoji?: string
  skin: TileSkin
  size?: 'md' | 'lg'
  // badge: number → показать число (если > 0); boolean → показать "!" если true.
  // undefined / 0 / false → ничего не показывать.
  badge?: number | boolean
  onClick?: () => void
  // Phase 22 Plan 22-06: disabled state (cosmos gate для 🧬 button).
  disabled?: boolean
  title?: string
}

const SKIN_VARS: Record<TileSkin, React.CSSProperties> = {
  mint: {
    ['--ff-tile-from' as never]: '#a7f3d0',
    ['--ff-tile-to' as never]: '#34d399',
    ['--ff-tile-border' as never]: '#065f46',
  },
  green: {
    ['--ff-tile-from' as never]: '#86efac',
    ['--ff-tile-to' as never]: '#16a34a',
    ['--ff-tile-border' as never]: '#14532d',
  },
  purple: {
    ['--ff-tile-from' as never]: '#d8b4fe',
    ['--ff-tile-to' as never]: '#9333ea',
    ['--ff-tile-border' as never]: '#3b0764',
  },
  red: {
    ['--ff-tile-from' as never]: '#fca5a5',
    ['--ff-tile-to' as never]: '#dc2626',
    ['--ff-tile-border' as never]: '#7f1d1d',
  },
  teal: {
    ['--ff-tile-from' as never]: '#5eead4',
    ['--ff-tile-to' as never]: '#0d9488',
    ['--ff-tile-border' as never]: '#134e4a',
  },
  amber: {
    ['--ff-tile-from' as never]: '#fcd34d',
    ['--ff-tile-to' as never]: '#d97706',
    ['--ff-tile-border' as never]: '#78350f',
  },
  cream: {
    ['--ff-tile-from' as never]: '#fef3c7',
    ['--ff-tile-to' as never]: '#fbbf24',
    ['--ff-tile-border' as never]: '#78350f',
  },
}

function Tile({
  icon,
  emoji,
  skin,
  size = 'md',
  badge,
  onClick,
  disabled = false,
  title,
}: TileProps) {
  const dim = size === 'lg' ? 'w-16 h-16' : 'w-12 h-12'
  const iconPx = size === 'lg' ? 34 : 28
  const showBadge =
    typeof badge === 'number'
      ? badge > 0
      : typeof badge === 'boolean'
        ? badge
        : false
  const badgeContent = typeof badge === 'number' ? badge : '!'
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      aria-disabled={disabled || undefined}
      style={{
        pointerEvents: 'auto',
        ...SKIN_VARS[skin],
        opacity: disabled ? 0.45 : undefined,
        cursor: disabled ? 'not-allowed' : undefined,
        filter: disabled ? 'grayscale(0.7)' : undefined,
      }}
      className={`ff-tile flex-shrink-0 ${dim}`}
    >
      {emoji && !disabled ? (
        <span
          style={{
            fontSize: iconPx,
            lineHeight: 1,
            filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))',
          }}
        >
          {emoji}
        </span>
      ) : (
        <Icon
          name={disabled ? 'lock' : icon}
          size={iconPx}
          style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' }}
        />
      )}
      {showBadge && !disabled && <NotifBadge>{badgeContent}</NotifBadge>}
    </button>
  )
}

type BottomBarProps = {
  onOpenShop?: () => void
  onOpenFrogShop?: () => void
  onOpenSettings?: () => void
  onOpenCosmicHub?: () => void
  onOpenGallery?: () => void
  onOpenExpedition?: () => void
  onOpenInventory?: () => void
}

export function BottomBar({
  onOpenShop,
  onOpenFrogShop,
  onOpenSettings,
  onOpenCosmicHub,
  onOpenGallery,
  onOpenExpedition,
  onOpenInventory,
}: BottomBarProps) {
  // Phase 11 (COSMIC-HUB-04): badge на 🧬 = число неоткрытых боксов.
  // Реактивен: при addBox/openBox селектор пере-рендерит компонент.
  const readyBoxCount = useGameStore(
    (s) => s.boxes.filter((b) => !b.opened).length,
  )
  // Phase 22 Plan 22-06: cosmos gate — 🧬 button disabled до L18+L18 sentinel.
  const cosmosUnlocked = useCosmosUnlocked()

  // Badge «новый контент» на 🐸 и 📖. true когда есть discoveredLevel,
  // которого ещё нет в соответствующем seenLevels массиве. Модалки
  // markFrogShopSeen / markBestiarySeen на mount/tab-открытии.
  const hasNewFrogShop = useGameStore((s) =>
    s.discoveredLevels.some((l) => !s.frogShopSeenLevels.includes(l)),
  )
  const hasNewBestiary = useGameStore((s) =>
    s.discoveredLevels.some((l) => !s.bestiarySeenLevels.includes(l)),
  )
  const discoveredLevels = useGameStore((s) => s.discoveredLevels)
  // Экспедиции (корабли) доступны только после открытия Леса (discovered L7+).
  const forestUnlocked = discoveredLevels.some((l) => l >= 7)

  return (
    <div
      className="ff-bar bottom w-full h-full flex items-center justify-between px-3 py-2"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Слева — лавка лягушек. Badge = есть новый discoveredLevel, ещё не открытый в shop. */}
      <Tile
        icon="frog-shop"
        skin="mint"
        size="lg"
        badge={hasNewFrogShop}
        onClick={onOpenFrogShop}
      />

      {/* Центр — действия */}
      <div className="flex gap-2 items-center">
        <Tile icon="upgrade-shop" skin="green" onClick={onOpenShop} />
        <Tile icon="gallery" skin="purple" onClick={onOpenGallery} />
        {/* 🎒 Инвентарь — космический лут + сыворотки + валюта. Нет иконки в
            registry → emoji-фолбэк. */}
        <Tile
          icon="slime"
          emoji="🎒"
          skin="amber"
          title="Инвентарь"
          onClick={onOpenInventory}
        />
        {/* 🛰️ Космическая экспедиция (Fallout-Shelter-style) — отправить
            корабль, читать бортовой журнал, вовремя вернуть. Заперта 🔒 пока
            не открыт Лес (L7): экспедиции доступны только после Леса. */}
        <Tile
          icon="ship"
          skin="teal"
          title={
            forestUnlocked ? 'Космическая экспедиция' : 'Откроется после Леса'
          }
          disabled={!forestUnlocked}
          onClick={onOpenExpedition}
        />
        {/* 🧪 Серум — перенесён вкладкой в Космический центр (CosmicHubModal). */}
        {/* 🧬 — Cosmic Hub (Phase 11). Badge = число неоткрытых боксов.
            Phase 22 Plan 22-06: disabled до L18+L18 sentinel (cosmos gate). */}
        <Tile
          icon="cosmic-hub"
          skin="teal"
          onClick={onOpenCosmicHub}
          badge={readyBoxCount}
          disabled={!cosmosUnlocked}
          title={
            !cosmosUnlocked
              ? 'Откройте космос — соедините L18 + L18'
              : undefined
          }
        />
      </div>

      {/* Справа — журнал. Badge = есть новый discoveredLevel, ещё не показанный в Bestiary tab. */}
      <Tile
        icon="bestiary"
        skin="cream"
        size="lg"
        badge={hasNewBestiary}
        onClick={onOpenSettings}
      />
    </div>
  )
}
