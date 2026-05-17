// Phase 23 Plan 23-04 — Beat 3 (Merge demo) DOM pill + success toast.
//
// REWRITE 2026-05-18: minimal, clean, defensive.
// - Pure inline style без box-shadow / backdrop-filter / blend modes
// - Solid bg rgba(0,0,0,0.65) — единый source dark
// - Жёсткий cap на ширину
// - position via integer pixels (no subpixel blur)

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { eventBus } from '../../store/eventBus'

const FADE_OUT_MS = 300

interface AnchorPayload {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}

export function MergeHintOverlay() {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<AnchorPayload | null>(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const onStart = (p: AnchorPayload) => {
      setAnchor(p)
      setExiting(false)
    }
    const onMerge = () => {
      setExiting(true)
      window.setTimeout(() => setAnchor(null), FADE_OUT_MS)
    }
    eventBus.on('tutorial:mergeDemoStart', onStart)
    eventBus.on('tutorial:firstMerge', onMerge)
    return () => {
      eventBus.off('tutorial:mergeDemoStart', onStart)
      eventBus.off('tutorial:firstMerge', onMerge)
    }
  }, [])

  if (!anchor) return null

  const canvas = document.querySelector('canvas')
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const scaleX = rect.width / canvas.width
  const scaleY = rect.height / canvas.height

  const midGameX = (anchor.sourceX + anchor.targetX) / 2
  const lowerGameY = Math.max(anchor.sourceY, anchor.targetY)
  const rawDomX = rect.left + midGameX * scaleX
  const rawDomY = rect.top + lowerGameY * scaleY + 40

  const VIEWPORT_PADDING = 16
  const PILL_HALF_W = 110
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
        padding: '6px 14px',
        background: 'rgba(0, 0, 0, 0.65)',
        color: '#fff',
        fontWeight: 600,
        fontSize: 13,
        lineHeight: 1.2,
        borderRadius: 12,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        opacity: exiting ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}
    >
      {t('onboarding.mergeHint.label')}
    </div>
  )
}

const TOAST_SHOW_MS = 3000
const TOAST_FADE_MS = 300

export function MergeSuccessToast() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const onMerge = () => {
      setVisible(true)
      setExiting(false)
      const hideAt = window.setTimeout(() => {
        setExiting(true)
        window.setTimeout(() => {
          setVisible(false)
          setExiting(false)
        }, TOAST_FADE_MS)
      }, TOAST_SHOW_MS)
      return () => clearTimeout(hideAt)
    }
    eventBus.on('tutorial:firstMerge', onMerge)
    return () => {
      eventBus.off('tutorial:firstMerge', onMerge)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 120,
        left: '50%',
        transform: 'translate3d(-50%, 0, 0)',
        zIndex: 101,
        padding: '8px 18px',
        borderRadius: 14,
        background: 'rgba(236, 72, 153, 0.92)',
        color: '#fff',
        fontWeight: 700,
        fontSize: 13,
        pointerEvents: 'none',
        opacity: exiting ? 0 : 1,
        transition: `opacity ${TOAST_FADE_MS}ms ease-out`,
        whiteSpace: 'nowrap',
        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
      }}
    >
      {t('onboarding.mergeHint.success')}
    </div>
  )
}
