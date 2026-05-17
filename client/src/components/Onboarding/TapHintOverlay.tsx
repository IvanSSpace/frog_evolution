// Phase 23 Plan 23-03 — Beat 2 (Tap-hint) DOM label под pulse ring'ом.
//
// Mount-условие (контролируется OnboardingController):
//   welcomeSeen=true && firstBoxTapSeen=false.
//
// Поведение:
//   - Подписывается на 'tutorial:firstBoxSpawned' (BoxController эмитит после
//     landing первого бокса + delay 300ms). Из payload берём game-coords {x,y}
//     и width.
//   - Конвертирует game coords → DOM coords через canvas.getBoundingClientRect()
//     + canvas scaling (Phaser рендерится в физических пикселях, CSS-зум).
//   - Рисует pill «Тапни 👆» под боксом (offset y + width*0.7 + 12px).
//   - Dismiss:
//       (a) eventBus 'tutorial:firstBoxTapped' → fade-out 300ms → unmount.
//       (b) auto-fade через 5с → fade-out 300ms → unmount → markFirstBoxTapSeen
//           (sentinel, иначе при page reload снова появится).
//
// IMPORTANT (memory feedback_clickability):
//   - pointer-events: none — label не блокирует tap по боксу под ним.
//   - z-index: 100 — выше Phaser canvas, ниже системных модалок.
//
// i18n: namespace `onboarding.tapHint.label`. RU/EN/ES уже в i18n/*.json
// (Plan 23-01 положил skeleton, Plan 23-03 переиспользует tapHint ключ).

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

  // Subscribe on eventBus — spawn / tap.
  useEffect(() => {
    const onSpawn = (p: SpawnPayload) => {
      // Re-guard в момент event'а — на случай race между BoxController emit
      // и React store-subscription. Идемпотентно: если уже seen — игнор.
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

  // Auto-fade sentinel — 5с без tap'а → fade + помечаем seen.
  useEffect(() => {
    if (!spawn || exiting) return
    const t1 = window.setTimeout(() => {
      setExiting(true)
      window.setTimeout(() => {
        setSpawn(null)
        // Помечаем seen (auto-dismiss считается завершением Beat 2).
        // Idempotent — store guard'ит повторный set.
        useOnboardingStore.getState().markFirstBoxTapSeen()
      }, FADE_OUT_MS)
    }, AUTO_FADE_MS)
    return () => clearTimeout(t1)
  }, [spawn, exiting])

  if (!spawn) return null

  // Convert game coords → DOM coords.
  // Phaser canvas — единственный <canvas> в документе для этой игры.
  const canvas = document.querySelector('canvas')
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  // Phaser renders в физических pixel'ах (canvas.width = window * DPR),
  // а CSS-rect — в CSS-pixel'ах. scaleX/scaleY переводит game→DOM.
  const scaleX = rect.width / canvas.width
  const scaleY = rect.height / canvas.height
  const rawDomX = rect.left + spawn.x * scaleX
  // Y под боксом: spawn.y + (width * 0.7) даёт центр ring'а внизу + небольшой
  // visual gap 12 CSS px.
  const rawDomY = rect.top + (spawn.y + spawn.width * 0.7) * scaleY + 12

  // Viewport clamp + integer round — иначе pill уезжает за края экрана если
  // бокс падает у края, и subpixel translateX даёт blur.
  // PILL_HALF_W_ESTIMATE — консервативная оценка ширины («Тапни 👆» ≈ 70px).
  const VIEWPORT_PADDING = 12
  const PILL_HALF_W_ESTIMATE = 60
  const minX = PILL_HALF_W_ESTIMATE + VIEWPORT_PADDING
  const maxX = window.innerWidth - PILL_HALF_W_ESTIMATE - VIEWPORT_PADDING
  const domX = Math.round(Math.max(minX, Math.min(maxX, rawDomX)))
  const domY = Math.round(rawDomY)

  return (
    <div
      style={{
        position: 'fixed',
        left: domX,
        top: domY,
        // translate3d вместо translateX → GPU layer + убирает subpixel text blur.
        transform: 'translate3d(-50%, 0, 0)',
        zIndex: 100,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(0,0,0,0.78)',
        color: '#fff',
        fontWeight: 700,
        fontSize: 14,
        lineHeight: 1.2,
        textAlign: 'center',
        // pointer-events: none — label НЕ блокирует tap по боксу под ним
        // (memory: feedback_clickability).
        pointerEvents: 'none',
        opacity: exiting ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        whiteSpace: 'nowrap',
        maxWidth: `calc(100vw - ${VIEWPORT_PADDING * 2}px)`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      }}
    >
      {t('onboarding.tapHint.label')}
    </div>
  )
}
