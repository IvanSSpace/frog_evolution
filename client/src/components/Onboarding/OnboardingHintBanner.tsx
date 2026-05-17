// Phase 23 — Unified onboarding hint banner.
//
// REWRITE 2026-05-18 v5:
//   - Position: bottom center (per user request — moved from top)
//   - Dismiss: 2 taps anywhere on screen (global pointerdown listener)
//   - Также dismiss on real event (firstBoxTapped / firstMerge) если случилось
//   - Fix bug: hint sometimes не исчезал — заменён closure deps на ref-based
//
// Слушает eventBus:
//   - 'tutorial:firstBoxSpawned' → показывает «Тапни 👆»
//   - 'tutorial:firstBoxTapped'  → instant dismiss + markFirstBoxTapSeen
//   - 'tutorial:mergeDemoStart'  → показывает «Перетащи одну на другую»
//   - 'tutorial:firstMerge'      → instant dismiss (mark уже сделан MergeController)
//
// Auto-fade 5s sentinel для tap-hint.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { eventBus } from '../../store/eventBus'
import { useOnboardingStore } from '../../store/onboarding/onboardingSlice'

// 2× быстрее per user request: 300→150, 5000→2500.
const FADE_OUT_MS = 150
const TAP_AUTO_FADE_MS = 2500
// Сколько раз нужно тапнуть в любом месте экрана, чтобы dismiss hint.
const DISMISS_TAP_COUNT = 2

type HintKind = 'tap' | 'merge' | null

export function OnboardingHintBanner() {
  const { t } = useTranslation()
  const [hint, setHint] = useState<HintKind>(null)
  const [exiting, setExiting] = useState(false)

  // Refs — единый источник истины для timers/listeners independent от closure.
  const hintRef = useRef<HintKind>(null)
  const exitingRef = useRef(false)
  const autoFadeRef = useRef<number | null>(null)
  const tapCountRef = useRef(0)
  const fadeOutTimerRef = useRef<number | null>(null)

  // Sync state → ref.
  hintRef.current = hint
  exitingRef.current = exiting

  const clearAutoFade = () => {
    if (autoFadeRef.current !== null) {
      window.clearTimeout(autoFadeRef.current)
      autoFadeRef.current = null
    }
  }

  const clearFadeOutTimer = () => {
    if (fadeOutTimerRef.current !== null) {
      window.clearTimeout(fadeOutTimerRef.current)
      fadeOutTimerRef.current = null
    }
  }

  const finishHide = () => {
    clearAutoFade()
    clearFadeOutTimer()
    tapCountRef.current = 0
    setHint(null)
    setExiting(false)
  }

  const beginExit = (markSeen?: () => void) => {
    if (exitingRef.current) return
    setExiting(true)
    clearFadeOutTimer()
    fadeOutTimerRef.current = window.setTimeout(() => {
      finishHide()
      markSeen?.()
    }, FADE_OUT_MS)
  }

  // Mark-seen helper по типу hint'а.
  const markForHint = (kind: HintKind) => {
    if (kind === 'tap') {
      useOnboardingStore.getState().markFirstBoxTapSeen()
    } else if (kind === 'merge') {
      useOnboardingStore.getState().markFirstMergeSeen()
    }
  }

  // EventBus подписка — один раз на mount.
  useEffect(() => {
    const onBoxSpawn = () => {
      const s = useOnboardingStore.getState()
      if (!s.welcomeSeen || s.firstBoxTapSeen) return
      clearAutoFade()
      tapCountRef.current = 0
      setHint('tap')
      setExiting(false)
      // Sentinel auto-fade 5s.
      autoFadeRef.current = window.setTimeout(() => {
        beginExit(() => markForHint('tap'))
      }, TAP_AUTO_FADE_MS)
    }
    const onBoxTapped = () => {
      if (hintRef.current !== 'tap') return
      beginExit() // mark уже сделан другими listeners
    }
    const onMergeStart = () => {
      clearAutoFade()
      tapCountRef.current = 0
      setHint('merge')
      setExiting(false)
    }
    const onMerge = () => {
      if (hintRef.current !== 'merge') return
      beginExit()
    }
    eventBus.on('tutorial:firstBoxSpawned', onBoxSpawn)
    eventBus.on('tutorial:firstBoxTapped', onBoxTapped)
    eventBus.on('tutorial:mergeDemoStart', onMergeStart)
    eventBus.on('tutorial:firstMerge', onMerge)
    return () => {
      eventBus.off('tutorial:firstBoxSpawned', onBoxSpawn)
      eventBus.off('tutorial:firstBoxTapped', onBoxTapped)
      eventBus.off('tutorial:mergeDemoStart', onMergeStart)
      eventBus.off('tutorial:firstMerge', onMerge)
      clearAutoFade()
      clearFadeOutTimer()
    }
  }, [])

  // 2-tap-anywhere dismiss: global pointerdown counter активный только когда
  // hint visible. Считает любые таппы по window — на N-ный exit + markSeen.
  useEffect(() => {
    if (!hint || exiting) return
    tapCountRef.current = 0
    const onTap = () => {
      tapCountRef.current += 1
      if (tapCountRef.current >= DISMISS_TAP_COUNT) {
        const currentHint = hintRef.current
        beginExit(() => markForHint(currentHint))
      }
    }
    // capture: true — раньше других listeners (мы хотим считать ВСЕ pointer events,
    // даже если их потом stopPropagation'ит UI кнопка).
    window.addEventListener('pointerdown', onTap, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', onTap, { capture: true })
    }
  }, [hint, exiting])

  if (!hint) return null

  const text =
    hint === 'tap'
      ? t('onboarding.tapHint.label')
      : t('onboarding.mergeHint.label')

  // Center horizontally через transform translateX(-50%) — самый надёжный
  // способ центрирования fixed элемента (flex-center иногда не работает с
  // длинным текстом + maxWidth: 100%).
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 100, // над BottomBar ~80px + small gap
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        maxWidth: 'calc(100vw - 32px)',
        padding: '6px 14px',
        color: '#fff',
        fontWeight: 800,
        fontSize: 16,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textAlign: 'center',
        textShadow:
          '0 1px 0 rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.7), 0 0 8px rgba(0,0,0,0.5)',
        opacity: exiting ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    >
      {text}
    </div>
  )
}
