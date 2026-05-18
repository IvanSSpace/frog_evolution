// Phase 27 Plan 27-05: app-level event toast coordinator.
//
// Mounted once в App.tsx (singleton). Subscribes to eventBus 'contacts:event-applied' —
// pushes new EventToast в queue, renders stack top-center via createPortal.
//
// Queue management:
//   - Max visible = MAX_VISIBLE (3). Newer events push out oldest if queue full
//     (oldest position 0 — fades out immediately when 4th arrives).
//   - Each toast self-dismisses after ~3s (EventToast.AUTO_DISMISS_MS).
//
// CSS keyframes mounted once at top of component — slide-in for new + fade-out for dismiss.
// No Lottie.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { eventBus } from '../../store/eventBus'
import { EventToast } from './EventToast'

interface ToastEntry {
  id: string
  raceId: string
  delta: number
  textKey: string
}

const MAX_VISIBLE = 3
let _toastIdCounter = 0

function generateToastId(): string {
  _toastIdCounter = (_toastIdCounter + 1) % 1_000_000
  return `toast-${Date.now().toString(36)}-${_toastIdCounter.toString(36)}`
}

export function EventToastController() {
  const [queue, setQueue] = useState<ToastEntry[]>([])

  useEffect(() => {
    const handler = (payload: {
      raceId: string
      targetRaceId: string
      delta: number
      textKey: string
    }) => {
      setQueue((prev) => {
        const next = [
          ...prev,
          {
            id: generateToastId(),
            raceId: payload.raceId,
            delta: payload.delta,
            textKey: payload.textKey,
          },
        ]
        // Trim to MAX_VISIBLE — oldest entries dropped (their auto-dismiss may still fire,
        // but onDismiss callback finds id missing → no-op).
        if (next.length > MAX_VISIBLE) {
          return next.slice(next.length - MAX_VISIBLE)
        }
        return next
      })
    }
    eventBus.on('contacts:event-applied', handler)
    return () => {
      eventBus.off('contacts:event-applied', handler)
    }
  }, [])

  const dismissToast = (id: string) => {
    setQueue((prev) => prev.filter((t) => t.id !== id))
  }

  if (queue.length === 0) return null

  return createPortal(
    <>
      {/* CSS keyframes mounted once (cheap; safe to re-mount on first render). */}
      <style>{`
        @keyframes contacts-toast-slide {
          0% { transform: translateY(-20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes contacts-toast-fade {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-10px); opacity: 0; }
        }
      `}</style>

      <div
        // Top-center stack.
        style={{
          position: 'fixed',
          top: 16,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          zIndex: 150,
          pointerEvents: 'none',
        }}
      >
        {queue.map((toast) => (
          <EventToast
            key={toast.id}
            id={toast.id}
            raceId={toast.raceId}
            delta={toast.delta}
            textKey={toast.textKey}
            onDismiss={dismissToast}
          />
        ))}
      </div>
    </>,
    document.body,
  )
}
