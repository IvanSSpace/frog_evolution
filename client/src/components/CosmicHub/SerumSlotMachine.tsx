// Phase 15: SerumSlotMachine — drama при открытии бокса.
// Phase 22: rarity removed — fixed duration 2.0–3.0s for all serums.
// Checkpoint flashes на 1.5/3.5/5.5/8s рендерятся при duration > checkpoint.
// Skip MVP: tap-anywhere через parent (skipRequested prop) + visible Skip button с 1s.
// Element fingerprint particle co-старта.
//
// REQ SLOT-01..06, SLOT-08.

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Element } from '../../store/cosmic/types'
import { ELEMENT_TINT } from './ElementGrid'

// Phase 22: fixed duration range (rarity removed).
const DURATION_MIN = 2000
const DURATION_MAX = 3000

// REQ SLOT-02: checkpoint flashes (только те с at < duration).
interface Checkpoint {
  at: number // ms from start
  tint: string // CSS hex
  labelKey: string // i18n key
}
const CHECKPOINTS: Checkpoint[] = [
  { at: 1500, tint: '#94a3b8', labelKey: 'cosmic_hub.slot.checkpoint_common' },
  { at: 3500, tint: '#60a5fa', labelKey: 'cosmic_hub.slot.checkpoint_rare' },
  { at: 5500, tint: '#a78bfa', labelKey: 'cosmic_hub.slot.checkpoint_epic' },
  {
    at: 8000,
    tint: '#fbbf24',
    labelKey: 'cosmic_hub.slot.checkpoint_legendary',
  },
]
const CHECKPOINT_FLASH_MS = 250 // длительность каждого flash

// REQ SLOT-06: skip MVP timing.
const SKIP_BUTTON_VISIBLE_AT_MS = 1000
const SKIP_BUTTON_FADE_IN_MS = 200
// (tap-anywhere protection 0.6s — handled в parent CascadeRevealModal)

const INSTANT_MODE_DURATION_MS = 400 // UX-06

export interface SerumSlotMachineProps {
  element: Element
  onComplete: () => void
  skipRequested: boolean
  instantMode: boolean
}

