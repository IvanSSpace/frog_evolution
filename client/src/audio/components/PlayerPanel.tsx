import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { audioPlayer, TRACK_ORDER, TRACK_TOTALS } from '../audioPlayer'
import { useAudioPlayer } from '../useAudioPlayer'
import { TRACK_META } from '../tracks'
import type { TrackId } from '../types'
import { Visualizer } from './Visualizer'

function formatTime(s: number): string {
  const ss = Math.max(0, s)
  return `${Math.floor(ss / 60)}:${String(Math.floor(ss % 60)).padStart(2, '0')}`
}

export function PlayerPanel() {
  const { t } = useTranslation()
  const snap = useAudioPlayer()
  const meta = snap.trackId ? TRACK_META[snap.trackId] : null

  const handlePlayPause = async (): Promise<void> => {
    if (snap.status === 'playing') {
      await audioPlayer.pause()
    } else if (snap.status === 'paused') {
      await audioPlayer.resume()
    } else {
      await audioPlayer.playTrack(snap.trackId ?? TRACK_ORDER[0])
    }
  }

  const handleSelectTrack = async (id: TrackId): Promise<void> => {
    if (snap.trackId === id && snap.status === 'playing') return
    await audioPlayer.playTrack(id, 0)
  }

  const handleProgressClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (!snap.totalSec) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioPlayer.seekTo(pct * snap.totalSec)
  }

  const sectionLabel = (() => {
    if (!meta) return ''
    const sec = meta.sections[snap.sectionIdx] ?? meta.sections[0]
    return sec ? `${sec.label} · ${sec.key}` : ''
  })()

  const progressPct =
    snap.totalSec > 0 ? Math.min(100, (snap.elapsed / snap.totalSec) * 100) : 0
  const isLoading = snap.status === 'loading'

  return (
    <div className="flex flex-col gap-3">
      {/* Now playing */}
      <div className="ff-card p-3 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="ff-display text-sm" style={{ color: '#15803d' }}>
            {meta ? t(meta.nameKey) : t('player.no_track')}
          </span>
          <span
            className="ff-body text-xs tabular-nums"
            style={{ color: '#166534' }}
          >
            {formatTime(snap.elapsed)} / {formatTime(snap.totalSec)}
          </span>
        </div>
        {meta && (
          <div className="ff-body text-xs" style={{ color: '#3f6212' }}>
            {sectionLabel}
          </div>
        )}

        {/* Progress bar */}
        <div
          onClick={handleProgressClick}
          style={{
            position: 'relative',
            height: 14,
            borderRadius: 8,
            background: '#1a2e1a',
            cursor: meta ? 'pointer' : 'default',
            border: '2px solid #166534',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${progressPct}%`,
              background: 'linear-gradient(180deg, #4ade80 0%, #16a34a 100%)',
              transition: 'width 80ms linear',
            }}
          />
          {meta?.sections.map((s, i) => {
            if (i === 0) return null
            const left = (s.start / meta.totalSec) * 100
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: 'rgba(255,255,255,0.45)',
                }}
              />
            )
          })}
        </div>

        {/* Transport controls */}
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => audioPlayer.seekTo(snap.elapsed - 15)}
            disabled={!meta}
            className="ff-btn ff-btn-grey text-sm flex-1 py-2"
          >
            −15
          </button>
          <button
            onClick={handlePlayPause}
            disabled={isLoading}
            className={`ff-btn text-base flex-1 py-2 ${snap.status === 'playing' ? 'ff-btn-yellow' : 'ff-btn-green'}`}
          >
            {isLoading
              ? '…'
              : snap.status === 'playing'
                ? t('player.pause')
                : t('player.play')}
          </button>
          <button
            onClick={() => audioPlayer.seekTo(snap.elapsed + 15)}
            disabled={!meta}
            className="ff-btn ff-btn-grey text-sm flex-1 py-2"
          >
            +15
          </button>
        </div>
      </div>

      {/* Volume */}
      <div className="ff-card p-3 flex items-center gap-3">
        <span className="ff-body font-bold text-emerald-900 text-sm flex-shrink-0">
          {t('player.volume')}
        </span>
        <input
          type="range"
          min={-40}
          max={0}
          step={1}
          value={snap.volume}
          onChange={(e) => audioPlayer.setVolume(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#16a34a' }}
        />
        <span
          className="ff-body text-xs tabular-nums w-12 text-right"
          style={{ color: '#166534' }}
        >
          {snap.volume} dB
        </span>
      </div>

      {/* Visualizer toggle */}
      <div className="ff-card p-3 flex items-center justify-between gap-3">
        <span className="ff-body font-bold text-emerald-900 text-sm">
          {t('player.visualizer')}
        </span>
        <button
          onClick={() => audioPlayer.setVizEnabled(!snap.vizEnabled)}
          className={`ff-btn text-xs px-3 py-1.5 ${snap.vizEnabled ? 'ff-btn-green' : 'ff-btn-grey'}`}
        >
          {snap.vizEnabled ? t('player.on') : t('player.off')}
        </button>
      </div>

      {snap.vizEnabled && snap.status === 'playing' && (
        <Visualizer active={snap.vizEnabled && snap.status === 'playing'} />
      )}

      {/* Auto-resume */}
      <div className="ff-card p-3 flex items-center justify-between gap-3">
        <span className="ff-body font-bold text-emerald-900 text-sm">
          {t('player.auto_resume')}
        </span>
        <button
          onClick={() => audioPlayer.setAutoResume(!snap.autoResume)}
          className={`ff-btn text-xs px-3 py-1.5 ${snap.autoResume ? 'ff-btn-green' : 'ff-btn-grey'}`}
        >
          {snap.autoResume ? t('player.on') : t('player.off')}
        </button>
      </div>

      {/* Track list */}
      <div className="ff-display text-xs mt-1" style={{ color: '#15803d' }}>
        {t('player.tracks_label')}
      </div>
      {TRACK_ORDER.map((id) => {
        const m = TRACK_META[id]
        const isCurrent = snap.trackId === id
        const total = TRACK_TOTALS[id]
        return (
          <button
            key={id}
            onClick={() => handleSelectTrack(id)}
            disabled={isLoading}
            className={`ff-card p-2.5 flex items-center justify-between text-left ${isCurrent ? '' : ''}`}
            style={{
              border: isCurrent ? '3px solid #16a34a' : undefined,
              cursor: isLoading ? 'wait' : 'pointer',
            }}
          >
            <div className="flex flex-col">
              <span className="ff-display text-sm" style={{ color: '#14532d' }}>
                {t(m.nameKey)}
              </span>
              <span className="ff-body text-xs" style={{ color: '#3f6212' }}>
                {t(m.descKey)}
              </span>
            </div>
            <span
              className="ff-body text-xs tabular-nums"
              style={{ color: '#166534' }}
            >
              {formatTime(total)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
