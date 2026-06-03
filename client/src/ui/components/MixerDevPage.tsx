// MixerDevPage — СЛУЖЕБНАЯ (dev-only) страница тюнинга треков.
//
// Открывается ТОЛЬКО по прямому URL: /mixer (или #mixer) — кнопок в UI нет.
// Назначение: быстро покрутить громкости голосов текущего трека вживую и
// кнопкой «Скопировать параметры» выгрузить значения (trackId + channel: dB),
// чтобы передать их в чат — я по ним правлю исходник трека (voice.volume.value).
//
// НЕ ПОПАДАЕТ В ПРОД-БАНДЛ: компонент и его монтирование обёрнуты в
// import.meta.env.DEV — Vite (define) сворачивает ветку в false и tree-shake'ит
// весь модуль из production-сборки (как TelegramSafeAreaDebugOverlay).

// Путь активации страницы. Поддерживаем pathname (vite SPA-fallback в dev) и hash.
function isMixerPath(): boolean {
  if (typeof window === 'undefined') return false
  const { pathname, hash } = window.location
  return pathname === '/mixer' || hash.replace(/^#\/?/, '') === 'mixer'
}

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { audioPlayer, TRACK_ORDER } from '../../audio/audioPlayer'
import { useAudioPlayer } from '../../audio/useAudioPlayer'
import { TRACK_META } from '../../audio/tracks'
import type { MixerChannel } from '../../audio/types'
import type { TrackId } from '../../audio/types'

export function MixerDevPage() {
  if (!import.meta.env.DEV) return null
  return <MixerDevPageInner />
}

function MixerDevPageInner() {
  const snap = useAudioPlayer()
  const active = isMixerPath()
  const [channels, setChannels] = useState<MixerChannel[]>([])
  const [vals, setVals] = useState<Record<string, number>>({})
  const [copied, setCopied] = useState(false)

  // Перечитываем каналы при смене трека/статуса (голоса есть после build).
  useEffect(() => {
    if (!active) return
    const ch = audioPlayer.getMixer()
    setChannels(ch)
    const v: Record<string, number> = {}
    for (const c of ch) v[c.id] = c.getDb()
    setVals(v)
  }, [active, snap.trackId, snap.status])

  const setDb = (c: MixerChannel, db: number) => {
    c.setDb(db)
    setVals((prev) => ({ ...prev, [c.id]: db }))
  }

  const switchTrack = (dir: -1 | 1) => {
    const cur = snap.trackId ?? TRACK_ORDER[0]
    const idx = TRACK_ORDER.indexOf(cur as TrackId)
    const next =
      TRACK_ORDER[(idx + dir + TRACK_ORDER.length) % TRACK_ORDER.length]
    void audioPlayer.playTrack(next, 0)
  }

  const exportParams = () => {
    const lines = [
      `track: ${snap.trackId ?? '?'}`,
      ...channels.map(
        (c) => `${c.id}: ${(vals[c.id] ?? c.getDb()).toFixed(1)}`,
      ),
    ]
    const text = lines.join('\n')
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => {
        /* clipboard недоступен — выведем в консоль как fallback */
        console.log('[mixer params]\n' + text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
    )
  }

  // Не на /mixer — ничего не рендерим (страница доступна только по прямому URL).
  if (!active) return null

  const trackName = snap.trackId
    ? TRACK_META[snap.trackId].id
    : '— трек не выбран —'

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(8,12,20,0.94)',
        color: '#e5f5e5',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        touchAction: 'manipulation',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 12px',
          borderBottom: '1px solid #2a3a4a',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, color: '#5fe3d0' }}>
          🎚 MIXER (dev)
        </span>
        <button type="button" onClick={() => switchTrack(-1)} style={devBtn}>
          ◀
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 13 }}>
          {trackName} · {snap.status}
        </span>
        <button type="button" onClick={() => switchTrack(1)} style={devBtn}>
          ▶
        </button>
        <button
          type="button"
          onClick={() => window.location.assign('/')}
          style={{ ...devBtn, color: '#ff8a8a', borderColor: '#7f1d1d' }}
          aria-label="close"
        >
          ✕
        </button>
      </div>

      {/* Channels */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {channels.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 14, marginTop: 24 }}>
            Голоса появятся после запуска трека. Нажми ▶ или включи музыку в
            «Настройки → Музыка».
          </div>
        ) : (
          channels.map((c) => {
            const db = vals[c.id] ?? c.getDb()
            return (
              <div
                key={c.id}
                style={{ display: 'flex', flexDirection: 'column' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{c.label}</span>
                  <span
                    style={{
                      color: '#9fd',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {db.toFixed(1)} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-60}
                  max={6}
                  step={0.5}
                  value={db}
                  onChange={(e) => setDb(c, Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#5fe3d0' }}
                />
              </div>
            )
          })
        )}
      </div>

      {/* Footer — export */}
      <div
        style={{
          padding: 12,
          borderTop: '1px solid #2a3a4a',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={exportParams}
          disabled={channels.length === 0}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            background: copied ? '#16a34a' : '#5fe3d0',
            color: '#08121c',
            fontWeight: 700,
            fontSize: 15,
            touchAction: 'manipulation',
            opacity: channels.length === 0 ? 0.5 : 1,
          }}
        >
          {copied ? '✓ Скопировано' : '📋 Скопировать параметры'}
        </button>
      </div>
    </div>,
    document.body,
  )
}

const devBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 6,
  background: 'rgba(30,40,55,0.9)',
  border: '1px solid #3a5a6a',
  color: '#cfe',
  fontSize: 14,
  touchAction: 'manipulation',
  flexShrink: 0,
}
