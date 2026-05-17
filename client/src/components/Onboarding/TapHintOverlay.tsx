// Phase 23 Plan 23-03 — Beat 2 (Tap-hint) DOM label.
//
// REWRITE 2026-05-18 v3: viewport-center positioning. Pill всегда по центру
// viewport — canvas-anchored coords съезжали. Y зафиксирована в нижней части
// над BottomBar (bottom: 25%).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { eventBus } from '../../store/eventBus'
import { useOnboardingStore } from '../../store/onboarding/onboardingSlice'

interface SpawnPayload {
  x: number
  y: number
  boxId: string
  width: number
}

const AUTO_FADE_MS = 5000
const FADE_OUT_MS = 300

export function TapHintOverlay() {
  const { t } = useTranslation()
  const [active, setActive] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const onSpawn = (_p: SpawnPayload) => {
      const s = useOnboardingStore.getState()
      if (!s.welcomeSeen || s.firstBoxTapSeen) return
      setActive(true)
      setExiting(false)
    }
    const onTapped = () => {
      setExiting(true)
      window.setTimeout(() => setActive(false), FADE_OUT_MS)
    }
    eventBus.on('tutorial:firstBoxSpawned', onSpawn)
    eventBus.on('tutorial:firstBoxTapped', onTapped)
    return () => {
      eventBus.off('tutorial:firstBoxSpawned', onSpawn)
      eventBus.off('tutorial:firstBoxTapped', onTapped)
    }
  }, [])

  useEffect(() => {
    if (!active || exiting) return
    const t1 = window.setTimeout(() => {
      setExiting(true)
      window.setTimeout(() => {
        setActive(false)
        useOnboardingStore.getState().markFirstBoxTapSeen()
      }, FADE_OUT_MS)
    }, AUTO_FADE_MS)
    return () => clearTimeout(t1)
  }, [active, exiting])

  if (!active) return null

  // Viewport-center positioning. Над BottomBar (~80px).
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        padding: '10px 18px',
        background: 'rgba(0, 0, 0, 0.72)',
        color: '#fff',
        fontWeight: 600,
        fontSize: 15,
        lineHeight: 1.2,
        borderRadius: 14,
        whiteSpace: 'nowrap',
        maxWidth: 'calc(100vw - 32px)',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        opacity: exiting ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
      }}
    >
      {t('onboarding.tapHint.label')}
    </div>
  )
}
