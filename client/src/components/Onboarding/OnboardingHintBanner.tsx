// Phase 23 Plan 23-03/04 — Unified hint banner.
//
// REWRITE 2026-05-18 v4: единый fixed-top banner, без dark backdrop,
// transparent bg + strong text-shadow для readability. User explicit ask:
// «убрать блоки серые которые закрывают обзор, текст поверх интерфейса блоками».
//
// Заменяет отдельные TapHintOverlay + MergeHintOverlay pills.
// Слушает eventBus:
//   - 'tutorial:firstBoxSpawned' → показывает «Тапни 👆»
//   - 'tutorial:firstBoxTapped' → скрывает
//   - 'tutorial:mergeDemoStart' → показывает «Перетащи одну на другую 🐸»
//   - 'tutorial:firstMerge' → скрывает (success toast handled отдельно)
//
// Auto-fade 5s sentinel для tap-hint (если игрок не реагирует).
//
// Style: pill-стрelка в верхнем UI bar'е, без dark bg, transparent.
// Текст белый с heavy text-shadow для контраста на любом фоне.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { eventBus } from '../../store/eventBus'
import { useOnboardingStore } from '../../store/onboarding/onboardingSlice'

const FADE_OUT_MS = 300
const TAP_AUTO_FADE_MS = 5000

type HintKind = 'tap' | 'merge' | null

export function OnboardingHintBanner() {
  const { t } = useTranslation()
  const [hint, setHint] = useState<HintKind>(null)
  const [exiting, setExiting] = useState(false)
  const autoFadeRef = useRef<number | null>(null)

  const clearAutoFade = () => {
    if (autoFadeRef.current !== null) {
      window.clearTimeout(autoFadeRef.current)
      autoFadeRef.current = null
    }
  }

  const beginExit = (markSeen?: () => void) => {
    setExiting(true)
    window.setTimeout(() => {
      setHint(null)
      setExiting(false)
      markSeen?.()
    }, FADE_OUT_MS)
  }

  useEffect(() => {
    const onBoxSpawn = () => {
      const s = useOnboardingStore.getState()
      if (!s.welcomeSeen || s.firstBoxTapSeen) return
      clearAutoFade()
      setHint('tap')
      setExiting(false)
      // Sentinel auto-fade 5s.
      autoFadeRef.current = window.setTimeout(() => {
        beginExit(() => useOnboardingStore.getState().markFirstBoxTapSeen())
      }, TAP_AUTO_FADE_MS)
    }
    const onBoxTapped = () => {
      if (hint !== 'tap') return
      clearAutoFade()
      beginExit()
    }
    const onMergeStart = () => {
      clearAutoFade()
      setHint('merge')
      setExiting(false)
    }
    const onMerge = () => {
      if (hint !== 'merge') return
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
    }
  }, [hint])

  if (!hint) return null

  const text =
    hint === 'tap'
      ? t('onboarding.tapHint.label')
      : t('onboarding.mergeHint.label')

  return (
    <div
      style={{
        position: 'fixed',
        // Под header (~60-72px) — banner всегда сверху UI, не overlap'ит canvas play area.
        top: 'calc(12% + 8px)',
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        padding: '0 16px',
      }}
    >
      <div
        style={{
          // Inline-block pill, derived width from content. Без dark bg.
          display: 'inline-block',
          maxWidth: '100%',
          padding: '6px 14px',
          color: '#fff',
          fontWeight: 800,
          fontSize: 16,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          // Heavy text-shadow для readability на любом фоне без backdrop.
          textShadow:
            '0 1px 0 rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.7), 0 0 8px rgba(0,0,0,0.5)',
          opacity: exiting ? 0 : 1,
          transition: `opacity ${FADE_OUT_MS}ms ease-out`,
          boxSizing: 'border-box',
        }}
      >
        {text}
      </div>
    </div>
  )
}
