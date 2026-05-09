// Phase 14: SerumsTab — 4 секции (legendary → epic → rare → common) с 16-cell grid.
// Tap-to-select primary (mobile + desktop), Pointer Events DnD secondary (desktop only).
//
// Tap-flow: tap cell → setSerumDragActive(true, payload) + emit cosmic:select-serum +
// onClose() (модалка закрывается, юзер видит ферму).
//
// DnD-flow (desktop only via pointerdown с pointerType !== 'touch'):
//   pointerdown → создаёт DOM ghost (32px tinted circle), follows pointer
//   onMove → emit cosmic:serum-pointer-move {x,y} (MainScene слушает + haptic medium)
//   onUp → emit cosmic:serum-pointer-up {x,y} (MainScene применяет / cancels)

import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import {
  ELEMENTS,
  RARITIES,
  type Element,
  type Rarity,
} from '../../store/cosmic/types'
import { ElementGrid, ELEMENT_TINT } from './ElementGrid'

interface Props {
  onClose: () => void // from CosmicHubModal — закрыть на select / drag start
}

export function SerumsTab({ onClose }: Props) {
  const { t } = useTranslation()
  const serums = useGameStore((s) => s.serums)
  const setSerumDragActive = useGameStore((s) => s.setSerumDragActive)

  // total count для placeholder check
  const totalCount = RARITIES.reduce((sum, r) => {
    return sum + ELEMENTS.reduce((es, e) => es + (serums[e][r] ?? 0), 0)
  }, 0)

  const handleSelect = (element: Element, rarity: Rarity) => {
    // Atomic: store mutate сначала (MainScene subscriber запустит halos),
    // event как fallback uplink, modal closes (юзер должен видеть ферму).
    setSerumDragActive(true, { element, rarity })
    eventBus.emit('cosmic:select-serum', { element, rarity })
    onClose()
  }

  const handlePointerDragStart = (
    element: Element,
    rarity: Rarity,
    x: number,
    y: number,
  ) => {
    // Создаём DOM ghost — 32px tinted circle, follows pointer.
    const ghost = document.createElement('div')
    const tint = ELEMENT_TINT[element]
    ghost.style.cssText = [
      'position: fixed',
      `left: ${x - 16}px`,
      `top: ${y - 16}px`,
      'width: 32px',
      'height: 32px',
      'border-radius: 50%',
      `background: ${tint}`,
      `box-shadow: 0 0 12px ${tint}`,
      'pointer-events: none',
      'z-index: 99999',
      'transition: transform 80ms ease-out',
    ].join('; ')
    document.body.appendChild(ghost)

    // Включаем selection mode (highlights eligible frogs).
    setSerumDragActive(true, { element, rarity })
    eventBus.emit('cosmic:select-serum', { element, rarity })
    onClose() // modal закрывается — frogs visible

    const onMove = (ev: PointerEvent) => {
      ghost.style.left = `${ev.clientX - 16}px`
      ghost.style.top = `${ev.clientY - 16}px`
      eventBus.emit('cosmic:serum-pointer-move', {
        x: ev.clientX,
        y: ev.clientY,
      })
    }

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      ghost.remove()
      eventBus.emit('cosmic:serum-pointer-up', {
        x: ev.clientX,
        y: ev.clientY,
      })
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerup', onUp, { passive: true })
  }

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/60">
        <div className="text-4xl">🧪</div>
        <p className="text-sm text-center px-6">
          {t('cosmic_hub.serums_empty')}
        </p>
      </div>
    )
  }

  // Order: legendary → epic → rare → common (best first).
  const orderedRarities: Rarity[] = ['legendary', 'epic', 'rare', 'common']

  return (
    <div className="flex flex-col gap-4 px-3 py-3 overflow-y-auto h-full">
      {orderedRarities.map((rarity) => {
        // Build counts Record<Element, number> для этой rarity.
        const counts = {} as Record<Element, number>
        for (const el of ELEMENTS) counts[el] = serums[el][rarity] ?? 0
        const sectionTotal = ELEMENTS.reduce((s, el) => s + counts[el], 0)
        const discoveredCount = ELEMENTS.filter((el) => counts[el] > 0).length

        return (
          <section key={rarity} className="flex flex-col gap-2">
            <header className="flex items-baseline justify-between">
              <h3 className={`text-sm font-bold ${rarityColorClass(rarity)}`}>
                {t(`cosmic_hub.serums.section_${rarity}`)}
              </h3>
              <span className="text-xs text-white/40">
                {sectionTotal > 0
                  ? t('cosmic_hub.serums.section_count', {
                      count: sectionTotal,
                      kinds: discoveredCount,
                    })
                  : t('cosmic_hub.serums.section_empty')}
              </span>
            </header>
            <ElementGrid
              rarity={rarity}
              counts={counts}
              onSelect={handleSelect}
              onPointerDragStart={handlePointerDragStart}
            />
          </section>
        )
      })}
    </div>
  )
}

function rarityColorClass(r: Rarity): string {
  switch (r) {
    case 'legendary':
      return 'text-yellow-300'
    case 'epic':
      return 'text-purple-300'
    case 'rare':
      return 'text-blue-300'
    case 'common':
      return 'text-white/80'
  }
}
