// Phase 15: CascadeRevealModal — обёртка драмы при открытии бокса.
// Phase 22: rarity removed. Box reveals element + serum (no tier).
// State machine: opening-flash → coins-reveal → resources-reveal → pause → slot-spinning → slot-reveal → closing.
// Lazy-loads SerumSlotMachine (отдельный chunk PERF-08).

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import type { BoxData, Element } from '../../store/cosmic/types'
import { useGameStore } from '../../store/gameStore'
import { ELEMENT_TINT } from './ElementGrid'
import { getInstantBoxes } from '../../utils/cosmicSettings'
import { sfx } from '../../audio/sfx'

// Lazy chunk — SerumSlotMachine (Plan 15-04). Отдельный файл в bundle.
const SerumSlotMachine = lazy(() => import('./SerumSlotMachine'))

// REQ BOX-05: cascade timing.
const T_OPENING_FLASH = 200 // ms
const T_COINS_REVEAL = 200 // ms
const T_RESOURCES_REVEAL = 200 // ms
const T_PAUSE = 400 // ms

type Phase =
  | 'opening-flash'
  | 'coins-reveal'
  | 'resources-reveal'
  | 'pause'
  | 'slot-spinning'
  | 'slot-reveal'
  | 'closing'

export interface CascadeRevealModalProps {
  box: BoxData
  onComplete: () => void
}

