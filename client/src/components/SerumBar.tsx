// Phase 22: SerumBar — отображает серумы из плоского Record<Element, number>.
// Один тип серума per element, без rarity stripes/sections.
// Tap → setSerumDragActive + eventBus select-serum → modal closes, frogs visible.

import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { eventBus } from '../store/eventBus'
import { ELEMENTS, type Element } from '../store/cosmic/types'
import { ELEMENT_TINT, ELEMENT_BOTTLE_FILTER } from './CosmicHub/ElementGrid'
import { hapticImpact } from '../utils/telegram'
// Phase 22 Plan 22-06: cosmos gate — SerumBar скрыт до первого L18+L18.
import { useCosmosUnlocked } from '../utils/cosmosGate'

export function SerumBar() {
  const unlocked = useCosmosUnlocked()
  const serums = useGameStore((s) => s.serums)
  const setSerumDragActive = useGameStore((s) => s.setSerumDragActive)
  const selectedSerum = useGameStore((s) => s.selectedSerum)
  const serumDragActive = useGameStore((s) => s.serumDragActive)
  // Серум applies только на L1 frogs (которые живут только на 1-й локации — Болото).
  const currentLocation = useGameStore((s) => s.currentLocation)

  const [starMapActive, setStarMapActive] = useState(false)

  useEffect(() => {
    const onOpen = () => setStarMapActive(true)
    const onClose = () => setStarMapActive(false)
    eventBus.on('starmap:open', onOpen)
    eventBus.on('starmap:close', onClose)
    return () => {
      eventBus.off('starmap:open', onOpen)
      eventBus.off('starmap:close', onClose)
    }
  }, [])

  // Phase 22: show all elements that have at least 1 serum
  const slots: { element: Element; count: number }[] = []
  for (const element of ELEMENTS) {
    const count = serums[element] ?? 0
    if (count > 0) slots.push({ element, count })
  }

  if (!unlocked) return null // Phase 22 Plan 22-06: cosmos gate
  if (starMapActive) return null
  if (currentLocation !== 1) return null // серум applies только на L1 frogs (только Болото id=1)
  if (slots.length === 0) return null

  const handleTap = (element: Element) => {
    hapticImpact('light')
    // Повторный тап по активной — снять выбор
    if (serumDragActive && selectedSerum?.element === element) {
      setSerumDragActive(false)
      return
    }
    setSerumDragActive(true, { element })
    eventBus.emit('cosmic:select-serum', { element })
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
        {slots.map(({ element, count }) => {
          const tint = ELEMENT_TINT[element]
          const isActive = serumDragActive && selectedSerum?.element === element

          return (
            <button
              key={element}
              type="button"
              onClick={() => handleTap(element)}
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
