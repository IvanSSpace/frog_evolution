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
    <div className="ff-backdrop ff-fade" onClick={onClose}>
      <div
        className="ff-panel ff-pop"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(560px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <div className="text-lg font-semibold">Звёздные союзы</div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            ✕
          </button>
        </div>
        <div
          className="text-sm text-white/80"
          style={snapshot ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : { padding: '1rem' }}
        >
          {snapshot ? <InClanView /> : <NoClanView />}
        </div>
      </div>
    </div>
  )
}