export default function SerumSlotMachine({
  element,
  onComplete,
  skipRequested,
  instantMode,
}: SerumSlotMachineProps) {
  const { t } = useTranslation()
  const tint = ELEMENT_TINT[element]

  // Compute duration once при mount (не перерасчитывается).
  const duration = useMemo(() => {
    if (instantMode) return INSTANT_MODE_DURATION_MS
    return Math.floor(DURATION_MIN + Math.random() * (DURATION_MAX - DURATION_MIN))
  }, [instantMode])

  // Active checkpoints (только те с at < duration - 200ms safety margin).
  const activeCheckpoints = useMemo(
    () =>
      instantMode ? [] : CHECKPOINTS.filter((cp) => cp.at < duration - 200),
    [duration, instantMode],
  )

  const startTimeRef = useRef<number>(Date.now())
  const completedRef = useRef<boolean>(false)
  const [skipButtonVisible, setSkipButtonVisible] = useState(false)
  const [activeCheckpointIdx, setActiveCheckpointIdx] = useState<number | null>(
    null,
  )
  const [phase, setPhase] = useState<
    'build-up' | 'reveal-drop' | 'reveal-flash'
  >('build-up')
  // Re-render every 100ms во время build-up чтобы elapsedRatio обновлялся плавно.
  const [, setTick] = useState(0)

  // ── Main timer: completion trigger ──
  useEffect(() => {
    const timer = setTimeout(() => {
      if (completedRef.current) return
      completedRef.current = true
      onComplete()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onComplete])

  // ── Skip handler: react to skipRequested prop ──
  useEffect(() => {
    if (!skipRequested) return
    if (completedRef.current) return
    completedRef.current = true
    onComplete()
  }, [skipRequested, onComplete])

  // ── Skip button visibility timer ──
  useEffect(() => {
    if (instantMode) return
    const tm = setTimeout(
      () => setSkipButtonVisible(true),
      SKIP_BUTTON_VISIBLE_AT_MS,
    )
    return () => clearTimeout(tm)
  }, [instantMode])

  // ── Checkpoint flashes — schedule each ──
  useEffect(() => {
    if (instantMode) return
    const timers: ReturnType<typeof setTimeout>[] = []
    activeCheckpoints.forEach((cp, idx) => {
      timers.push(
        setTimeout(() => {
          if (completedRef.current) return
          setActiveCheckpointIdx(idx)
          timers.push(
            setTimeout(() => setActiveCheckpointIdx(null), CHECKPOINT_FLASH_MS),
          )
        }, cp.at),
      )
    })
    return () => {
      for (const tm of timers) clearTimeout(tm)
    }
  }, [activeCheckpoints, instantMode])

  // ── Phase transitions: build-up → reveal-drop → reveal-flash ──
  useEffect(() => {
    if (instantMode) {
      // Instant: skip build-up, go straight через reveal-drop → reveal-flash.
      const t1 = setTimeout(() => setPhase('reveal-drop'), 100)
      const t2 = setTimeout(() => setPhase('reveal-flash'), 250)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    // Normal: build-up до 70% duration, reveal-drop 70-90%, reveal-flash 90-100%.
    const dropAt = Math.floor(duration * 0.7)
    const flashAt = Math.floor(duration * 0.9)
    const t1 = setTimeout(() => setPhase('reveal-drop'), dropAt)
    const t2 = setTimeout(() => setPhase('reveal-flash'), flashAt)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [duration, instantMode])

  // ── build-up smooth scale: re-render every 100ms ──
  useEffect(() => {
    if (instantMode) return
    if (phase !== 'build-up') return
    const interval = setInterval(() => setTick((x) => x + 1), 100)
    return () => clearInterval(interval)
  }, [phase, instantMode])

  // Use checkpoint label (REQ SLOT-03 sound-style label component).
  const checkpointLabel =
    activeCheckpointIdx !== null
      ? t(activeCheckpoints[activeCheckpointIdx].labelKey)
      : null

  // ── Skip button onClick ──
  const handleSkipClick = () => {
    if (completedRef.current) return
    completedRef.current = true
    onComplete()
  }

  const elapsedRatio = Math.min(
    1,
    Math.max(0, (Date.now() - startTimeRef.current) / duration),
  )

  return (
    <div
      data-testid="serum-slot-machine"
      data-element={element}
      data-duration={duration}
      className="relative flex flex-col items-center justify-center gap-4"
      style={{
        width: 'min(80vw, 320px)',
        height: 'min(80vh, 480px)',
        // Element fingerprint co-старта (REQ SLOT-08): фон с element tint
        background: `radial-gradient(ellipse at center, ${tint}15 0%, transparent 70%)`,
        borderRadius: 16,
      }}
    >
      {/* Build-up orb — central pulsing circle, scale 0.8 → 1.2 во время duration */}
      <div
        data-testid="slot-buildup-orb"
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          backgroundColor: tint,
          boxShadow: `0 0 ${phase === 'reveal-flash' ? 128 : 32}px ${tint}`,
          transform:
            phase === 'build-up'
              ? `scale(${0.8 + 0.4 * elapsedRatio})`
              : phase === 'reveal-drop'
                ? 'scale(0.7)'
                : 'scale(1.6)',
          opacity: phase === 'reveal-flash' ? 1 : 0.85,
          transition:
            phase === 'build-up'
              ? 'transform 100ms linear, box-shadow 100ms linear'
              : 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 300ms ease-out',
        }}
      />

      {/* Element fingerprint particles (build-up phase only) */}
      {phase === 'build-up' && !instantMode && (
        <ElementFingerprint tint={tint} />
      )}

      {/* Sound-style label (REQ SLOT-03 placeholder) */}
      {phase === 'build-up' && !instantMode && (
        <div
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          ♪ {checkpointLabel ?? t('cosmic_hub.slot.spinning')}
        </div>
      )}

      {/* Checkpoint flash overlay */}
      {activeCheckpointIdx !== null && (
        <div
          data-testid={`slot-checkpoint-${activeCheckpointIdx}`}
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, ${activeCheckpoints[activeCheckpointIdx].tint}80 0%, transparent 60%)`,
            borderRadius: 16,
            pointerEvents: 'none',
            animation: `slotCheckpointFlash ${CHECKPOINT_FLASH_MS}ms ease-out forwards`,
          }}
        />
      )}

      {/* Reveal flash (last 10% duration) */}
      {phase === 'reveal-flash' && (
        <div
          data-testid="slot-reveal-flash"
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at center, ${tint} 0%, ${tint}aa 30%, transparent 70%)`,
            borderRadius: 16,
            pointerEvents: 'none',
            animation: 'slotRevealFlash 400ms ease-out forwards',
          }}
        />
      )}

      {/* Skip button (REQ SLOT-06) */}
      {skipButtonVisible && phase !== 'reveal-flash' && (
        <button
          data-testid="slot-skip-button"
          onClick={handleSkipClick}
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 6,
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 12,
            opacity: 0,
            animation: `slotSkipFadeIn ${SKIP_BUTTON_FADE_IN_MS}ms ease-out forwards`,
            minWidth: 64,
            minHeight: 32,
            touchAction: 'manipulation',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label={t('cosmic_hub.slot.skip')}
        >
          {t('cosmic_hub.slot.skip')} ›
        </button>
      )}

      <style>{`
        @keyframes slotCheckpointFlash {
          0%   { opacity: 0; }
          50%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes slotRevealFlash {
          0%   { opacity: 0; transform: scale(0.5); }
          40%  { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(2); }
        }
        @keyframes slotSkipFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slotFingerprintFloat {
          0%   { transform: translate(0, 0) scale(0.8); opacity: 0; }
          50%  { opacity: 0.7; }
          100% { transform: translate(var(--tx), var(--ty)) scale(1.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// REQ SLOT-08: element fingerprint particles — CSS-only, 4 dots floating.
function ElementFingerprint({ tint }: { tint: string }) {
  // 4 deterministic offsets relative to center.
  const particles = [
    { tx: '-32px', ty: '-48px', delay: '0ms' },
    { tx: '32px', ty: '-48px', delay: '300ms' },
    { tx: '-48px', ty: '24px', delay: '600ms' },
    { tx: '48px', ty: '24px', delay: '900ms' },
  ]
  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: tint,
            boxShadow: `0 0 8px ${tint}`,
            left: '50%',
            top: '50%',
            ['--tx' as never]: p.tx,
            ['--ty' as never]: p.ty,
            animation: `slotFingerprintFloat 1200ms ease-out infinite ${p.delay}`,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  )
}
