// Phase 23 Plan 23-04 — Beat 3 (Merge demo) DOM pill + success toast.
//
// REWRITE 2026-05-18 v3: viewport-center positioning. Pills всегда по центру
// viewport — никаких canvas-anchored coords (они съезжали с центра когда frogs
// не у viewport center). Y anchored к лягушкам через bottom offset.

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
  const [active, setActive] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const onStart = (_p: AnchorPayload) => {
      setActive(true)
      setExiting(false)
    }
    const onMerge = () => {
      setExiting(true)
      window.setTimeout(() => setActive(false), FADE_OUT_MS)
    }
    eventBus.on('tutorial:mergeDemoStart', onStart)
    eventBus.on('tutorial:firstMerge', onMerge)
    return () => {
      eventBus.off('tutorial:mergeDemoStart', onStart)
      eventBus.off('tutorial:firstMerge', onMerge)
    }
  }, [])

  if (!active) return null

  // Viewport-center positioning: всегда по центру viewport, Y зафиксирована
  // в верхней половине экрана где обычно находятся frogs (top: 30%).
  return (
    <div
      style={{
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
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
      {t('onboarding.mergeHint.label')}
    </div>
  )
}

// 2× быстрее per user request.
const TOAST_SHOW_MS = 1500
const TOAST_FADE_MS = 150

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
        bottom: 100,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 101,
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
        transition: `opacity ${TOAST_FADE_MS}ms ease-out`,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    >
      {t('onboarding.mergeHint.success')}
    </div>
  )
}
