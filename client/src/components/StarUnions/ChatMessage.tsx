import type { ClanMessageDto } from '../../api/clan'

interface Props {
  msg: ClanMessageDto
  mine: boolean
}

// 2026-05-28: dark theme. Свой пузырь — явно зеленее (gradient 28%→14%
// + green border 55%), чужой — нейтральный через .ff-card. Разница
// видна мгновенно. word-break + overflow-wrap anywhere — длинные слова
// рвутся внутри пузыря, не вылезают наружу.
const BUBBLE_TEXT_STYLE = {
  color: 'var(--ff-text-light)',
  wordBreak: 'break-word' as const,
  overflowWrap: 'anywhere' as const,
  whiteSpace: 'pre-wrap' as const,
}

export function ChatMessage({ msg, mine }: Props) {
  if (mine) {
    return (
      <div className="ff-msg-in flex justify-end mb-2">
        <div
          className="max-w-[75%] px-3 py-2 text-sm"
          style={{
            background:
              'linear-gradient(180deg, rgba(95,216,58,0.28) 0%, rgba(95,216,58,0.14) 100%)',
            border: '1px solid rgba(95,216,58,0.55)',
            borderRadius: 12,
            boxShadow: '0 2px 0 rgba(0,0,0,0.25)',
          }}
        >
          <div
            className="text-xs font-semibold mb-0.5"
            style={{ color: 'var(--ff-text-dim)' }}
          >
            Ты
          </div>
          <div style={BUBBLE_TEXT_STYLE}>{msg.text}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="ff-msg-in flex justify-start mb-2">
      <div className="ff-card max-w-[75%] px-3 py-2 text-sm">
        <div
          className="text-xs font-semibold mb-0.5"
          style={{ color: 'var(--ff-text-dim)' }}
        >
          {msg.username ?? `User#${msg.userId}`}
        </div>
        <div style={BUBBLE_TEXT_STYLE}>{msg.text}</div>
      </div>
    </div>
  )
}