export default function CascadeRevealModal({
  box,
  onComplete,
}: CascadeRevealModalProps) {
  const { t } = useTranslation()

  // Phase 22: rollBoxRarity returns { element } only (no rarity)
  const rollBoxRarity = useGameStore((s) => s.rollBoxRarity)
  const commitOpenedBox = useGameStore((s) => s.commitOpenedBox)
  const rolledRef = useRef<{ element: Element } | null>(null)

  if (rolledRef.current === null) {
    rolledRef.current = rollBoxRarity(box.id)
  }

  const [instantMode] = useState(() => getInstantBoxes())
  const initialPhase: Phase = instantMode ? 'slot-spinning' : 'opening-flash'
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [skipRequested, setSkipRequested] = useState(false)
  const tapStartTime = useRef<number>(Date.now())

  // Если rollBoxRarity вернул null (box not found / opened) → close.
  useEffect(() => {
    if (rolledRef.current === null) {
      onComplete()
    }
  }, [onComplete])

  // Звук открытия бокса при маунте (ref-guard против StrictMode double-invoke).
  const boxSoundFiredRef = useRef(false)
  useEffect(() => {
    if (boxSoundFiredRef.current) return
    boxSoundFiredRef.current = true
    void sfx.ensureReady()
    sfx.play('boxOpen')
  }, [])

  // Cascade timeline (skip if instantMode).
  useEffect(() => {
    if (instantMode || rolledRef.current === null) return
    const timeouts: ReturnType<typeof setTimeout>[] = []

    timeouts.push(setTimeout(() => setPhase('coins-reveal'), T_OPENING_FLASH))
    timeouts.push(
      setTimeout(
        () => setPhase('resources-reveal'),
        T_OPENING_FLASH + T_COINS_REVEAL,
      ),
    )
    timeouts.push(
      setTimeout(
        () => setPhase('pause'),
        T_OPENING_FLASH + T_COINS_REVEAL + T_RESOURCES_REVEAL,
      ),
    )
    timeouts.push(
      setTimeout(
        () => setPhase('slot-spinning'),
        T_OPENING_FLASH + T_COINS_REVEAL + T_RESOURCES_REVEAL + T_PAUSE,
      ),
    )

    return () => {
      for (const t of timeouts) clearTimeout(t)
    }
  }, [instantMode])

  // SerumSlotMachine onComplete handler — переходим к reveal phase + commit.
  const handleSlotComplete = useCallback(() => {
    if (rolledRef.current === null) return
    // Phase 22: commitOpenedBox no longer needs rarity arg
    commitOpenedBox(box.id)
    setPhase('slot-reveal')
  }, [box.id, commitOpenedBox])

  // Tap-anywhere skip (REQ SLOT-06): после первой 0.6с от mount.
  const handleTapAnywhere = useCallback(() => {
    if (phase !== 'slot-spinning') return
    if (Date.now() - tapStartTime.current < 600) return
    setSkipRequested(true)
  }, [phase])

  const handleClaim = useCallback(() => {
    setPhase('closing')
    onComplete()
  }, [onComplete])

  if (rolledRef.current === null) return null
  const rolled = rolledRef.current

  return (
    <div
      data-testid="cascade-reveal-modal"
      data-phase={phase}
      onPointerDown={handleTapAnywhere}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.95) 70%)',
        cursor: phase === 'slot-spinning' ? 'pointer' : 'default',
      }}
    >
      {phase === 'opening-flash' && (
        <div
          data-testid="cascade-opening"
          style={{
            opacity: 1,
            animation: 'cascadeZoomIn 200ms ease-out forwards',
          }}
        >
          <div style={{ fontSize: 64 }}>🎁</div>
        </div>
      )}

      {phase === 'coins-reveal' && (
        <div
          data-testid="cascade-coins"
          className="flex items-center gap-2"
          style={{ animation: 'cascadeSlideUp 200ms ease-out forwards' }}
        >
          <span style={{ fontSize: 30 }}>🪙</span>
          <span
            className="ff-display"
            style={{ fontSize: 24, color: '#fde047' }}
          >
            {t('cosmic_hub.cascade.coins', { count: 100 })}
          </span>
        </div>
      )}

      {phase === 'resources-reveal' && (
        <div
          data-testid="cascade-resources"
          className="flex items-center gap-2"
          style={{ animation: 'cascadeSlideUp 200ms ease-out forwards' }}
        >
          <span style={{ fontSize: 30 }}>⚙️</span>
          <span
            className="ff-display"
            style={{ fontSize: 24, color: '#67e8f9' }}
          >
            {t('cosmic_hub.cascade.resources', { count: 25 })}
          </span>
        </div>
      )}

      {phase === 'pause' && (
        <div
          data-testid="cascade-pause"
          style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}
        >
          {t('cosmic_hub.cascade.serum_incoming')}
        </div>
      )}

      {phase === 'slot-spinning' && (
        <Suspense
          fallback={<div style={{ color: 'rgba(255,255,255,0.4)' }}>…</div>}
        >
          <SerumSlotMachine
            element={rolled.element}
            onComplete={handleSlotComplete}
            skipRequested={skipRequested}
            instantMode={instantMode}
          />
        </Suspense>
      )}

      {phase === 'slot-reveal' && (
        <RevealResult
          element={rolled.element}
          onClaim={handleClaim}
        />
      )}

      {phase === 'closing' && null}

      <style>{`
        @keyframes cascadeZoomIn {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes cascadeSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

interface RevealResultProps {
  element: Element
  onClaim: () => void
}

function RevealResult({ element, onClaim }: RevealResultProps) {
  const { t } = useTranslation()
  const tint = ELEMENT_TINT[element]
  return (
    <div
      data-testid="cascade-reveal-result"
      className="flex flex-col items-center gap-4 px-6"
      style={{ animation: 'cascadeSlideUp 300ms ease-out forwards' }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 128,
          height: 128,
          borderRadius: '50%',
          backgroundColor: tint,
          boxShadow: `0 0 64px ${tint}, 0 0 128px ${tint}aa`,
        }}
      >
        <span style={{ fontSize: 56 }}>🧪</span>
      </div>

      {/* Element name */}
      <div
        className="ff-display text-center px-5 py-2"
        style={{
          fontSize: 'clamp(20px, 6vw, 28px)',
          color: '#fff',
          background: 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
          border: '3px solid #92400e',
          borderBottomWidth: 5,
          borderRadius: 14,
          textShadow: '0 2px 0 rgba(0,0,0,0.3)',
        }}
      >
        {t('cosmic_hub.slot.reveal_serum', {
          element: t(`cosmic_hub.elements.${element}`),
        })}
      </div>

      <button
        type="button"
        onClick={onClaim}
        className="ff-btn ff-btn-green text-lg"
        style={{
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        {t('cosmic_hub.slot.claim')}
      </button>
    </div>
  )
}
