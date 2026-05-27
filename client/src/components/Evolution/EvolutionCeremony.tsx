// Phase Evolution — Pokemon-style evolution ceremony (Beat: визуальный апгрейд тира).
//
// Self-mounting overlay. Подписан на eventBus 'frog:evolution-ceremony'
// (эмитит FrogShopModal.handleEvolve после успешного upgradeFrogTier).
//
// Сценарий:
//   buildup (0 → 1.45s): старая лягушка дрожит и наливается белым свечением.
//   flash   (≈1.44s):    белая вспышка на весь экран на пике.
//   reveal  (1.45s →):   на пике свапаем old→new; новая лягушка проявляется
//                        с overshoot, искры разлетаются, заголовок «Эволюция!» + бонус.
//   dismiss: tap по CTA / backdrop (только после reveal) → fade-out → unmount.
//
// Cliclability checklist (memory feedback_clickability):
//   - button type="button"; z-index 300 (выше FrogShopModal=100, CaptainBirthModal=200)
//   - backdrop click dismisses (после reveal); stopPropagation на inner card
//   - touchAction: manipulation
//
// IMPORTANT: CSS keyframes only (memory feedback_animations — НЕ Lottie).
// Лягушки тут — DOM SVG <img> (TintedFrog), не Phaser frog.container, поэтому
// правило «не tween'ить alpha на frog.container» здесь неприменимо.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TintedFrog } from '../../ui/components/TintedFrog'
import { eventBus } from '../../store/eventBus'
import { useModalLock } from '../../utils/modalLock'
import { hapticNotification } from '../../utils/telegram'
import './evolutionCeremony.css'

const SWAP_MS = 1450 // совпадает с пиком ec-flash (≈72% от 2s)
const FADE_OUT_MS = 360

type Ceremony = {
  level: number
  newTier: number
  oldPath: string
  newPath: string
  tint: number
  name: string
  bonusPct: number
}

const SPARKLE_COUNT = 12

export function EvolutionCeremony() {
  const [data, setData] = useState<Ceremony | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [exiting, setExiting] = useState(false)
  const swapTimer = useRef<number | null>(null)
  useModalLock(!!data)

  useEffect(() => {
    const onStart = (payload: Ceremony) => {
      setData(payload)
      setRevealed(false)
      setExiting(false)
    }
    eventBus.on('frog:evolution-ceremony', onStart)
    return () => {
      eventBus.off('frog:evolution-ceremony', onStart)
    }
  }, [])

  // На пике вспышки — свап old→new + success-haptic.
  useEffect(() => {
    if (!data) return
    swapTimer.current = window.setTimeout(() => {
      setRevealed(true)
      hapticNotification('success')
    }, SWAP_MS)
    return () => {
      if (swapTimer.current != null) window.clearTimeout(swapTimer.current)
    }
  }, [data])

  if (!data) return null

  const handleDismiss = () => {
    if (!revealed || exiting) return // не закрывать пока идёт вспышка
    setExiting(true)
    window.setTimeout(() => {
      setData(null)
      setRevealed(false)
      setExiting(false)
    }, FADE_OUT_MS)
  }

  const node = (
    <div
      className={`ec-backdrop${exiting ? ' is-exiting' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Эволюция лягушки"
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background:
          'radial-gradient(ellipse at center, rgba(8,20,8,0.82) 0%, rgba(0,0,0,0.95) 70%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        touchAction: 'manipulation',
        overflow: 'hidden',
      }}
    >
      {/* Сцена с лягушкой (фикс-бокс, чтобы swap не дёргал layout). */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 200,
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Мягкая аура позади (только после reveal). */}
        {revealed && (
          <div
            className="ec-aura"
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(253,224,71,0.55) 0%, rgba(74,222,128,0.25) 45%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Лягушка: старая (buildup) либо новая (reveal). */}
        <div
          style={{
            position: 'relative',
            width: 160,
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!revealed ? (
            <TintedFrog
              key="old"
              path={data.oldPath}
              tint={data.tint}
              alt={data.name}
              className="ec-frog-old"
              style={{
                width: 160,
                height: 160,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <TintedFrog
              key="new"
              path={data.newPath}
              tint={data.tint}
              alt={`${data.name} t${data.newTier}`}
              className="ec-frog-new"
              style={{
                width: 160,
                height: 160,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}
        </div>

        {/* Искры — разлетаются на reveal. */}
        {revealed &&
          Array.from({ length: SPARKLE_COUNT }).map((_, i) => (
            <span
              key={i}
              className="ec-sparkle"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 8,
                height: 8,
                marginLeft: -4,
                marginTop: -4,
                borderRadius: '50%',
                background: i % 2 === 0 ? '#fde047' : '#a3e635',
                boxShadow: '0 0 8px rgba(253,224,71,0.9)',
                pointerEvents: 'none',
                ['--ec-ang' as never]: `${(360 / SPARKLE_COUNT) * i}deg`,
                animationDelay: `${(i % 4) * 40}ms`,
              }}
            />
          ))}
      </div>

      {/* Белая вспышка поверх всего (one-shot). */}
      <div
        className="ec-flash"
        style={{
          position: 'fixed',
          inset: 0,
          background:
            'radial-gradient(circle at center, #ffffff 0%, #ffffff 45%, rgba(255,255,255,0.6) 100%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Заголовок + бонус — только после reveal. */}
      {revealed && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="ec-title"
          style={{
            marginTop: 18,
            textAlign: 'center',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 900,
              color: '#fde047',
              letterSpacing: 1,
              textShadow: '0 2px 16px rgba(253, 224, 71, 0.5)',
            }}
          >
            Эволюция!
          </h1>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 15,
              fontWeight: 700,
              color: '#d4f7c5',
            }}
          >
            {data.name} → тир {data.newTier}
          </p>
          {data.bonusPct > 0 && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 14,
                fontWeight: 800,
                color: '#4ade80',
              }}
            >
              +{data.bonusPct}% к доходу
            </p>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            style={{
              marginTop: 18,
              minWidth: 180,
              background: '#16a34a',
              borderRadius: 12,
              padding: '12px 28px',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              border: '2px solid #14532d',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            Класс!
          </button>
        </div>
      )}
    </div>
  )

  return createPortal(node, document.body)
}
