// Phase 17 (CARRIER-08): mini slot-machine модалка 3-4 сек когда carrier
// стабилизируется. Слушает `cosmic:carrier-stabilized` eventBus event;
// внутри renders revealing slot-machine + tier-specific копирайт.
//
// Lifecycle:
//   - Always mounted в App.tsx; internally returns null когда state.payload === null.
//   - На event → state.payload set → анимация (1.8s slot scroll, 2.2s reveal hold).
//   - Auto-close через 4с total OR tap на overlay.
//   - Reduced-effects flag (localStorage) → skip slot anim, mostra final immediately.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { eventBus } from '../../store/eventBus'
import { TIER_RANGES, type Bucket } from '../../utils/carrierEvolution'
import { ELEMENT_TINTS } from '../../game/effects/elements/elementTints'
import { getReducedEffects } from '../../utils/cosmicSettings'
import type { Element, Rarity } from '../../store/cosmic/types'

interface StabilizationPayload {
  frogId: string
  element: Element
  rarity: Rarity
  ceiling: number
  bucket: Bucket
}

const SLOT_DURATION_MS = 1800 // фаза 1: rotating numbers
const REVEAL_HOLD_MS = 2200 // фаза 2: финальное число + копирайт (total 4s)
const TOTAL_DURATION_MS = SLOT_DURATION_MS + REVEAL_HOLD_MS // 4000ms

const BUCKET_TO_KEY: Record<Bucket, string> = {
  S: 'cosmic_hub.carrier.stabilize.s_top',
  A: 'cosmic_hub.carrier.stabilize.a_high',
  B: 'cosmic_hub.carrier.stabilize.b_mid',
  C: 'cosmic_hub.carrier.stabilize.c_low',
}

const BUCKET_TO_COLOR: Record<Bucket, string> = {
  S: 'text-yellow-300',
  A: 'text-emerald-400',
  B: 'text-amber-400',
  C: 'text-white/70',
}

// Phase 19-04 (UX-05): use centralized getReducedEffects() from cosmicSettings.
// Legacy local helper removed — single localStorage key now.
const reducedEffectsEnabled = getReducedEffects

export function StabilizationModal() {
  const { t } = useTranslation()
  const [payload, setPayload] = useState<StabilizationPayload | null>(null)
  const [phase, setPhase] = useState<'slot' | 'reveal'>('slot')
  const [slotDisplay, setSlotDisplay] = useState<number>(1)
  const slotTimerRef = useRef<number | null>(null)
  const revealTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  // Subscribe to event.
  useEffect(() => {
    const handler = (data: StabilizationPayload) => {
      // Если уже открыт — показываем последний (overwrite). Очищаем timers.
      if (slotTimerRef.current !== null) {
        clearInterval(slotTimerRef.current)
        slotTimerRef.current = null
      }
      if (revealTimerRef.current !== null) {
        clearTimeout(revealTimerRef.current)
        revealTimerRef.current = null
      }
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }

      setPayload(data)
      const reduced = reducedEffectsEnabled()
      setPhase(reduced ? 'reveal' : 'slot')
      setSlotDisplay(reduced ? data.ceiling : TIER_RANGES[data.rarity].min)

      if (!reduced) {
        // Phase 1: slot animation — rotating через levels в TIER_RANGES.
        const range = TIER_RANGES[data.rarity]
        const total = range.max - range.min + 1
        let i = 0
        slotTimerRef.current = window.setInterval(() => {
          i++
          setSlotDisplay(range.min + (i % total))
        }, 80)

        revealTimerRef.current = window.setTimeout(() => {
          if (slotTimerRef.current !== null) {
            clearInterval(slotTimerRef.current)
            slotTimerRef.current = null
          }
          setSlotDisplay(data.ceiling)
          setPhase('reveal')
          revealTimerRef.current = null
        }, SLOT_DURATION_MS)
      }

      closeTimerRef.current = window.setTimeout(() => {
        setPayload(null)
        closeTimerRef.current = null
      }, TOTAL_DURATION_MS)
    }

    eventBus.on('cosmic:carrier-stabilized', handler)
    return () => {
      eventBus.off('cosmic:carrier-stabilized', handler)
      if (slotTimerRef.current !== null) clearInterval(slotTimerRef.current)
      if (revealTimerRef.current !== null) clearTimeout(revealTimerRef.current)
      if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current)
    }
  }, [])

  if (!payload) return null

  const tintHex = ELEMENT_TINTS[payload.element]
  const tintCss = `#${tintHex.toString(16).padStart(6, '0')}`
  const elementName = t(`cosmic_hub.elements.${payload.element}`)

  const handleDismiss = () => {
    if (slotTimerRef.current !== null) {
      clearInterval(slotTimerRef.current)
      slotTimerRef.current = null
    }
    if (revealTimerRef.current !== null) {
      clearTimeout(revealTimerRef.current)
      revealTimerRef.current = null
    }
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setPayload(null)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleDismiss}
      role="dialog"
      aria-label={t('cosmic_hub.carrier.stabilize.modal_label')}
    >
      <div
        className="rounded-xl border-2 px-8 py-6 flex flex-col items-center gap-3 bg-gray-900/90 max-w-xs"
        style={{ borderColor: tintCss }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="text-white/60 text-xs uppercase tracking-wider">
          {t('cosmic_hub.carrier.stabilize.title')}
        </div>

        {/* Element */}
        <div className="text-lg font-bold" style={{ color: tintCss }}>
          {elementName}
        </div>

        {/* Slot reveal */}
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-sm">L</span>
          <span
            className={[
              'text-5xl font-bold tabular-nums transition-transform',
              phase === 'reveal' ? 'scale-110' : 'scale-100',
            ].join(' ')}
            style={
              phase === 'reveal' ? { color: tintCss } : { color: '#ffffff' }
            }
          >
            {slotDisplay}
          </span>
        </div>

        {/* Bucket label (visible only after reveal) */}
        {phase === 'reveal' ? (
          <div
            className={[
              'text-base font-semibold',
              BUCKET_TO_COLOR[payload.bucket],
            ].join(' ')}
          >
            {t(BUCKET_TO_KEY[payload.bucket])}
          </div>
        ) : (
          <div className="text-base text-white/30 italic">
            {t('cosmic_hub.carrier.stabilize.rolling')}
          </div>
        )}

        {/* Tap to dismiss hint */}
        <div className="text-white/40 text-xs mt-2">
          {t('cosmic_hub.carrier.stabilize.tap_to_dismiss')}
        </div>
      </div>
    </div>
  )
}
