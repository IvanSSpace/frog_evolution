import { useEffect, useState } from 'react'
import {
  useGameStore,
  LOCATIONS,
  getLocationById,
  type LocationConfig,
} from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { hapticSelection } from '../../utils/telegram'
// Phase 22 Plan 22-06: Star Map (виртуальная 6-я локация) скрыта до cosmos unlock.
import { useCosmosUnlocked } from '../../utils/cosmosGate'
import { LocationButton } from './LocationButton'

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
  const locationFrogs = useGameStore((s) => s.locationFrogs)
  const battleSceneActive = useGameStore((s) => s.battleSceneActive)
  // Phase 22 Plan 22-06: cosmos gate — pre-cosmos Star Map (id=6) скрыта.
  const cosmosUnlocked = useCosmosUnlocked()
  const [collapsed, setCollapsed] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  // Активна ли Звёздная карта (виртуальная 6-я). НЕ хранится в gameStore —
  // это локальный UI-режим, не игровая локация.
  const [starMapActive, setStarMapActive] = useState(false)
  // Локальный лок на время starmap-перехода (~900мс), чтобы не словить двойной клик
  const [starMapTransitioning, setStarMapTransitioning] = useState(false)
  // Phase 23 Plan 23-05 (Beat 4): pulse на новой location button после unlock.
  // null = ни одна кнопка не пульсирует. Set'ится по 'celebrationStart' event,
  // clear'ится по 'celebrationDismiss' (emit'ит сам LocationStack по tap).
  // Pulse persists пока игрок не тапнет кнопку — toast auto-fade его НЕ гасит.
  const [pulsingLocationId, setPulsingLocationId] = useState<number | null>(
    null,
  )

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

  // Phase 23 Plan 23-05: subscribe на celebration events.
  // Pulse ON на 'Start' (от OnboardingController), OFF на 'Dismiss'
  // (от наших же handleSelect когда player тапнул pulsing button).
  useEffect(() => {
    const onCelebStart = ({ locationId }: { locationId: number }) => {
      setPulsingLocationId(locationId)
    }
    const onCelebDismiss = () => {
      setPulsingLocationId(null)
    }
    eventBus.on('onboarding:locationCelebrationStart', onCelebStart)
    eventBus.on('onboarding:locationCelebrationDismiss', onCelebDismiss)
    return () => {
      eventBus.off('onboarding:locationCelebrationStart', onCelebStart)
      eventBus.off('onboarding:locationCelebrationDismiss', onCelebDismiss)
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

  // Сверху вниз: 6 (Звёздная карта) → 4 → 3 → 2 → 1
  // Phase 22 Plan 22-06: Звёздная карта (id=6) скрыта до cosmos unlock.
  // Фильтр локаций по наличию лягушек:
  //   - Болото (id=1) — всегда видна (стартовая локация)
  //   - Текущая локация — всегда видна (иначе игрок застрянет)
  //   - Остальные — только если на них есть хотя бы одна лягушка
  // Прогрессивный анлок по discoveredLevels отключён — populated-фильтр заменяет.
  const farmLocations = [...LOCATIONS]
    .slice()
    .reverse()
    .filter((loc) => {
      if (loc.id === 1) return true
      if (loc.id === currentLocation) return true
      const frogs = locationFrogs[loc.id - 1] ?? []
      return frogs.length > 0
    })
  const ordered: LocationConfig[] = cosmosUnlocked
    ? [STAR_MAP_PROTOTYPE_LOC, ...farmLocations]
    : farmLocations

  // Если visible только одна локация (Болото) и cosmos не разблокирован —
  // блок переключения не нужен (нечего переключать).
  if (ordered.length <= 1) return null
  // Во время вспомогательных сцен (ShipDeck/Survivor) блок переключения скрываем.
  if (battleSceneActive) return null

  const handleSelect = (id: number) => {
    if (transitioning || starMapTransitioning) return
    // Phase 23 Plan 23-05: тап по пульсирующей кнопке гасит pulse + toast.
    // Эмитим dismiss ДО логики transition — pulse-state должен сняться даже
    // если transition заблокирован (id === currentLocation возврат ниже).
    if (id === pulsingLocationId) {
      eventBus.emit('onboarding:locationCelebrationDismiss', { locationId: id })
    }
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
      {/* Phase 23 Plan 23-05 (Beat 4): pulse keyframes для location button после
          unlock. Bobble — scale 1.0↔1.1, 1.2s loop, infinite. CSS keyframes
          (НЕ Lottie) per memory feedback_animations. */}
      <style>{`
        @keyframes onb-loc-bobble {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad) + 8px)',
          right: 8,
          left: 'auto',
          zIndex: 50,
          pointerEvents: 'none',
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
          // Чёрный фон-обёртка вокруг кнопок локаций. height auto по контенту.
          background: '#000',
          padding: '8px 10px',
          borderRadius: 16,
          height: 'fit-content',
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
              isPulsing={loc.id === pulsingLocationId}
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
                isPulsing={STAR_MAP_PROTOTYPE_ID === pulsingLocationId}
                disabled={transitioning}
                onClick={toggleCollapse}
              />
            ) : (
              <>
                {/* Phase 22 Plan 22-06: Star Map button скрыта до cosmos unlock. */}
                {cosmosUnlocked && (
                  <LocationButton
                    loc={STAR_MAP_PROTOTYPE_LOC}
                    isCurrent={false}
                    isPulsing={STAR_MAP_PROTOTYPE_ID === pulsingLocationId}
                    disabled={false}
                    onClick={() => handleSelect(STAR_MAP_PROTOTYPE_ID)}
                  />
                )}
                <LocationButton
                  loc={getLocationById(currentLocation)}
                  isCurrent
                  isPulsing={currentLocation === pulsingLocationId}
                  disabled={transitioning}
                  onClick={toggleCollapse}
                />
              </>
            )}
          </>
        )}

        <button
          type="button"
          onClick={toggleCollapse}
          disabled={transitioning}
          aria-label={collapsed ? 'развернуть' : 'свернуть'}
          style={{
            pointerEvents: 'auto',
            cursor: transitioning ? 'not-allowed' : 'pointer',
            width: 38,
            height: 22,
            background: 'linear-gradient(180deg, #E5A3E6 0%, #D558D7 100%)',
            border: '2px solid #7A2B7C',
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
