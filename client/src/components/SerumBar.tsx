import { useGameStore } from '../store/gameStore'
import { eventBus } from '../store/eventBus'
import { ELEMENTS, type Element, type Rarity } from '../store/cosmic/types'
import { ELEMENT_TINT, ELEMENT_BOTTLE_FILTER } from './CosmicHub/ElementGrid'
import { hapticImpact } from '../utils/telegram'

const RARITY_LOCATION: Record<Rarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

const LOCATION_RARITY: Record<number, Rarity> = {
  1: 'common',
  2: 'rare',
  3: 'epic',
  4: 'legendary',
}

export function SerumBar() {
  const serums = useGameStore((s) => s.serums)
  const setSerumDragActive = useGameStore((s) => s.setSerumDragActive)
  const setCurrentLocation = useGameStore((s) => s.setCurrentLocation)
  const selectedSerum = useGameStore((s) => s.selectedSerum)
  const serumDragActive = useGameStore((s) => s.serumDragActive)
  const currentLocation = useGameStore((s) => s.currentLocation)

  // Показываем только редкость текущей локации
  const locationRarity = LOCATION_RARITY[currentLocation]

  const slots: { element: Element; rarity: Rarity; count: number }[] = []
  if (locationRarity) {
    for (const element of ELEMENTS) {
      const count = serums[element][locationRarity] ?? 0
      if (count > 0) slots.push({ element, rarity: locationRarity, count })
    }
  }

  if (slots.length === 0) return null

  const handleTap = (element: Element, rarity: Rarity) => {
    hapticImpact('light')
    // Повторный тап по активной — снять выбор
    if (
      serumDragActive &&
      selectedSerum?.element === element &&
      selectedSerum?.rarity === rarity
    ) {
      setSerumDragActive(false)
      return
    }
    setCurrentLocation(RARITY_LOCATION[rarity])
    setSerumDragActive(true, { element, rarity })
    eventBus.emit('cosmic:select-serum', { element, rarity })
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '13%',
        left: 0,
        right: 0,
        height: 76,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 10,
          paddingRight: 10,
          pointerEvents: 'auto',
          // Скрыть скроллбар
          scrollbarWidth: 'none',
        }}
      >
        {slots.map(({ element, rarity, count }) => {
          const tint = ELEMENT_TINT[element]
          const isActive =
            serumDragActive &&
            selectedSerum?.element === element &&
            selectedSerum?.rarity === rarity

          return (
            <button
              key={`${element}:${rarity}`}
              onClick={() => handleTap(element, rarity)}
              style={{
                flexShrink: 0,
                width: 52,
                height: 60,
                borderRadius: 10,
                border: `2px solid ${tint}`,
                backgroundColor: isActive
                  ? `${tint}40`
                  : 'rgba(10, 10, 15, 0.75)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                position: 'relative',
                outline: isActive ? `2px solid ${tint}` : undefined,
                outlineOffset: 2,
                transform: isActive ? 'scale(1.1)' : undefined,
                transition: 'transform 0.15s, background-color 0.15s',
                boxShadow: isActive ? `0 0 10px ${tint}88` : undefined,
              }}
            >
              {/* Count badge */}
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  background: '#10b981',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 99,
                  minWidth: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingLeft: 3,
                  paddingRight: 3,
                }}
              >
                {count > 99 ? '99+' : count}
              </span>

              {/* Bottle */}
              <img
                src="/genBottle.svg"
                alt={element}
                style={{
                  height: 34,
                  width: 'auto',
                  filter: ELEMENT_BOTTLE_FILTER[element],
                  pointerEvents: 'none',
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
