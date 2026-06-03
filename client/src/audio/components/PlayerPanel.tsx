import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type CSSProperties,
} from 'react'
import { useTranslation } from 'react-i18next'
import { audioPlayer, TRACK_ORDER } from '../audioPlayer'
import { useAudioPlayer } from '../useAudioPlayer'
import { TRACK_META } from '../tracks'
import type { TrackId } from '../types'

function formatTime(s: number): string {
  const ss = Math.max(0, s)
  return `${Math.floor(ss / 60)}:${String(Math.floor(ss % 60)).padStart(2, '0')}`
}

// Стабильный hue per-track из id-строки. Не требует ручного маппинга.
function hueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 360
}

const EXIT_MS = 420

export function PlayerPanel() {
  const { t } = useTranslation()
  const snap = useAudioPlayer()
  const isPlaying = snap.status === 'playing'
  const isLoading = snap.status === 'loading'

  // Intent — то, какой трек юзер ХОЧЕТ видеть. Меняется СРАЗУ по клику,
  // независимо от async загрузки audioPlayer. Это решает «блокировку»
  // при быстром переключении: UI отвечает на каждый клик мгновенно,
  // playTrack просто crossfade'ится к свежей цели.
  const initialId = snap.trackId ?? TRACK_ORDER[0]
  const [intentId, setIntentId] = useState<TrackId>(initialId)
  const intentIdx = TRACK_ORDER.indexOf(intentId)
  const meta = TRACK_META[intentId]

  // Previous intent для exit-анимации старого диска.
  const [exitingId, setExitingId] = useState<TrackId | null>(null)
  const [slideDir, setSlideDir] = useState<'r' | 'l'>('r')
  // Анимация enter применяется ТОЛЬКО после первого user-клика. Иначе при
  // открытии вкладки музыка диск молча появляется без slide-in.
  const [enterAnim, setEnterAnim] = useState<boolean>(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    },
    [],
  )

  const switchTo = (newId: TrackId, dir: 'r' | 'l') => {
    if (newId === intentId) return
    setExitingId(intentId)
    setSlideDir(dir)
    setEnterAnim(true)
    setIntentId(newId)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = setTimeout(() => {
      setExitingId(null)
      exitTimerRef.current = null
    }, EXIT_MS)
    void audioPlayer.playTrack(newId, 0)
  }

  const handlePlayPause = async (): Promise<void> => {
    if (isPlaying) {
      await audioPlayer.pause()
    } else if (snap.status === 'paused') {
      await audioPlayer.resume()
    } else {
      await audioPlayer.playTrack(intentId)
    }
  }

  const prev = () => {
    const n =
      TRACK_ORDER[(intentIdx - 1 + TRACK_ORDER.length) % TRACK_ORDER.length]
    switchTo(n, 'l')
  }
  const next = () => {
    const n = TRACK_ORDER[(intentIdx + 1) % TRACK_ORDER.length]
    switchTo(n, 'r')
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

  const renderDisc = (id: TrackId, animClass: string) => {
    const hue = hueFromId(id)
    const labelColor = `hsl(${hue}, 70%, 50%)`
    const labelEdge = `hsl(${hue}, 70%, 35%)`
    const m = TRACK_META[id]
    return (
      <div
        key={`disc-${id}-${animClass}`}
        className={animClass}
        style={{
          position: 'absolute',
          inset: 0,
          willChange: 'transform, opacity',
          pointerEvents: 'none',
        }}
      >
        <div
          className={isPlaying && id === intentId ? 'ff-vinyl-spin' : undefined}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 38% 32%, #2a2150 0%, #141033 55%, #05030f 100%)',
            boxShadow:
              '0 0 0 2px rgba(167,139,250,0.6), 0 0 22px rgba(99,102,241,0.55), inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.6)',
            willChange: 'transform',
          }}
        >
          {[0.92, 0.78, 0.64, 0.5].map((scale) => (
            <div
              key={scale}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: `${scale * 100}%`,
                height: `${scale * 100}%`,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            />
          ))}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: `radial-gradient(circle at 50% 50%, ${labelColor} 0%, ${labelEdge} 100%)`,
              border: '2px solid #1f2937',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              textAlign: 'center',
            }}
          >
            <span
              className="ff-display"
              style={{
                fontSize: 11,
                color: '#fff',
                textShadow: '0 1px 0 rgba(0,0,0,0.4)',
                lineHeight: 1.15,
                wordBreak: 'break-word',
              }}
            >
              {t(m.nameKey)}
            </span>
          </div>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#e5e7eb',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4)',
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 items-stretch">
      {/* Turntable — космический проигрыватель */}
      <div
        className="flex flex-col items-center p-4 relative"
        style={{
          gap: 16,
          borderRadius: 14,
          border: '1px solid rgba(120,150,255,0.35)',
          background:
            'radial-gradient(ellipse at 28% 0%, rgba(99,102,241,0.22), transparent 60%),' +
            'radial-gradient(ellipse at 82% 100%, rgba(34,211,238,0.14), transparent 55%),' +
            'linear-gradient(180deg, #0c1026 0%, #070a18 100%)',
          boxShadow:
            '0 0 24px rgba(99,102,241,0.25), inset 0 0 30px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Vinyl disc + tonearm */}
        <div
          style={{
            position: 'relative',
            width: 240,
            height: 240,
            flexShrink: 0,
          }}
        >
          {/* Старый диск уходит в противоположную от направления входа сторону */}
          {exitingId && exitingId !== intentId
            ? renderDisc(
                exitingId,
                slideDir === 'r' ? 'ff-vinyl-exit-l' : 'ff-vinyl-exit-r',
              )
            : null}
          {/* Новый диск прилетает с заданной стороны (только после первого
              переключения — на старте просто статичный диск). */}
          {renderDisc(
            intentId,
            enterAnim
              ? slideDir === 'r'
                ? 'ff-vinyl-slide-r'
                : 'ff-vinyl-slide-l'
              : '',
          )}

          {/* Tonearm — pivot чуть выше правого края диска; рычаг сметает
              угол по диску: playing rotate(-44deg) — игла лежит ближе к
              центру; paused rotate(20deg) — рычаг отведён в сторону. */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              right: -2,
              width: 4,
              height: 150,
              background: 'linear-gradient(180deg, #6b7280, #374151)',
              borderRadius: 2,
              transformOrigin: '50% 0%',
              transform: isPlaying ? 'rotate(-44deg)' : 'rotate(20deg)',
              transition: 'transform 520ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: '-1px 0 0 rgba(255,255,255,0.15) inset',
              zIndex: 1,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: -10,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 35% 35%, #d1d5db, #4b5563)',
              border: '2px solid #1f2937',
              zIndex: 2,
              boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
            }}
          />
        </div>

        {/* Prev / Play / Next — bestiary-style arrows */}
        <div className="flex items-center justify-center gap-3 mt-1">
          <button
            type="button"
            onClick={prev}
            aria-label="prev track"
            className="ff-tile"
            style={{
              width: 44,
              height: 44,
              ['--ff-tile-from' as never]: '#67e8f9',
              ['--ff-tile-to' as never]: '#22d3ee',
              ['--ff-tile-border' as never]: '#0e7490',
              color: '#05121a',
              fontSize: 22,
              lineHeight: 1,
              boxShadow: '0 0 12px rgba(34,211,238,0.5)',
            }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={handlePlayPause}
            aria-label={isPlaying || isLoading ? 'pause' : 'play'}
            style={{
              width: 54,
              height: 54,
              padding: 0,
              fontSize: 22,
              lineHeight: 1,
              borderRadius: '50%',
              border: '2px solid rgba(167,139,250,0.8)',
              background:
                'radial-gradient(circle at 38% 32%, #a78bfa, #6d28d9 70%, #3b0f86)',
              color: '#fff',
              boxShadow:
                '0 0 18px rgba(167,139,250,0.6), inset 0 1px 2px rgba(255,255,255,0.3)',
              touchAction: 'manipulation',
            }}
          >
            {isPlaying || isLoading ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="next track"
            className="ff-tile"
            style={{
              width: 44,
              height: 44,
              ['--ff-tile-from' as never]: '#67e8f9',
              ['--ff-tile-to' as never]: '#22d3ee',
              ['--ff-tile-border' as never]: '#0e7490',
              color: '#05121a',
              fontSize: 22,
              lineHeight: 1,
              boxShadow: '0 0 12px rgba(34,211,238,0.5)',
            }}
          >
            ›
          </button>
        </div>

        {/* Track index dots */}
        <div className="flex gap-1.5 mt-1">
          {TRACK_ORDER.map((id) => (
            <div
              key={id}
              style={{
                width: id === intentId ? 12 : 8,
                height: 8,
                borderRadius: 4,
                background:
                  id === intentId ? '#22d3ee' : 'rgba(120,150,255,0.25)',
                boxShadow:
                  id === intentId ? '0 0 8px rgba(34,211,238,0.7)' : 'none',
                transition: 'width 200ms ease, background 200ms ease',
              }}
            />
          ))}
        </div>

        {/* Section + time */}
        {meta && (
          <div
            className="ff-body text-xs text-center"
            style={{ color: '#a8b4ff' }}
          >
            {sectionLabel}
          </div>
        )}
        <div
          className="ff-body text-xs tabular-nums"
          style={{ color: '#7fe9e0' }}
        >
          {formatTime(snap.elapsed)} / {formatTime(snap.totalSec)}
        </div>

        {/* Progress bar */}
        <div
          onClick={handleProgressClick}
          style={{
            position: 'relative',
            height: 12,
            borderRadius: 8,
            background: 'rgba(8,12,28,0.8)',
            cursor: meta ? 'pointer' : 'default',
            border: '1.5px solid rgba(120,150,255,0.45)',
            overflow: 'hidden',
            width: '100%',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #5fe3d0 0%, #a78bfa 100%)',
              boxShadow: '0 0 10px rgba(95,227,208,0.6)',
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
      </div>

      {/* Volume */}
      <div className="p-3 flex items-center gap-3" style={cosmicCard}>
        <span
          className="ff-body font-bold text-sm flex-shrink-0"
          style={{ color: '#a8b4ff' }}
        >
          {t('player.volume')}
        </span>
        <input
          type="range"
          min={-40}
          max={0}
          step={1}
          value={snap.volume}
          onChange={(e) => audioPlayer.setVolume(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#5fe3d0' }}
        />
        <span
          className="ff-body text-xs tabular-nums w-12 text-right"
          style={{ color: '#7fe9e0' }}
        >
          {snap.volume} dB
        </span>
      </div>

      {/* Auto-resume */}
      <div
        className="p-3 flex items-center justify-between gap-3"
        style={cosmicCard}
      >
        <span
          className="ff-body font-bold text-sm"
          style={{ color: '#a8b4ff' }}
        >
          {t('player.auto_resume')}
        </span>
        <button
          type="button"
          onClick={() => audioPlayer.setAutoResume(!snap.autoResume)}
          className="ff-body text-xs font-bold px-3 py-1.5"
          style={{
            borderRadius: 8,
            border: '1px solid rgba(120,150,255,0.5)',
            background: snap.autoResume
              ? 'rgba(34,211,238,0.22)'
              : 'rgba(30,40,60,0.6)',
            color: snap.autoResume ? '#9af7ec' : '#8aa0c0',
            boxShadow: snap.autoResume
              ? '0 0 10px rgba(34,211,238,0.4)'
              : 'none',
            touchAction: 'manipulation',
          }}
        >
          {snap.autoResume ? t('player.on') : t('player.off')}
        </button>
      </div>
    </div>
  )
}

// Космическая «карточка» (тёмная панель с неоновой рамкой) — для volume/resume.
const cosmicCard: CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(120,150,255,0.3)',
  background: 'linear-gradient(180deg, #0c1026 0%, #080b1a 100%)',
  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.45)',
}
