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
// Phase 22 Plan 22-06: Star Map (виртуальная 6-я локация) скрыта до cosmos unlock.
import { useCosmosUnlocked } from '../../utils/cosmosGate'

// Эмодзи и цвета для локаций (placeholder — потом юзер заменит на свои картинки)
const LOCATION_VISUAL: Record<
  number,
  { emoji: string; from: string; to: string; border: string }
> = {
  1: { emoji: '🌿', from: '#bef264', to: '#65a30d', border: '#365314' }, // Болото
  2: { emoji: '🌲', from: '#86efac', to: '#15803d', border: '#14532d' }, // Лес
  3: { emoji: '🌍', from: '#fca5a5', to: '#b91c1c', border: '#7f1d1d' }, // Континент
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
  const locationFrogs = useGameStore((s) => s.locationFrogs)
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
  isPulsing = false,
}: {
  loc: LocationConfig
  isCurrent: boolean
  onClick: () => void
  disabled?: boolean
  /** Phase 23 Plan 23-05: pulse + glow на новой location button после unlock. */
  isPulsing?: boolean
}) {
  const { t } = useTranslation()
  const locName = t(`locations.${loc.id}`)
  const v = LOCATION_VISUAL[loc.id] ?? LOCATION_VISUAL[1]

  // Box shadow assembly — pulse-glow override'ит обычный isCurrent ring (pink
  // glow #ec4899 более яркий, чем isCurrent's solid pink ring). Pulse > Current.
  const baseShadow = 'inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 0 rgba(0,0,0,0.25)'
  let boxShadow: string
  if (isPulsing) {
    // 16px glow + 4px spread #ec4899 → видимый pulse-ring «новая локация».
    boxShadow = `${baseShadow}, 0 0 16px 4px #ec4899`
  } else if (isCurrent) {
    boxShadow = `inset 0 1px 0 rgba(255,255,255,0.5), 0 0 0 2px #ec4899, 0 2px 0 rgba(0,0,0,0.25)`
  } else {
    boxShadow = baseShadow
  }

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
        type="button"
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
          boxShadow,
          fontSize: 20,
          lineHeight: 1,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Pulse bobble (1.2s loop, infinite) перебивает isCurrent scale.
          // Если ни pulse ни isCurrent — обычный 1.0 без анимации.
          // transition только когда нет infinite animation — иначе мерцает.
          transform:
            isPulsing || isCurrent
              ? isCurrent && !isPulsing
                ? 'scale(1.05)'
                : undefined
              : 'scale(1)',
          transition: isPulsing ? undefined : 'transform 120ms',
          animation: isPulsing
            ? 'onb-loc-bobble 1200ms ease-in-out infinite'
            : undefined,
        }}
      >
        <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' }}>
          {v.emoji}
        </span>
      </button>
    </div>
  )
}
