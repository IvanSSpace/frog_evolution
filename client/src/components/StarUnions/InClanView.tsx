import { useState, useEffect, useRef } from 'react'
import { useClanStore } from '../../store/clan/slice'
import { useGameStore } from '../../store/gameStore'
import { sendMessage, deletePin } from '../../api/clan'
import type { ClanMessageDto, ClanRequestDto, ClanPinDto } from '../../api/clan'
import { ClanPinBlock } from './ClanPinBlock'
import { ChatMessage } from './ChatMessage'
import { ClanRequestBlock } from './ClanRequestBlock'
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
  const currentUsername = useGameStore((s) => s.username)

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
      // 2026-05-28: передача слизи временно выключена — пропускаем SLIME-запросы.
      // Серверная генерация остаётся, но в UI клана они не показываются.
      if (r.type === 'SLIME') continue
      items.push({ kind: 'request', data: r, createdAt: r.createdAt })
    }
    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [items.length])

  // Фокус на инпут БЕЗ авто-скролла контейнера: дефолтный autoFocus заставлял
  // браузер скроллить модалку к инпуту при открытии клавиатуры → хедер уезжал
  // и ломался. preventScroll держит хедер на месте.
  useEffect(() => {
    if (chatOpen) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [chatOpen])

  async function handleSend() {
    if (!snapshot || !inputText.trim() || sending) return
    const text = inputText.trim()
    const tempId = -Date.now()
    const clientId = `c-${tempId}-${Math.floor(Math.random() * 1e6)}`
    const optimistic: ClanMessageDto = {
      id: tempId,
      clientId,
      userId: currentUserDbId ?? -1,
      username: currentUsername,
      text,
      createdAt: new Date().toISOString(),
    }
    setInputText('')
    setSnapshot({ ...snapshot, messages: [...snapshot.messages, optimistic] })
    setSending(true)
    try {
      const newMsg = await sendMessage(snapshot.clan.id, text)
      const cur = useClanStore.getState().snapshot
      if (cur) {
        const without = cur.messages.filter((m) => m.id !== tempId && m.id !== newMsg.id)
        setSnapshot({ ...cur, messages: [...without, { ...newMsg, clientId }] })
      }
    } catch (e) {
      console.error(e)
      const cur = useClanStore.getState().snapshot
      if (cur) {
        setSnapshot({ ...cur, messages: cur.messages.filter((m) => m.id !== tempId) })
      }
      setInputText(text)
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

  const canPin = snapshot.me.role === 'LEADER' || snapshot.me.role === 'COLEADER'

  return (
    <div className="flex flex-col" style={{ height: '100%', minHeight: 0 }}>
      {snapshot.pin && (
        <ClanPinBlock
          pin={snapshot.pin}
          canDelete={canPin}
          onDelete={async () => {
            await deletePin(snapshot.clan.id)
            setSnapshot({ ...snapshot, pin: null })
          }}
        />
      )}

      {/* Chat scroll. 2026-05-28: scanlines теперь на всей панели союза (.ff-panel). */}
      <div
        className="flex-1 overflow-y-auto ff-no-scrollbar px-2 py-2"
        style={{ minHeight: 0, WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        onClick={() => { if (chatOpen) setChatOpen(false) }}
      >
        {items.map((item) =>
          item.kind === 'message' ? (
            <ChatMessage
              key={`msg-${item.data.clientId ?? item.data.id}`}
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

      {/* Chat input sheet — pinned full-width above the bottom bar */}
      {chatOpen && (
        <div
          className="ff-card flex-shrink-0 flex items-center gap-2"
          style={{
            margin: '0 -16px',
            marginBottom: 'calc(var(--kb-inset, 0px) - 12px)',
            borderRadius: 0,
            padding: '8px 16px',
            gap: 8,
            borderTop: '1px solid rgba(95,216,58,0.18)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение..."
            className="flex-1 text-sm focus:outline-none"
            style={{
              border: '2px solid #8b6914',
              background: 'rgba(255,253,230,0.9)',
              borderRadius: 999,
              padding: '6px 12px',
              color: '#2f1f0e',
            }}
          />
          <button
            onClick={() => {
              handleSend()
              setChatOpen(false)
            }}
            aria-label="Отправить"
            className="ff-btn ff-btn-green flex-shrink-0 flex items-center justify-center"
            style={{ width: 40, height: 40, fontSize: 20, padding: 0 }}
          >
            ✓
          </button>
        </div>
      )}

      {/* Bottom action bar — скрыта пока открыт ввод сообщения, чтобы compose-блок
          был прибит прямо к клавиатуре (без зазора в виде панели кнопок). */}
      {!chatOpen && (
      <div
        className="flex-shrink-0 flex items-center gap-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(77,107,31,0.4)', padding: '10px 14px' }}
      >
        <button
          onClick={() => setChatOpen((v) => !v)}
          title="Чат"
          className="ff-tile"
          style={{
            width: 44,
            height: 44,
            fontSize: 22,
            flexShrink: 0,
            ['--ff-tile-from' as never]: '#a7f3d0',
            ['--ff-tile-to' as never]: '#34d399',
            ['--ff-tile-border' as never]: '#065f46',
          }}
        >
          💬
        </button>
        <button
          onClick={() => setCreateRequestOpen(true)}
          title="Обмен"
          className="ff-tile"
          style={{
            width: 44,
            height: 44,
            fontSize: 22,
            flexShrink: 0,
            ['--ff-tile-from' as never]: '#c4b5fd',
            ['--ff-tile-to' as never]: '#7c3aed',
            ['--ff-tile-border' as never]: '#3b0764',
          }}
        >
          📦
        </button>
        <button
          onClick={() => setCreatePinOpen(true)}
          disabled={!canPin}
          title={canPin ? 'Маршрут' : 'Только лидер/со-лидер могут закрепить маршрут'}
          className="ff-tile"
          style={{
            width: 44,
            height: 44,
            fontSize: 22,
            flexShrink: 0,
            opacity: canPin ? 1 : 0.35,
            ['--ff-tile-from' as never]: '#fcd34d',
            ['--ff-tile-to' as never]: '#d97706',
            ['--ff-tile-border' as never]: '#78350f',
          }}
        >
          🗺️
        </button>
      </div>
      )}

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
          onCreated={(reqs) => {
            setSnapshot({ ...snapshot, requests: [...snapshot.requests, ...reqs] })
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
