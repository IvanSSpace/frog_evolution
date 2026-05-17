import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useGameStore,
  LOCATIONS,
  getLocationById,
  type LocationConfig,
} from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { hapticSelection } from '../../utils/telegram'

// Эмодзи и цвета для локаций (placeholder — потом юзер заменит на свои картинки)
const LOCATION_VISUAL: Record<
  number,
  { emoji: string; from: string; to: string; border: string }
> = {
  1: { emoji: '💧', from: '#bae6fd', to: '#0284c7', border: '#0c4a6e' }, // Лужа
  2: { emoji: '🌿', from: '#bef264', to: '#65a30d', border: '#365314' }, // Болото
  3: { emoji: '🌲', from: '#86efac', to: '#15803d', border: '#14532d' }, // Лес
  4: { emoji: '🌍', from: '#fca5a5', to: '#b91c1c', border: '#7f1d1d' }, // Континент (upgrades/buildings)
  6: { emoji: '✨', from: '#67e8f9', to: '#0e7490', border: '#164e63' }, // Звёздная карта (тест)
}

// Виртуальная 6-я локация — тестовая, открывает прототип Звёздной карты в модалке.
// НЕ часть LOCATIONS, чтобы не ломать существующую игровую логику.
const STAR_MAP_PROTOTYPE_ID = 6
const STAR_MAP_PROTOTYPE_LOC: LocationConfig = {
  id: STAR_MAP_PROTOTYPE_ID,
  name: 'Звёздная карта',
  minLevel: 19,
  maxLevel: 24,
  magnetEnabled: false,
}

export function LocationStack() {
  const currentLocation = useGameStore((s) => s.currentLocation)
  const setCurrentLocation = useGameStore((s) => s.setCurrentLocation)
  const [collapsed, setCollapsed] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  // Активна ли Звёздная карта (виртуальная 6-я). НЕ хранится в gameStore —
  // это локальный UI-режим, не игровая локация.
  const [starMapActive, setStarMapActive] = useState(false)
  // Локальный лок на время starmap-перехода (~900мс), чтобы не словить двойной клик
  const [starMapTransitioning, setStarMapTransitioning] = useState(false)

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

  // Полупрозрачные header/bottom-bar когда открыта Звёздная карта
  useEffect(() => {
    if (starMapActive) document.body.classList.add('starmap-mode')
    else document.body.classList.remove('starmap-mode')
    return () => {
      document.body.classList.remove('starmap-mode')
    }
  }, [starMapActive])

  // Сверху вниз: 6 (Звёздная карта) → 3 → 2 → 1
  // Прогрессивный анлок временно отключён (по запросу автора) —
  // все локации видны всегда. Helper `getUnlockedLocations` и
  // эмиты `'location:unlocked'` оставлены в коде на месте, но
  // не гейтят отображение.
  const ordered: LocationConfig[] = [
    STAR_MAP_PROTOTYPE_LOC,
    ...[...LOCATIONS].slice().reverse(),
  ]

  const handleSelect = (id: number) => {
    if (transitioning || starMapTransitioning) return
    if (id === STAR_MAP_PROTOTYPE_ID) {
      // Звёздная карта — переключаем Phaser-сцены через event bus
      if (starMapActive) {
        // Уже на карте → центрируем камеру на HOME
        hapticSelection()
        eventBus.emit('starmap:centerHome')
        return
      }
      hapticSelection()
      setStarMapTransitioning(true)
      setStarMapActive(true)
      eventBus.emit('starmap:open')
      window.setTimeout(() => setStarMapTransitioning(false), 1100)
      return
    }
    // Любая обычная локация: если карта была открыта — закрываем
    if (starMapActive) {
      hapticSelection()
      setStarMapTransitioning(true)
      eventBus.emit('starmap:close')
      setStarMapActive(false)
      window.setTimeout(() => setStarMapTransitioning(false), 1000)
      // Ферма-локация переключится только если отличается, и без анимации перехода
      // между фарм-локациями (она бы стартовала во время return-fade и сломала всё)
      if (id !== currentLocation) {
        setCurrentLocation(id)
      }
      return
    }
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
    <>
      <div
        style={{
          position: 'fixed',
          top: 'calc(12% + 8px)',
          right: 8,
          left: 'auto',
          zIndex: 50,
          pointerEvents: 'none', // обёртка прозрачная для кликов; auto только на самих кнопках
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
        }}
      >
        {!collapsed ? (
          ordered.map((loc) => (
            <LocationButton
              key={loc.id}
              loc={loc}
              isCurrent={
                loc.id === STAR_MAP_PROTOTYPE_ID
                  ? starMapActive
                  : !starMapActive && loc.id === currentLocation
              }
              disabled={transitioning && loc.id !== STAR_MAP_PROTOTYPE_ID}
              onClick={() => handleSelect(loc.id)}
            />
          ))
        ) : (
          <>
            {starMapActive ? (
              <LocationButton
                loc={STAR_MAP_PROTOTYPE_LOC}
                isCurrent
                disabled={transitioning}
                onClick={toggleCollapse}
              />
            ) : (
              <>
                <LocationButton
                  loc={STAR_MAP_PROTOTYPE_LOC}
                  isCurrent={false}
                  disabled={false}
                  onClick={() => handleSelect(STAR_MAP_PROTOTYPE_ID)}
                />
                <LocationButton
                  loc={getLocationById(currentLocation)}
                  isCurrent
                  disabled={transitioning}
                  onClick={toggleCollapse}
                />
              </>
            )}
          </>
        )}

        <button
          onClick={toggleCollapse}
          disabled={transitioning}
          aria-label={collapsed ? 'развернуть' : 'свернуть'}
          style={{
            pointerEvents: 'auto',
            cursor: transitioning ? 'not-allowed' : 'pointer',
            width: 38,
            height: 22,
            background: 'linear-gradient(180deg, #f9a8d4 0%, #db2777 100%)',
            border: '2px solid #831843',
            borderBottomWidth: 3,
            borderRadius: 8,
            color: '#fff',
            fontSize: 11,
            lineHeight: '18px',
            fontWeight: 900,
            textShadow: '0 1px 0 rgba(0,0,0,0.4)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 0 rgba(0,0,0,0.25)',
            textAlign: 'center',
            padding: '0 0 1px 0',
            marginTop: 2,
          }}
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>
    </>
  )
}

function LocationButton({
  loc,
  isCurrent,
  onClick,
  disabled = false,
}: {
  loc: LocationConfig
  isCurrent: boolean
  onClick: () => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const locName = t(`locations.${loc.id}`)
  const v = LOCATION_VISUAL[loc.id] ?? LOCATION_VISUAL[1]

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
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
        <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' }}>
          {v.emoji}
        </span>
      </button>
    </div>
  )
}
