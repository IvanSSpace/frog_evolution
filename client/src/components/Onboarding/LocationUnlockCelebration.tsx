// Phase 23 Plan 23-05 (Beat 4): DOM toast banner для location unlock.
//
// Slide-up from bottom (350ms ease-out) → visible до 7s → fade-out (300ms)
// OR tap-dismiss. Один instance at a time — мы НЕ ставим в очередь несколько
// unlock'ов, так как в нормальном gameplay два разных threshold'а не сработают
// в одном кадре.
//
// Координация через eventBus:
//   'onboarding:locationCelebrationStart' { locationId } — show toast
//   'onboarding:locationCelebrationDismiss' { locationId } — hide immediately
//     (приходит от LocationStack когда игрок тапнул pulsing button)
//
// IMPORTANT (memory feedback_clickability):
//   - корневой элемент onClick — это div role=status (нерактивный tap-zone),
//     но НЕ требует type="button" так как не нативная button;
//   - z-index 101 (выше LocationStack=50, рядом с modal layer);
//   - position fixed, pointer-events на элементе — он сам tap-target.
//
// IMPORTANT (memory feedback_animations): pure CSS keyframes
// (см. locationCelebration.css), НЕ Lottie.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { eventBus } from '../../store/eventBus'
import './locationCelebration.css'

/** Mapping locationId → emoji + i18n nameKey.
 * Только три location'а получают Beat 4 celebration (2/3/6).
 * Если придёт «чужой» locationId — игнорируем (no-op).
 * nameKey соответствует существующим ключам в i18n locales (locations.<id>).
 */
const LOC_INFO: Record<number, { emoji: string; nameKey: string }> = {
  2: { emoji: '🌿', nameKey: 'locations.2' }, // Болото
  3: { emoji: '🌲', nameKey: 'locations.3' }, // Лес
  6: { emoji: '✨', nameKey: 'locations.6' }, // Star Map (cosmos)
}

/** Time toast остаётся visible до auto-fade. */
const TOAST_VISIBLE_MS = 7000
/** Длительность exit fade (matches CSS .is-exiting). */
const TOAST_EXIT_MS = 300

export function LocationUnlockCelebration() {
  const { t } = useTranslation()
  const [active, setActive] = useState<number | null>(null)
  const [exiting, setExiting] = useState(false)
  // Ref'ы для cleanup timer'ов в эффектах — иначе можем dismiss'нуть toast
  // который игрок уже закрыл вручную и получить flicker.
  const exitTimerRef = useRef<number | null>(null)
  const fadeStartTimerRef = useRef<number | null>(null)

  // Helper: запустить exit-анимацию + unmount после CSS-длительности.
  // Используется для tap-dismiss и для 7s auto-fade.
  const beginExit = () => {
    setExiting(true)
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
    }
    exitTimerRef.current = window.setTimeout(() => {
      setActive(null)
      setExiting(false)
      exitTimerRef.current = null
    }, TOAST_EXIT_MS)
  }

  // Subscribe на celebration events ровно один раз.
  useEffect(() => {
    const onStart = ({ locationId }: { locationId: number }) => {
      if (!LOC_INFO[locationId]) return // unknown — skip
      // Если уже что-то показывается — гасим pending exit timer и заменяем.
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      setExiting(false)
      setActive(locationId)
    }
    const onDismiss = () => {
      // Игнорируем dismiss если ничего не показывается — иначе re-entry mess.
      // (LocationStack может emit на любой tap pulsing button.)
      // Проверяем через state-getter через ref'у — но проще через закрытие:
      // beginExit no-op safe, и setActive(null) idempotent.
      beginExit()
    }
    eventBus.on('onboarding:locationCelebrationStart', onStart)
    eventBus.on('onboarding:locationCelebrationDismiss', onDismiss)
    return () => {
      eventBus.off('onboarding:locationCelebrationStart', onStart)
      eventBus.off('onboarding:locationCelebrationDismiss', onDismiss)
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      if (fadeStartTimerRef.current !== null) {
        window.clearTimeout(fadeStartTimerRef.current)
        fadeStartTimerRef.current = null
      }
    }
  }, [])

  // Auto-fade 7s timer — стартует когда active появляется и не exiting.
  // НЕ emit'ит 'Dismiss' event — это локальное закрытие toast'а;
  // LocationStack pulse продолжается до tap'а (per CONTEXT.md design).
  useEffect(() => {
    if (active === null || exiting) return
    if (fadeStartTimerRef.current !== null) {
      window.clearTimeout(fadeStartTimerRef.current)
    }
    fadeStartTimerRef.current = window.setTimeout(() => {
      beginExit()
      fadeStartTimerRef.current = null
    }, TOAST_VISIBLE_MS)
    return () => {
      if (fadeStartTimerRef.current !== null) {
        window.clearTimeout(fadeStartTimerRef.current)
        fadeStartTimerRef.current = null
      }
    }
  }, [active, exiting])

  if (active === null) return null
  const info = LOC_INFO[active]
  if (!info) return null

  const name = t(info.nameKey)
  // Render тоста: pill banner у нижнего края экрана,
  // НЕ закрывает gameplay (bottom: 120 чтобы стоять над BottomBar ~64px).
  return (
    <div
      className={`onb-loc-toast${exiting ? ' is-exiting' : ''}`}
      role="status"
      aria-live="polite"
      onClick={beginExit}
      style={{
        // Text-only banner, viewport-center via translateX.
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
        cursor: 'pointer',
        touchAction: 'manipulation',
        textShadow:
          '0 1px 0 rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.7), 0 0 8px rgba(0,0,0,0.5)',
        boxSizing: 'border-box',
      }}
    >
      {t('onboarding.location.unlocked', { name: `${info.emoji} ${name}` })}
    </div>
  )
}
