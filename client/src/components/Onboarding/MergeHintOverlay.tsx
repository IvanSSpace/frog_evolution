// Phase 23 Plan 23-04 — Beat 3 (Merge demo) DOM overlay.
//
// Mount-условие (контролируется OnboardingController):
//   welcomeSeen && firstBoxTapSeen && !firstMergeSeen.
//
// Поведение:
//   1. Подписка на 'tutorial:mergeDemoStart' — получаем game-coords source/target frogs
//      → конвертим в DOM-coords (mid-point под frogs) → рисуем pill «Перетащи одну
//      на другую» (i18n: onboarding.mergeHint.label).
//   2. Подписка на 'tutorial:firstMerge' — fade-out label + показываем one-time
//      success-toast «Готово! Дальше мерджи всё подряд» (i18n: onboarding.mergeHint.success)
//      на 3с с slide-up animation.
//
// Координация с OnboardingController:
//   - Auto-fade label (8с) НЕ делаем здесь — controller owner'ит сам и сам зовёт
//     markFirstMergeSeen. Overlay просто реагирует на mount/unmount от controller.
//   - При unmount (controller убрал нас потому что firstMergeSeen=true) toast
//     может остаться видимым если firstMerge только что emit'нулся — поэтому
//     mount остаётся через success-window. Реализуем так: controller держит
//     overlay mount'нутым пока firstMergeSeen=false; toast живёт самостоятельно
//     через своё state — если firstMerge приходит ДО unmount'а, toast стартует
//     и сохранится в local state даже после controller unmount'а?
//     НЕТ — unmount = state lost. Решение: controller delay'ит unmount на 3с
//     ПОСЛЕ markFirstMergeSeen чтобы toast успел отыграть.
//     ПРОЩЕ: toast рендерим внутри overlay и controller unmount'ит overlay
//     только после firstMergeSeen — НО overlay живёт пока firstMergeSeen=false.
//     После mark он unmount'ится. Решение: показываем toast прямо в overlay
//     ДО mark'а — controller mark'ает только после auto-fade или OnControllerOwn.
//     Проще: MergeController emit'ит 'tutorial:firstMerge' СНАЧАЛА, затем
//     markFirstMergeSeen — между ними overlay подхватывает event, поднимает
//     toast state, и в этот же тик firstMergeSeen=true делает unmount.
//     React batched updates: при unmount setTimeout продолжает работать но
//     setState на unmounted component — warning + no-op.
//
//   ФИНАЛЬНОЕ решение: вешаем toast на ОТДЕЛЬНЫЙ всегда-mounted listener
//   через portal-like подход — раз overlay живёт только до firstMerge mark,
//   и toast должен пережить unmount, выносим toast в SEPARATE component
//   `MergeSuccessToast` всегда-mounted в OnboardingController.
//
// MergeHintOverlay = только pill-label.
// MergeSuccessToast = только toast (отдельный always-mounted listener).
//
// IMPORTANT (memory feedback_clickability):
//   - pointer-events: none на label/toast — не блокируем drag/tap по frogs.
//   - z-index: 100/101 — выше Phaser canvas, ниже системных модалок.

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

/**
 * Pill «Перетащи одну на другую» между двумя frogs.
 * Mount/unmount controlled by OnboardingController (firstMergeSeen guard).
 */
export function MergeHintOverlay() {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<AnchorPayload | null>(null)
  const [exiting, setExiting] = useState(false)

  // Subscribe — demo start + merge end.
  useEffect(() => {
    const onStart = (p: AnchorPayload) => {
      setAnchor(p)
      setExiting(false)
    }
    const onMerge = () => {
      // Fade-out начинаем СРАЗУ; controller'у нужен момент чтобы unmount.
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

  // Convert game coords → DOM coords (same pattern как TapHintOverlay).
  const canvas = document.querySelector('canvas')
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const scaleX = rect.width / canvas.width
  const scaleY = rect.height / canvas.height

  // Anchor: mid-point по X, под нижней из двух frogs (Math.max — Y растёт вниз)
  // плюс отступ 50px CSS чтобы pill не накладывался на frog body.
  const midGameX = (anchor.sourceX + anchor.targetX) / 2
  const lowerGameY = Math.max(anchor.sourceY, anchor.targetY)
  const domX = rect.left + midGameX * scaleX
  const domY = rect.top + lowerGameY * scaleY + 50

  return (
    <div
      style={{
        position: 'fixed',
        left: domX,
        top: domY,
        transform: 'translateX(-50%)',
        zIndex: 100,
        padding: '6px 14px',
        borderRadius: 999,
        background: 'rgba(0,0,0,0.78)',
        color: '#fff',
        fontWeight: 700,
        fontSize: 14,
        lineHeight: 1.2,
        // pointer-events: none — pill не блокирует drag по frog'ам под ним.
        pointerEvents: 'none',
        opacity: exiting ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      }}
    >
      {t('onboarding.mergeHint.label')}
    </div>
  )
}

const TOAST_SHOW_MS = 3000
const TOAST_FADE_MS = 300

/**
 * One-shot success toast — always-mounted listener.
 * Слушает 'tutorial:firstMerge' независимо от MergeHintOverlay mount-состояния
 * (overlay unmount'ится сразу после markFirstMergeSeen, а toast должен жить
 * ещё 3с после merge).
 */
export function MergeSuccessToast() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const onMerge = () => {
      setVisible(true)
      setExiting(false)
      // Start auto-hide timer.
      const hideAt = window.setTimeout(() => {
        setExiting(true)
        window.setTimeout(() => {
          setVisible(false)
          setExiting(false)
        }, TOAST_FADE_MS)
      }, TOAST_SHOW_MS)
      // Cleanup для случая double-fire (хотя tutorial:firstMerge guard'нут
      // markFirstMergeSeen — повторов не должно быть).
      return () => clearTimeout(hideAt)
    }
    eventBus.on('tutorial:firstMerge', onMerge)
    return () => {
      eventBus.off('tutorial:firstMerge', onMerge)
    }
  }, [])

  if (!visible) return null

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: 120, // выше BottomBar
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 101,
          padding: '10px 20px',
          borderRadius: 999,
          // Pink accent per CONTEXT.md (Beat 3 = merge — pink theme).
          background: 'linear-gradient(180deg, #f9a8d4, #ec4899)',
          color: '#fff',
          fontWeight: 800,
          fontSize: 14,
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 12px rgba(0,0,0,0.35)',
          // pointer-events: none — toast информационный, не интерактивен.
          pointerEvents: 'none',
          opacity: exiting ? 0 : 1,
          transition: `opacity ${TOAST_FADE_MS}ms ease-out`,
          animation: exiting
            ? undefined
            : 'onb-merge-toast-slide-up 300ms ease-out',
          whiteSpace: 'nowrap',
        }}
      >
        {t('onboarding.mergeHint.success')}
      </div>
      <style>{`
        @keyframes onb-merge-toast-slide-up {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  )
}
