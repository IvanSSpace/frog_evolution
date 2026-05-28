import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useClanStore } from '../../store/clan/slice'
import { useClanPolling } from '../../hooks/useClanPolling'
import { fetchClanMe } from '../../api/clan'
import type { ClanSnapshot } from '../../api/clan'
import { NoClanView } from './NoClanView'
import { InClanView } from './InClanView'
import { useModalLock } from '../../utils/modalLock'

export function StarUnionsModal({ onClose }: { onClose: () => void }) {
  useModalLock()
  const snapshot = useClanStore((s) => s.snapshot)
  const setSnapshot = useClanStore((s) => s.setSnapshot)
  const setCooldown = useClanStore((s) => s.setCooldown)
  const [closing, setClosing] = useState(false)
  // 2026-05-28: показываем loading пока first fetchClanMe не вернулся —
  // иначе на первом открытии в сессии (snapshot=null) мелькает NoClanView
  // даже у тех кто в клане. Если snapshot уже есть из прошлого открытия,
  // сразу считаем готово.
  const [initialFetchDone, setInitialFetchDone] = useState(snapshot !== null)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 280)
  }, [closing, onClose])

  useEffect(() => {
    fetchClanMe()
      .then((r) => {
        if (r.clan) {
          setSnapshot({
            clan: r.clan,
            me: r.me!,
            members: r.members!,
            messages: r.messages!,
            requests: r.requests!,
            pin: r.pin ?? null,
          } as ClanSnapshot)
        } else {
          setSnapshot(null)
        }
        setCooldown(r.cooldownUntil)
      })
      .catch(console.error)
      .finally(() => setInitialFetchDone(true))
  }, [setSnapshot, setCooldown])

  useClanPolling(!!snapshot)

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        pointerEvents: 'auto',
        background: 'transparent',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad))',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 151,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div
          className={`ff-panel ${closing ? 'ff-slide-up' : 'ff-slide-down'}`}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-1.5 px-3 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
          >
            <span
              className="ff-display flex-1"
              style={{ fontSize: 20, color: '#2f4a1f' }}
            >
              🤝 Звёздные союзы
            </span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Закрыть"
              className="ff-tile w-10 h-10 text-xl flex-shrink-0"
              style={{
                ['--ff-tile-from' as never]: '#fca5a5',
                ['--ff-tile-to' as never]: '#dc2626',
                ['--ff-tile-border' as never]: '#7f1d1d',
                color: '#fff',
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden ff-no-scrollbar px-4 py-3"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
            }}
          >
            {!initialFetchDone ? (
              <div
                className="flex items-center justify-center"
                style={{ minHeight: 200, color: '#7a5a2f' }}
              >
                <span className="ff-body text-sm">Подключение…</span>
              </div>
            ) : snapshot ? (
              <InClanView />
            ) : (
              <NoClanView />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
