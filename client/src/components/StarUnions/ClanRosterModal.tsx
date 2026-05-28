import { useClanStore } from '../../store/clan/slice'
import { kickMember, promoteMember, demoteMember, transferLeader, leaveClan, fetchClanMe } from '../../api/clan'
import type { ClanRole, ClanMemberDto } from '../../api/clan'

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

  return (
    <div
      className="ff-backdrop ff-fade"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.35)',
      }}
    >
      <div
        className="ff-panel ff-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#E8F5D2',
          borderRadius: 14,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center justify-between p-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(77,107,31,0.3)' }}>
          <div className="font-semibold" style={{ color: '#1f2937' }}>Участники союза</div>
          <button onClick={onClose} style={{ color: '#4b5563' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sorted.map((member) => {
            const name = member.username ?? `User#${member.userId}`
            const days = daysSince(member.joinedAt)
            return (
              <div
                key={member.userId}
                className="flex items-center gap-2 px-2 py-2 rounded-lg mb-1"
                style={{ background: 'rgba(0,0,0,0.05)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: '#1f2937' }}>{name}</div>
                  <div className="text-xs" style={{ color: '#6b7280' }}>{ROLE_BADGE[member.role]} · {days} дн. с нами</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {myRole === 'LEADER' && member.role === 'MEMBER' && (
                    <button
                      onClick={() => handlePromote(member)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: 'rgba(99,102,241,0.2)', color: '#4338ca' }}
                    >
                      ↑
                    </button>
                  )}
                  {myRole === 'LEADER' && member.role === 'COLEADER' && (
                    <>
                      <button
                        onClick={() => handleDemote(member)}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: 'rgba(245,158,11,0.2)', color: '#92400e' }}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleTransfer(member)}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: 'rgba(168,85,247,0.2)', color: '#6b21a8' }}
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
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: 'rgba(239,68,68,0.2)', color: '#b91c1c' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(77,107,31,0.3)' }}>
          <button
            onClick={handleLeave}
            className="w-full py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            🚪 Покинуть союз
          </button>
          {myRole === 'LEADER' && (
            <div className="text-xs text-center mt-1" style={{ color: '#6b7280' }}>
              Лидерство автоматически передастся старшему
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
