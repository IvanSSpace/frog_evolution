import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore, LOCATIONS, getLocationById, type LocationConfig } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { hapticSelection } from '../../utils/telegram'

// Эмодзи и цвета для локаций (placeholder — потом юзер заменит на свои картинки)
const LOCATION_VISUAL: Record<number, { emoji: string; from: string; to: string; border: string }> = {
  1: { emoji: '🌿', from: '#bef264', to: '#65a30d', border: '#365314' }, // Болото
  2: { emoji: '🌲', from: '#86efac', to: '#15803d', border: '#14532d' }, // Лес
  3: { emoji: '🌍', from: '#7dd3fc', to: '#0369a1', border: '#0c4a6e' }, // Земля
  4: { emoji: '🪐', from: '#fca5a5', to: '#b91c1c', border: '#7f1d1d' }, // Космос
}

export function LocationStack() {
  const currentLocation = useGameStore((s) => s.currentLocation)
  const setCurrentLocation = useGameStore((s) => s.setCurrentLocation)
  const [collapsed, setCollapsed] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    const onStart = () => setTransitioning(true)
    const onEnd = () => setTransitioning(false)
    eventBus.on('location:transitionStart', onStart)
    eventBus.on('location:transitionEnd', onEnd)
    return () => {
      eventBus.off('location:transitionStart', onStart)
      eventBus.off('location:transitionEnd', onEnd)
    }
  }, [])

  // Сверху вниз — от высшей локации (Космос) к стартовой (Болото)
  const ordered = [...LOCATIONS].slice().reverse()

  const handleSelect = (id: number) => {
    if (transitioning) return
    if (id === currentLocation) return
    hapticSelection()
    setCurrentLocation(id)
  }

  const toggleCollapse = () => {
    if (transitioning) return // нельзя сворачивать пока идёт переход
    hapticSelection()
    setCollapsed((v) => !v)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(12% + 2px)',
        right: 12,
        left: 'auto',
        zIndex: 50,
        pointerEvents: 'none', // обёртка прозрачная для кликов; auto только на самих кнопках
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 4,
      }}
    >
      {!collapsed
        ? ordered.map((loc) => (
            <LocationButton
              key={loc.id}
              loc={loc}
              isCurrent={loc.id === currentLocation}
              disabled={transitioning}
              onClick={() => handleSelect(loc.id)}
            />
          ))
        : (
            <LocationButton
              loc={getLocationById(currentLocation)}
              isCurrent
              disabled={transitioning}
              onClick={toggleCollapse}
            />
          )}

      <button
        onClick={toggleCollapse}
        disabled={transitioning}
        aria-label={collapsed ? 'развернуть' : 'свернуть'}
        style={{
          pointerEvents: 'auto',
          cursor: transitioning ? 'not-allowed' : 'pointer',
          width: 28,
          height: 18,
          background: 'linear-gradient(180deg, #f9a8d4 0%, #db2777 100%)',
          border: '2px solid #831843',
          borderBottomWidth: 3,
          borderRadius: 6,
          color: '#fff',
          fontSize: 10,
          fontWeight: 900,
          textShadow: '0 1px 0 rgba(0,0,0,0.4)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 0 rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          marginTop: 2,
        }}
      >
        {collapsed ? '▼' : '▲'}
      </button>
    </div>
  )
}

function LocationButton({
  loc, isCurrent, onClick, disabled = false,
}: { loc: LocationConfig; isCurrent: boolean; onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation()
  const locName = t(`locations.${loc.id}`)
  const v = LOCATION_VISUAL[loc.id] ?? LOCATION_VISUAL[1]

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {/* Розовая стрелка-указатель текущей локации, как в референсе */}
      {isCurrent && (
        <div
          style={{
            position: 'absolute',
            left: -10,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderLeft: '9px solid #ec4899',
            filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.3))',
          }}
        />
      )}
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={locName}
        title={locName}
        style={{
          pointerEvents: 'auto',
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: `linear-gradient(180deg, ${v.from} 0%, ${v.to} 100%)`,
          border: '2px solid ' + v.border,
          boxShadow: isCurrent
            ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 0 0 2px #ec4899, 0 2px 0 rgba(0,0,0,0.25)`
            : 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 0 rgba(0,0,0,0.25)',
          fontSize: 20,
          lineHeight: 1,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: isCurrent ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 120ms',
        }}
      >
        <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' }}>{v.emoji}</span>
      </button>
    </div>
  )
}
