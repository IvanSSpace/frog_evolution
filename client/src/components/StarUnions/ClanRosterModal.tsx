import { createPortal } from 'react-dom'
import { useClanStore } from '../../store/clan/slice'
import { kickMember, promoteMember, demoteMember, transferLeader, leaveClan, fetchClanMe } from '../../api/clan'
import type { ClanRole, ClanMemberDto } from '../../api/clan'
import { useModalLock } from '../../utils/modalLock'

interface Props {
  onClose: () => void
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.floor(ms / 86400000)
}

const ROLE_BADGE: Record<ClanRole, string> = {
  LEADER: '👑 Лидер',
  COLEADER: '⭐ Со-лидер',
  MEMBER: '• Участник',
}

export function ClanRosterModal({ onClose }: Props) {
  useModalLock()
  const snapshot = useClanStore((s) => s.snapshot)
  const setSnapshot = useClanStore((s) => s.setSnapshot)
  const setCooldown = useClanStore((s) => s.setCooldown)
  if (!snapshot) return null

  const myRole = snapshot.me.role
  const clanId = snapshot.clan.id

  async function refreshSnapshot() {
    try {
      const r = await fetchClanMe()
      if (r.clan) {
        setSnapshot({
          clan: r.clan,
          me: r.me!,
          members: r.members!,
          messages: r.messages!,
          requests: r.requests!,
          pin: r.pin ?? null,
        })
      } else {
        setSnapshot(null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  async function handleKick(member: ClanMemberDto) {
    if (!window.confirm(`Исключить ${member.username ?? `User#${member.userId}`}?`)) return
    try {
      await kickMember(clanId, member.userId)
      await refreshSnapshot()
    } catch (e) {
      alert(String(e))
    }
  }

  async function handlePromote(member: ClanMemberDto) {
    if (!window.confirm(`Повысить ${member.username ?? `User#${member.userId}`} до Со-лидера?`)) return
    try {
      await promoteMember(clanId, member.userId)
      await refreshSnapshot()
    } catch (e) {
      alert(String(e))
    }
  }

  async function handleDemote(member: ClanMemberDto) {
    if (!window.confirm(`Понизить ${member.username ?? `User#${member.userId}`} до Участника?`)) return
    try {
      await demoteMember(clanId, member.userId)
      await refreshSnapshot()
    } catch (e) {
      alert(String(e))
    }
  }

  async function handleTransfer(member: ClanMemberDto) {
    if (!window.confirm(`Передать лидерство ${member.username ?? `User#${member.userId}`}?`)) return
    try {
      await transferLeader(clanId, member.userId)
      await refreshSnapshot()
    } catch (e) {
      alert(String(e))
    }
  }

  async function handleLeave() {
    const msg = myRole === 'LEADER'
      ? 'Покинуть союз? Лидерство автоматически передастся старшему участнику.'
      : 'Покинуть союз?'
    if (!window.confirm(msg)) return
    try {
      const r = await leaveClan()
      setSnapshot(null)
      setCooldown(r.cooldownUntil)
      onClose()
    } catch (e) {
      alert(String(e))
    }
  }

  const sorted = [...snapshot.members].sort((a, b) => {
    const order: Record<ClanRole, number> = { LEADER: 0, COLEADER: 1, MEMBER: 2 }
    return order[a.role] - order[b.role]
  })

  return createPortal(
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: '0 16px 4px',
      }}
    >
        <div
          className="ff-panel ff-pop"
          style={{
            width: '100%',
            maxWidth: 380,
            height: '75vh',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center gap-1.5 px-3 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
          >
            <span className="ff-display flex-1" style={{ fontSize: 20, color: '#e6ffd0' }}>
              Участники союза
            </span>
            <button
              type="button"
              onClick={onClose}
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

          {/* Members list */}
          <div
            className="flex-1 min-h-0 overflow-y-auto ff-no-scrollbar px-4 py-3"
            style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
          >
            <div className="flex flex-col gap-2">
              {sorted.map((member) => {
                const name = member.username ?? `User#${member.userId}`
                const days = daysSince(member.joinedAt)
                return (
                  <div key={member.userId} className="ff-card flex items-center gap-2" style={{ padding: '10px 12px' }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm ff-display truncate" style={{ color: 'var(--ff-text-light)' }}>{name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--ff-text-dim)' }}>{ROLE_BADGE[member.role]} · {days} дн. с нами</div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {myRole === 'LEADER' && member.role === 'MEMBER' && (
                        <button
                          onClick={() => handlePromote(member)}
                          className="ff-btn ff-btn-purple text-xs py-1 px-2"
                        >
                          ↑
                        </button>
                      )}
                      {myRole === 'LEADER' && member.role === 'COLEADER' && (
                        <>
                          <button
                            onClick={() => handleDemote(member)}
                            className="ff-btn ff-btn-amber text-xs py-1 px-2"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => handleTransfer(member)}
                            className="ff-btn ff-btn-yellow text-xs py-1 px-2"
                          >
                            👑
                          </button>
                        </>
                      )}
                      {(
                        (myRole === 'LEADER' && member.role !== 'LEADER') ||
                        (myRole === 'COLEADER' && member.role === 'MEMBER')
                      ) && (
                        <button
                          onClick={() => handleKick(member)}
                          className="ff-btn ff-btn-red text-xs py-1 px-2"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer — leave button */}
          <div
            className="flex-shrink-0 px-4 py-3"
            style={{ borderTop: '3px dashed rgba(77,107,31,0.4)' }}
          >
            <button
              onClick={handleLeave}
              className="ff-btn ff-btn-red w-full py-2 text-sm"
            >
              🚪 Покинуть союз
            </button>
            {myRole === 'LEADER' && (
              <div className="text-xs text-center mt-1" style={{ color: 'var(--ff-text-dim)' }}>
                Лидерство автоматически передастся старшему
              </div>
            )}
          </div>
        </div>
    </div>,
    document.body,
  )
}
