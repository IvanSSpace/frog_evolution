// Phase 31 Plan 31-04: Universe Progress Screen — DOM overlay для prestige-цикла.
// Показывает прогресс l19Count/5, кнопку рестарта (disabled при <5),
// confirm-модалку и информацию о приросте дохода после рестарта.
//
// Порядок при рестарте:
//   1. POST /game/restart → получаем {version, ...restartFields}
//   2. setLastKnownVersion(data.version) ПЕРВЫМ — иначе следующий PUT → 409
//   3. applyRestartState(data) — обновляем store мета-поля (baseTier, restartCount и т.д.)
//   4. window.location.reload() — очищаем Phaser сцены и store полностью

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
      // apiFetch добавляет Authorization Bearer и retry при 401
      const res = await apiFetch('/game/restart', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? `Error ${res.status}`)
        setLoading(false)
        return
      }
      const data = await res.json() as { version: number; [key: string]: unknown }
      // КРИТИЧНО: обновить lastKnownVersion ДО window.location.reload()
      // иначе следующий scheduled PUT → 409 → reload loop (T-31-13)
      setLastKnownVersion(data.version)
      // Применить мета-поля из server response (baseTier, restartCount, l19Count)
      applyRestartState(data as Parameters<typeof applyRestartState>[0])
      // Перезагрузить страницу чтобы очистить Phaser сцены и store
      window.location.reload()
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  return (
    // zIndex=70: между StarMap (50) и CosmicHub (100).
    // Фон прозрачный — Phaser UniverseRestartScene видна позади.
    // Виньетка по краям даёт глубину без полного перекрытия сцены.
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
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
          // Без карточки-модалки — контент сидит прямо на Phaser-сцене.
          background: 'transparent',
          padding: '32px',
          maxWidth: '400px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          textShadow: '0 1px 6px rgba(0,0,0,0.85)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px' }}>♻️</div>
          <h2 style={{ color: '#f59e0b', margin: '8px 0 4px', fontSize: '20px' }}>
            {t('universeRestart.title')}
          </h2>
          <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>
            {t('universeRestart.subtitle')}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: '#ccc', fontSize: '14px' }}>
            {t('universeRestart.restartCount')}:{' '}
            <strong style={{ color: '#f59e0b' }}>{universeRestartCount}</strong>
          </div>
          <div style={{ color: '#ccc', fontSize: '14px' }}>
            {t('universeRestart.baseTier')}:{' '}
            <strong style={{ color: '#f59e0b' }}>{baseTier}</strong>
            {baseTier >= 2 && (
              <span style={{ color: '#888', fontSize: '12px', marginLeft: '6px' }}>
                {t('universeRestart.maxTier')}
              </span>
            )}
          </div>
        </div>

        {/* FIX 2: income-boost preview — ОБЯЗАТЕЛЬНО показываем игроку прирост дохода.
            nextBoostPct = (baseTier + 1) * 10; показываем только если не на максимуме. */}
        {baseTier < 2 && (
          <div
            style={{
              color: '#22c55e',
              fontSize: '14px',
              textAlign: 'center',
              fontWeight: 600,
              padding: '8px 12px',
              background: 'rgba(34, 197, 94, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(34, 197, 94, 0.25)',
            }}
          >
            {t('universe.income_boost', { percent: (baseTier + 1) * 10 })}
          </div>
        )}

        {/* Progress bar */}
        <div>
          <div style={{ color: '#ccc', fontSize: '13px', marginBottom: '6px' }}>
            {t('universeRestart.progress')}: {l19Count} / {L19_TARGET}
          </div>
          <div
            style={{
              background: '#333',
              borderRadius: '6px',
              height: '10px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                background: canRestart ? '#22c55e' : '#f59e0b',
                borderRadius: '6px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Action buttons — cliclability checklist: type="button", touchAction: manipulation */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #444',
              background: 'transparent',
              color: '#aaa',
              cursor: 'pointer',
              touchAction: 'manipulation',
              fontSize: '14px',
            }}
          >
            {t('universeRestart.closeButton')}
          </button>
          <button
            type="button"
            disabled={!canRestart || loading}
            onClick={() => setConfirmOpen(true)}
            style={{
              flex: 2,
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: canRestart ? '#f59e0b' : '#444',
              color: canRestart ? '#000' : '#666',
              cursor: canRestart ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              touchAction: 'manipulation',
              fontSize: '14px',
            }}
          >
            {t('universeRestart.restartButton')}
          </button>
        </div>
      </div>

      {/* Confirm Modal — zIndex=80, выше основного overlay */}
      {confirmOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              background: '#1a1a2e',
              border: '1px solid #ef4444',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '340px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: '#ef4444', margin: 0, textAlign: 'center' }}>
              {t('universeRestart.confirmTitle')}
            </h3>
            <p style={{ color: '#ccc', fontSize: '14px', textAlign: 'center', margin: 0 }}>
              {t('universeRestart.confirmBody')}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #444',
                  background: 'transparent',
                  color: '#aaa',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  touchAction: 'manipulation',
                  fontSize: '14px',
                }}
              >
                {t('universeRestart.cancelButton')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRestart}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  touchAction: 'manipulation',
                  fontSize: '14px',
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
