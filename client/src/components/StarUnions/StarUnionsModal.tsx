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
          className={closing ? 'ff-slide-up' : 'ff-slide-down'}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, #f5fbe9 0%, #d9eeb6 100%)',
            border: '4px solid #4d6b1f',
            borderRadius: 0,
            boxShadow: '0 0 0 3px #f7ffe0 inset',
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
            {snapshot ? <InClanView /> : <NoClanView />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
