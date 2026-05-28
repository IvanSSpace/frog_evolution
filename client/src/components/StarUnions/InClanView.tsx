import { useState, useEffect, useRef } from 'react'
import { useClanStore } from '../../store/clan/slice'
import { useGameStore } from '../../store/gameStore'
import { sendMessage } from '../../api/clan'
import type { ClanMessageDto, ClanRequestDto } from '../../api/clan'
import { ClanHeader } from './ClanHeader'
import { ClanPinBlock } from './ClanPinBlock'
import { ChatMessage } from './ChatMessage'
import { ClanRequestBlock } from './ClanRequestBlock'
import { ClanRosterModal } from './ClanRosterModal'
import { CreateRequestDialog } from './CreateRequestDialog'
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
  const [donateReq, setDonateReq] = useState<ClanRequestDto | null>(null)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
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

      {snapshot.pin && <ClanPinBlock pin={snapshot.pin} />}

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

      <div
        className="flex-shrink-0 flex items-center gap-1.5 px-2 py-2 border-t border-white/10"
        style={{ background: 'rgba(0,0,0,0.2)' }}
      >
        <button
          onClick={() => setCreateRequestOpen(true)}
          className="flex-shrink-0 text-base px-2 py-1.5 rounded"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          title="Обмен"
        >
          📦
        </button>
        <button
          onClick={() => alert('P6')}
          className="flex-shrink-0 text-base px-2 py-1.5 rounded"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          title="Маршрут"
        >
          🗺️
        </button>
        <button
          onClick={() => inputRef.current?.focus()}
          className="flex-shrink-0 text-base px-2 py-1.5 rounded"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          title="Написать"
        >
          💬
        </button>
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Сообщение..."
          className="flex-1 rounded px-2 py-1.5 text-sm bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-white/40"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || sending}
          className="flex-shrink-0 px-3 py-1.5 rounded text-sm font-semibold transition-opacity"
          style={{
            background: 'rgba(99,102,241,0.5)',
            color: '#e0e7ff',
            opacity: !inputText.trim() || sending ? 0.4 : 1,
          }}
        >
          &gt;
        </button>
      </div>

      {rosterOpen && <ClanRosterModal onClose={() => setRosterOpen(false)} />}

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
