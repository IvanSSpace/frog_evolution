import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useClanStore } from '../../store/clan/slice'
import { useClanPolling } from '../../hooks/useClanPolling'
import { NoClanView } from './NoClanView'
import { InClanView } from './InClanView'
import { ClanHeader } from './ClanHeader'
import { ClanRosterModal } from './ClanRosterModal'
import { useModalLock } from '../../utils/modalLock'

export function StarUnionsModal({ onClose }: { onClose: () => void }) {
  useModalLock()
  const snapshot = useClanStore((s) => s.snapshot)
  const fetchClanMeAction = useClanStore((s) => s.fetchClanMe)
  const [closing, setClosing] = useState(false)
  // Показываем loading только если store пустой (preload ещё не успел).
  // Если snapshot уже есть — рендерим сразу, refresh идёт в фоне без блокировки UI.
  const [initialFetchDone, setInitialFetchDone] = useState(snapshot !== null)
  const [rosterOpen, setRosterOpen] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 280)
  }, [closing, onClose])

  useEffect(() => {
    fetchClanMeAction()
      .catch(console.error)
      .finally(() => setInitialFetchDone(true))
  }, [fetchClanMeAction])

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
          className={`ff-panel ff-panel--no-edge ff-scanlines ${closing ? 'ff-slide-up' : 'ff-slide-down'}`}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
          }}
        >
          {/* Header: блок клана на месте бывшего заголовка «Звёздные союзы».
              Заголовок убран по запросу. */}
          <div
            className="flex items-center gap-2 px-3 pt-3 pb-2 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(95,216,58,0.18)' }}
          >
            {snapshot?.clan ? (
              <div className="flex-1 min-w-0">
                <ClanHeader
                  clan={snapshot.clan}
                  memberCount={snapshot.members.length}
                  onOpenRoster={() => setRosterOpen(true)}
                />
              </div>
            ) : (
              <div className="flex-1" />
            )}
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

          {rosterOpen && snapshot && (
            <ClanRosterModal onClose={() => setRosterOpen(false)} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
