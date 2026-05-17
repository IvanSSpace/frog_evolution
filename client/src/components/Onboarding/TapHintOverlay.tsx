// Phase 23 Plan 23-03 — Beat 2 (Tap-hint) DOM label под pulse ring'ом.
//
// REWRITE 2026-05-18: minimal clean pill. Solid bg, no shadow, integer pixels.

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
  const [spawn, setSpawn] = useState<SpawnPayload | null>(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const onSpawn = (p: SpawnPayload) => {
      const s = useOnboardingStore.getState()
      if (!s.welcomeSeen || s.firstBoxTapSeen) return
      setSpawn(p)
      setExiting(false)
    }
    const onTapped = () => {
      setExiting(true)
      window.setTimeout(() => setSpawn(null), FADE_OUT_MS)
    }
    eventBus.on('tutorial:firstBoxSpawned', onSpawn)
    eventBus.on('tutorial:firstBoxTapped', onTapped)
    return () => {
      eventBus.off('tutorial:firstBoxSpawned', onSpawn)
      eventBus.off('tutorial:firstBoxTapped', onTapped)
    }
  }, [])

  useEffect(() => {
    if (!spawn || exiting) return
    const t1 = window.setTimeout(() => {
      setExiting(true)
      window.setTimeout(() => {
        setSpawn(null)
        useOnboardingStore.getState().markFirstBoxTapSeen()
      }, FADE_OUT_MS)
    }, AUTO_FADE_MS)
    return () => clearTimeout(t1)
  }, [spawn, exiting])

  if (!spawn) return null

  const canvas = document.querySelector('canvas')
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const scaleX = rect.width / canvas.width
  const scaleY = rect.height / canvas.height
  const rawDomX = rect.left + spawn.x * scaleX
  const rawDomY = rect.top + (spawn.y + spawn.width * 0.7) * scaleY + 12

  const VIEWPORT_PADDING = 16
  const PILL_HALF_W = 60
  const domX = Math.round(
    Math.max(
      PILL_HALF_W + VIEWPORT_PADDING,
      Math.min(window.innerWidth - PILL_HALF_W - VIEWPORT_PADDING, rawDomX),
    ),
  )
  const domY = Math.round(rawDomY)

  return (
    <div
      style={{
        position: 'fixed',
        left: domX,
        top: domY,
        transform: 'translate3d(-50%, 0, 0)',
        zIndex: 100,
        padding: '8px 14px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: '#fff',
        fontWeight: 600,
        fontSize: 15,
        lineHeight: 1.2,
        borderRadius: 14,
        whiteSpace: 'nowrap',
        maxWidth: 'calc(100vw - 32px)',
        pointerEvents: 'none',
        opacity: exiting ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}
    >
      {t('onboarding.tapHint.label')}
    </div>
  )
}
