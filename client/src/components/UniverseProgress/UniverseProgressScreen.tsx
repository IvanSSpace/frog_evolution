// Phase 31: Universe Restart HUD — контент одним центрированным блоком ПРЯМО на
// Phaser-сцене UniverseRestartScene (не модалка, не spread на весь экран — иначе
// налезает на верхний HUD золота и нижний бар локаций). Выход — через кнопки
// локаций (нет кнопки закрытия). Читаемость над звёздами — text-shadow.
//
// Рестарт: POST /game/restart → setLastKnownVersion(version) ПЕРВЫМ (иначе
// следующий PUT → 409 loop) → applyRestartState → reload.

import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { apiFetch } from '../../api/client'
import { setLastKnownVersion } from '../../api/gameSync'

interface Props {
  onClose: () => void
}

const L19_TARGET = 5

const SHADOW = '0 2px 10px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.85)'
const dimStyle: CSSProperties = {
  color: 'var(--ff-text-dim)',
  textShadow: SHADOW,
}

// onClose оставлен в Props для совместимости (вызывается при confirm-flow reload),
// но кнопки закрытия нет — выход через LocationStack.
export function UniverseProgressScreen(_props: Props) {
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
      // КРИТИЧНО: lastKnownVersion ДО reload — иначе следующий PUT → 409 loop.
      setLastKnownVersion(data.version)
      applyRestartState(data as Parameters<typeof applyRestartState>[0])
      window.location.reload()
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  return (
    // Прозрачный слой, контент центрирован в СЕРЕДИНЕ сцены (не на весь экран —
    // чтобы не налезать на верхний HUD и нижний бар локаций). pointerEvents:none
    // на слое → клики по пустоте проходят к сцене / кнопкам локаций.
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // z-index 45 — НИЖЕ LocationStack (50), чтобы кнопки локаций оставались
        // кликабельны поверх HUD рестарта. Выше игрового canvas/баров (0-30).
        zIndex: 45,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        touchAction: 'manipulation',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          width: '100%',
          maxWidth: 300,
          padding: '0 16px',
        }}
      >
        {/* Заголовок */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 46, lineHeight: 1, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))' }}>
            ♻️
          </div>
          <div className="ff-display text-2xl" style={{ marginTop: 6 }}>
            {t('universeRestart.title')}
          </div>
          <p style={{ ...dimStyle, fontSize: 13, margin: '4px 0 0' }}>
            {t('universeRestart.subtitle')}
          </p>
        </div>

        {/* Статы — две колонки без карточек */}
        <div style={{ display: 'flex', gap: 36, justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...dimStyle, fontSize: 12 }}>
              {t('universeRestart.restartCount')}
            </div>
            <div className="ff-display" style={{ fontSize: 28, color: 'var(--ff-accent-gold)' }}>
              {universeRestartCount}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...dimStyle, fontSize: 12 }}>
              {t('universeRestart.baseTier')}
            </div>
            <div className="ff-display" style={{ fontSize: 28, color: 'var(--ff-accent-gold)' }}>
              {baseTier}
              {baseTier >= 2 && (
                <span style={{ ...dimStyle, fontSize: 12, marginLeft: 4 }}>
                  {t('universeRestart.maxTier')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Income boost */}
        {baseTier < 2 && (
          <div
            style={{
              color: 'var(--ff-neon-green-soft)',
              fontWeight: 800,
              fontSize: 15,
              textAlign: 'center',
              textShadow: SHADOW,
            }}
          >
            {t('universe.income_boost', { percent: (baseTier + 1) * 10 })}
          </div>
        )}

        {/* Прогресс */}
        <div style={{ width: '100%' }}>
          <div style={{ ...dimStyle, fontSize: 13, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>
            {t('universeRestart.progress')}: {l19Count} / {L19_TARGET}
          </div>
          <div
            className="ff-progress-track"
            style={{ height: 14, borderRadius: 999, overflow: 'hidden' }}
          >
            <div
              className={`ff-progress-fill${canRestart ? '' : ' waiting'}`}
              style={{
                height: '100%',
                width: `${progressPct}%`,
                borderRadius: 999,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {error && (
          <div style={{ color: '#fca5a5', fontSize: 13, fontWeight: 700, textShadow: SHADOW }}>
            {error}
          </div>
        )}

        {/* Действие — кнопка внутри блока (pointerEvents:auto). Confirm инлайн. */}
        <div style={{ width: '100%', pointerEvents: 'auto', marginTop: 4 }}>
          {!confirmOpen ? (
            <button
              type="button"
              disabled={!canRestart || loading}
              onClick={() => setConfirmOpen(true)}
              className="ff-btn ff-btn-purple w-full text-base"
            >
              {t('universeRestart.restartButton')}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ color: 'var(--ff-text-light)', fontSize: 14, textAlign: 'center', margin: 0, textShadow: SHADOW }}>
                {t('universeRestart.confirmBody')}
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={loading}
                  className="ff-btn ff-btn-grey flex-1 text-sm"
                >
                  {t('universeRestart.cancelButton')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestart}
                  disabled={loading}
                  className="ff-btn ff-btn-red flex-1 text-sm"
                >
                  {loading ? '...' : t('universeRestart.confirmButton')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
