// Phase 31: Universe Progress page — стандартная app-страница (ff-panel) над
// Phaser-сценой UniverseRestartScene. Стиль строго как у других страниц
// (ShopModal/FrogShopModal): ff-backdrop → ff-panel → ff-display заголовок +
// ff-tile закрытие, ff-card секции, ff-progress бар, ff-btn кнопки.
// Confirm — ИНЛАЙН в странице (не вторая модалка поверх).
//
// Рестарт: POST /game/restart → setLastKnownVersion(version) ПЕРВЫМ (иначе
// следующий PUT → 409 loop) → applyRestartState → reload.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { apiFetch } from '../../api/client'
import { setLastKnownVersion } from '../../api/gameSync'

interface Props {
  onClose: () => void
}

const L19_TARGET = 5

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
    <div
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="ff-panel ff-pop relative flex flex-col"
        style={{
          width: '100%',
          maxWidth: 380,
          maxHeight: '85vh',
          borderRadius: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="ff-display text-2xl flex items-center gap-2">
            <span>♻️</span>
            <span>{t('universeRestart.title')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ff-tile w-9 h-9 text-lg"
            aria-label="close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3 px-4 pb-4 overflow-y-auto">
          <p
            className="text-center text-sm"
            style={{ color: 'var(--ff-text-dim)', margin: 0 }}
          >
            {t('universeRestart.subtitle')}
          </p>

          {/* Stats — два ff-card */}
          <div className="flex gap-3">
            <div className="ff-card flex-1 p-3 text-center">
              <div className="text-xs" style={{ color: 'var(--ff-text-dim)' }}>
                {t('universeRestart.restartCount')}
              </div>
              <div
                className="text-2xl font-extrabold"
                style={{ color: 'var(--ff-accent-gold)' }}
              >
                {universeRestartCount}
              </div>
            </div>
            <div className="ff-card flex-1 p-3 text-center">
              <div className="text-xs" style={{ color: 'var(--ff-text-dim)' }}>
                {t('universeRestart.baseTier')}
              </div>
              <div
                className="text-2xl font-extrabold"
                style={{ color: 'var(--ff-accent-gold)' }}
              >
                {baseTier}
                {baseTier >= 2 && (
                  <span
                    className="text-xs font-semibold ml-1"
                    style={{ color: 'var(--ff-text-dim)' }}
                  >
                    {t('universeRestart.maxTier')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Income boost preview */}
          {baseTier < 2 && (
            <div
              className="ff-card p-3 text-center text-sm font-bold"
              style={{ color: 'var(--ff-neon-green)' }}
            >
              {t('universe.income_boost', { percent: (baseTier + 1) * 10 })}
            </div>
          )}

          {/* Progress */}
          <div className="ff-card p-3">
            <div
              className="text-xs mb-2 font-bold"
              style={{ color: 'var(--ff-text-dim)' }}
            >
              {t('universeRestart.progress')}: {l19Count} / {L19_TARGET}
            </div>
            <div
              className="ff-progress-track"
              style={{ height: 12, borderRadius: 999, overflow: 'hidden' }}
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
            <div
              className="text-center text-sm font-bold"
              style={{ color: '#fca5a5' }}
            >
              {error}
            </div>
          )}

          {/* Action — inline confirm (без второй модалки) */}
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
            <div className="ff-card p-3 flex flex-col gap-3">
              <p
                className="text-center text-sm m-0"
                style={{ color: 'var(--ff-text-light)' }}
              >
                {t('universeRestart.confirmBody')}
              </p>
              <div className="flex gap-3">
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
