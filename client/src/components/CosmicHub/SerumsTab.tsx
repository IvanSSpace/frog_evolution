// Phase 22: SerumsTab — единая секция «Серумы» с count per element.
// Rarity sections (common/rare/epic/legendary) удалены.
// Tap-flow: tap cell → setSerumDragActive(true, payload) + emit cosmic:select-serum +
// onClose() (модалка закрывается, юзер видит ферму).
//
// DnD-flow (desktop only via pointerdown с pointerType !== 'touch'):
//   pointerdown → создаёт DOM ghost (32px tinted circle), follows pointer
//   onMove → emit cosmic:serum-pointer-move {x,y}
//   onUp → emit cosmic:serum-pointer-up {x,y}

import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { ELEMENTS, type Element } from '../../store/cosmic/types'
import { ElementGrid, ELEMENT_TINT } from './ElementGrid'

interface Props {
  onClose: () => void // from CosmicHubModal — закрыть на select / drag start
}

export function SerumsTab({ onClose }: Props) {
  const { t } = useTranslation()
  const serums = useGameStore((s) => s.serums)
  const setSerumDragActive = useGameStore((s) => s.setSerumDragActive)

  // Phase 22: flat count per element
  const totalCount = ELEMENTS.reduce((sum, e) => sum + (serums[e] ?? 0), 0)

  const handleSelect = (element: Element) => {
    setSerumDragActive(true, { element })
    eventBus.emit('cosmic:select-serum', { element })
    onClose()
  }

  const handlePointerDragStart = (element: Element, x: number, y: number) => {
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

    setSerumDragActive(true, { element })
    eventBus.emit('cosmic:select-serum', { element })
    onClose()

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

  // Phase 22: flat counts Record<Element, number>
  const counts = {} as Record<Element, number>
  for (const el of ELEMENTS) counts[el] = serums[el] ?? 0

  return (
    <div className="flex flex-col gap-4 px-3 py-3 overflow-y-auto h-full">
      <section className="flex flex-col gap-2">
        <ElementGrid
          counts={counts}
          onSelect={handleSelect}
          onPointerDragStart={handlePointerDragStart}
        />
      </section>
    </div>
  )
}
