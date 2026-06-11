// Phase 31 Plan 31-04: Universe Progress Screen — DOM HUD над Phaser-сценой
// UniverseRestartScene. Стилизован под общий ff-panel стиль приложения
// (parchment-карточка + pink-pill CTA + зелёный/золотой текст, см. CosmicHub/_styles).
// Показывает прогресс l19Count/5, кнопку рестарта (disabled при <5),
// confirm-модалку и прирост дохода после рестарта.
//
// Порядок при рестарте:
//   1. POST /game/restart → получаем {version, ...restartFields}
//   2. setLastKnownVersion(data.version) ПЕРВЫМ — иначе следующий PUT → 409
//   3. applyRestartState(data) — обновляем store мета-поля (baseTier, restartCount и т.д.)
//   4. window.location.reload() — очищаем Phaser сцены и store полностью

import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { apiFetch } from '../../api/client'
import { setLastKnownVersion } from '../../api/gameSync'
import {
  DARK_CARD_STYLE,
  PINK_CTA_STYLE,
  DISABLED_CTA_OVERRIDES,
  GOLD,
  TEXT_PRIMARY,
  TEXT_DIM,
  SECTION_HEADER_LG_STYLE,
} from '../CosmicHub/_styles'

interface Props {
  onClose: () => void
}

const L19_TARGET = 5

// Нейтральная «outline» кнопка под app-стиль (вторичное действие).
const SECONDARY_BTN_STYLE: CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  borderRadius: 999,
  border: '2px solid #7c5c2a',
  background: 'rgba(254,253,243,0.85)',
  color: TEXT_DIM,
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  touchAction: 'manipulation',
}

// Деструктивная (красная) pill — подтверждение рестарта.
const DANGER_CTA_STYLE: CSSProperties = {
  ...PINK_CTA_STYLE,
  background: 'linear-gradient(180deg, #f87171 0%, #dc2626 100%)',
}

export function UniverseProgressScreen({ onClose }: Props) {
  const { t } = useTranslation()
  const l19Count = useGameStore((s) => s.l19Count)
  const baseTier = useGameStore((s) => s.baseTier)
  const universeRestartCount = useGameStore((s) => s.universeRestartCount)
  const applyRestartState = useGameStore((s) => s.applyRestartState)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRestart = l19Count >= L19_TARGET
  const progressPct = Math.min(100, (l19Count / L19_TARGET) * 100)

  async function handleConfirmRestart() {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/game/restart', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? `Error ${res.status}`)
        setLoading(false)
        return
      }
      const data = (await res.json()) as { version: number; [key: string]: unknown }
      // КРИТИЧНО: обновить lastKnownVersion ДО window.location.reload()
      // иначе следующий scheduled PUT → 409 → reload loop (T-31-13)
      setLastKnownVersion(data.version)
      applyRestartState(data as Parameters<typeof applyRestartState>[0])
      window.location.reload()
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  const statValueStyle: CSSProperties = { color: GOLD, fontWeight: 800 }

  return (
    // Прозрачная виньетка — Phaser UniverseRestartScene видна позади.
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background:
          'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        touchAction: 'manipulation',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          ...DARK_CARD_STYLE,
          padding: 24,
          maxWidth: 380,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, lineHeight: 1 }}>♻️</div>
          <h2 style={{ ...SECTION_HEADER_LG_STYLE, margin: '8px 0 2px', fontSize: 20 }}>
            {t('universeRestart.title')}
          </h2>
          <p style={{ color: TEXT_DIM, fontSize: 13, margin: 0, opacity: 0.85 }}>
            {t('universeRestart.subtitle')}
          </p>
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            gap: 8,
            background: 'rgba(124,92,42,0.10)',
            borderRadius: 12,
            padding: '10px 8px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: TEXT_DIM, fontSize: 12 }}>
              {t('universeRestart.restartCount')}
            </div>
            <div style={{ ...statValueStyle, fontSize: 18 }}>{universeRestartCount}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(124,92,42,0.25)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: TEXT_DIM, fontSize: 12 }}>
              {t('universeRestart.baseTier')}
            </div>
            <div style={{ ...statValueStyle, fontSize: 18 }}>
              {baseTier}
              {baseTier >= 2 && (
                <span style={{ color: TEXT_DIM, fontSize: 11, marginLeft: 4, fontWeight: 600 }}>
                  {t('universeRestart.maxTier')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* FIX 2: income-boost preview — прирост дохода после рестарта. */}
        {baseTier < 2 && (
          <div
            style={{
              color: TEXT_PRIMARY,
              fontSize: 14,
              textAlign: 'center',
              fontWeight: 700,
              padding: '8px 12px',
              background: 'rgba(21,128,61,0.12)',
              borderRadius: 12,
              border: '2px solid rgba(21,128,61,0.30)',
            }}
          >
            {t('universe.income_boost', { percent: (baseTier + 1) * 10 })}
          </div>
        )}

        {/* Progress bar */}
        <div>
          <div style={{ color: TEXT_DIM, fontSize: 13, marginBottom: 6, fontWeight: 700 }}>
            {t('universeRestart.progress')}: {l19Count} / {L19_TARGET}
          </div>
          <div
            style={{
              background: 'rgba(124,92,42,0.20)',
              borderRadius: 999,
              height: 12,
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                background: canRestart
                  ? 'linear-gradient(180deg, #86efac 0%, #15803d 100%)'
                  : 'linear-gradient(180deg, #fde68a 0%, #a16207 100%)',
                borderRadius: 999,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ color: '#b91c1c', fontSize: 13, textAlign: 'center', fontWeight: 700 }}>
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={SECONDARY_BTN_STYLE}>
            {t('universeRestart.closeButton')}
          </button>
          <button
            type="button"
            disabled={!canRestart || loading}
            onClick={() => setConfirmOpen(true)}
            style={{
              ...PINK_CTA_STYLE,
              flex: 2,
              fontSize: 14,
              ...(!canRestart || loading ? DISABLED_CTA_OVERRIDES : {}),
            }}
          >
            {t('universeRestart.restartButton')}
          </button>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              ...DARK_CARD_STYLE,
              border: '3px solid #b91c1c',
              boxShadow: '0 0 0 2px #fde2e2 inset, 0 4px 0 #7f1d1d',
              padding: 24,
              maxWidth: 330,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                color: '#b91c1c',
                margin: 0,
                textAlign: 'center',
                fontWeight: 800,
                fontSize: 17,
              }}
            >
              {t('universeRestart.confirmTitle')}
            </h3>
            <p style={{ color: TEXT_DIM, fontSize: 14, textAlign: 'center', margin: 0 }}>
              {t('universeRestart.confirmBody')}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                style={{ ...SECONDARY_BTN_STYLE, ...(loading ? DISABLED_CTA_OVERRIDES : {}) }}
              >
                {t('universeRestart.cancelButton')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRestart}
                disabled={loading}
                style={{
                  ...DANGER_CTA_STYLE,
                  flex: 1,
                  fontSize: 14,
                  ...(loading ? DISABLED_CTA_OVERRIDES : {}),
                }}
              >
                {loading ? '...' : t('universeRestart.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
