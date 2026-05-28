import { useState, useEffect, useRef } from 'react'
import { useClanStore } from '../../store/clan/slice'
import { useGameStore } from '../../store/gameStore'
import { sendMessage, deletePin } from '../../api/clan'
import type { ClanMessageDto, ClanRequestDto, ClanPinDto } from '../../api/clan'
import { ClanHeader } from './ClanHeader'
import { ClanPinBlock } from './ClanPinBlock'
import { ChatMessage } from './ChatMessage'
import { ClanRequestBlock } from './ClanRequestBlock'
import { ClanRosterModal } from './ClanRosterModal'
import { CreateRequestDialog } from './CreateRequestDialog'
import { CreatePinDialog } from './CreatePinDialog'
import { DonateDialog } from './DonateDialog'

type ChatItem =
  | { kind: 'message'; data: ClanMessageDto; createdAt: string }
  | { kind: 'request'; data: ClanRequestDto; createdAt: string }

export function InClanView() {
  const snapshot = useClanStore((s) => s.snapshot)
  const setSnapshot = useClanStore((s) => s.setSnapshot)
  const currentUserDbId = useGameStore((s) => s.currentUserDbId)

  const [rosterOpen, setRosterOpen] = useState(false)
  const [createRequestOpen, setCreateRequestOpen] = useState(false)
  const [createPinOpen, setCreatePinOpen] = useState(false)
  const [donateReq, setDonateReq] = useState<ClanRequestDto | null>(null)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const items: ChatItem[] = []
  if (snapshot) {
    for (const m of snapshot.messages) {
      items.push({ kind: 'message', data: m, createdAt: m.createdAt })
    }
    for (const r of snapshot.requests) {
      items.push({ kind: 'request', data: r, createdAt: r.createdAt })
    }
    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [items.length])

  async function handleSend() {
    if (!snapshot || !inputText.trim() || sending) return
    const text = inputText.trim()
    setSending(true)
    try {
      const newMsg = await sendMessage(snapshot.clan.id, text)
      setInputText('')
      setSnapshot({
        ...snapshot,
        messages: [...snapshot.messages, newMsg],
      })
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!snapshot) return null

  return (
    <div className="flex flex-col" style={{ height: '100%', minHeight: 0 }}>
      <ClanHeader
        clan={snapshot.clan}
        memberCount={snapshot.members.length}
        onOpenRoster={() => setRosterOpen(true)}
      />

      {snapshot.pin && (
        <ClanPinBlock
          pin={snapshot.pin}
          canDelete={snapshot.me.role === 'LEADER' || snapshot.me.role === 'COLEADER'}
          onDelete={async () => {
            await deletePin(snapshot.clan.id)
            setSnapshot({ ...snapshot, pin: null })
          }}
        />
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2" style={{ minHeight: 0 }}>
        {items.map((item) =>
          item.kind === 'message' ? (
            <ChatMessage
              key={`msg-${item.data.id}`}
              msg={item.data}
              mine={item.data.userId === currentUserDbId}
            />
          ) : (
            <ClanRequestBlock
              key={`req-${item.data.id}`}
              req={item.data}
              canDonate={true}
              onDonateClick={(r) => setDonateReq(r)}
            />
          ),
        )}
        <div ref={chatEndRef} />
      </div>

      {chatOpen && (
        <div
          className="flex-shrink-0 flex items-center gap-1.5 px-2 py-2"
          style={{ borderTop: '1px solid rgba(77,107,31,0.3)', background: 'rgba(0,0,0,0.05)' }}
        >
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение..."
            className="flex-1 rounded px-2 py-1.5 text-sm focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)', color: '#1f2937' }}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className="flex-shrink-0 px-3 py-1.5 rounded text-sm font-semibold transition-opacity"
            style={{
              background: '#16a34a',
              color: '#fff',
              opacity: !inputText.trim() || sending ? 0.4 : 1,
            }}
          >
            Отправить
          </button>
          <button
            onClick={() => setChatOpen(false)}
            className="flex-shrink-0 px-2 py-1.5 rounded text-sm"
            style={{ background: 'rgba(0,0,0,0.08)' }}
          >
            ✕
          </button>
        </div>
      )}

      <div
        className="flex-shrink-0 flex items-center gap-1.5 px-2 py-2"
        style={{ borderTop: '1px solid rgba(77,107,31,0.3)', background: 'rgba(0,0,0,0.05)' }}
      >
        <button
          onClick={() => setChatOpen((v) => !v)}
          title="Чат"
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: 12,
            border: '2px solid #6e8a3a',
            background: 'linear-gradient(180deg, #d6e6b8, #b8d090)',
            boxShadow: '0 2px 0 #6e8a3a',
            fontSize: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          💬
        </button>
        <button
          onClick={() => setCreateRequestOpen(true)}
          className="flex-shrink-0 text-base px-2 py-1.5 rounded"
          style={{ background: 'rgba(0,0,0,0.08)' }}
          title="Обмен"
        >
          📦
        </button>
        <button
          onClick={() => setCreatePinOpen(true)}
          disabled={snapshot.me.role !== 'LEADER' && snapshot.me.role !== 'COLEADER'}
          className="flex-shrink-0 text-base px-2 py-1.5 rounded transition-opacity"
          style={{
            background: 'rgba(0,0,0,0.08)',
            opacity: snapshot.me.role !== 'LEADER' && snapshot.me.role !== 'COLEADER' ? 0.35 : 1,
          }}
          title={
            snapshot.me.role === 'LEADER' || snapshot.me.role === 'COLEADER'
              ? 'Маршрут'
              : 'Только лидер/со-лидер могут закрепить маршрут'
          }
        >
          🗺️
        </button>
      </div>

      {rosterOpen && <ClanRosterModal onClose={() => setRosterOpen(false)} />}

      {createPinOpen && snapshot && (
        <CreatePinDialog
          clanId={snapshot.clan.id}
          existingPin={snapshot.pin}
          onClose={() => setCreatePinOpen(false)}
          onCreated={(pin: ClanPinDto) => {
            setSnapshot({ ...snapshot, pin })
            setCreatePinOpen(false)
          }}
        />
      )}

      {createRequestOpen && snapshot && (
        <CreateRequestDialog
          clanId={snapshot.clan.id}
          onClose={() => setCreateRequestOpen(false)}
          onCreated={(req) => {
            setSnapshot({ ...snapshot, requests: [...snapshot.requests, req] })
            setCreateRequestOpen(false)
          }}
        />
      )}

      {donateReq && snapshot && (
        <DonateDialog
          req={donateReq}
          onClose={() => setDonateReq(null)}
          onDonated={(upd) => {
            setSnapshot({
              ...snapshot,
              requests: snapshot.requests.map((r) => (r.id === upd.id ? upd : r)),
            })
            setDonateReq(null)
          }}
        />
      )}
    </div>
  )
}
