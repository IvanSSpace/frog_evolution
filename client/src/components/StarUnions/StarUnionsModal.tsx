import { useEffect } from 'react'
import { useClanStore } from '../../store/clan/slice'
import { useClanPolling } from '../../hooks/useClanPolling'
import { fetchClanMe } from '../../api/clan'
import type { ClanSnapshot } from '../../api/clan'
import { NoClanView } from './NoClanView'
import { InClanView } from './InClanView'

export function StarUnionsModal({ onClose }: { onClose: () => void }) {
  const snapshot = useClanStore((s) => s.snapshot)
  const setSnapshot = useClanStore((s) => s.setSnapshot)
  const setCooldown = useClanStore((s) => s.setCooldown)

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

  return (
    <div
      className="ff-backdrop ff-fade"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: '0 16px 4px',
      }}
    >
      <div
        className="ff-panel ff-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          height: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#E8F5D2',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.35)',
        }}
      >
        <div className="flex items-center justify-between p-3" style={{ borderBottom: '1px solid rgba(77,107,31,0.3)' }}>
          <div className="text-lg font-semibold" style={{ color: '#1f2937' }}>Звёздные союзы</div>
          <button onClick={onClose} style={{ color: '#4b5563' }}>
            ✕
          </button>
        </div>
        <div
          className="text-sm"
          style={snapshot
            ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', color: '#1f2937' }
            : { padding: '1rem', color: '#1f2937' }}
        >
          {snapshot ? <InClanView /> : <NoClanView />}
        </div>
      </div>
    </div>
  )
}
