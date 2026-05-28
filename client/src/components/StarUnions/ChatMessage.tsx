import type { ClanMessageDto } from '../../api/clan'

interface Props {
  msg: ClanMessageDto
  mine: boolean
}

export function ChatMessage({ msg, mine }: Props) {
  if (mine) {
    return (
      <div className="flex justify-end mb-2">
        <div
          className="max-w-[70%] rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(255,255,255,0.95)', color: '#1e1b2e' }}
        >
          <div className="text-xs font-semibold mb-0.5" style={{ color: '#6b7280' }}>Ты</div>
          <div>{msg.text}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-2">
      <div
        className="max-w-[70%] rounded-lg px-3 py-2 text-sm"
        style={{ background: 'rgba(59,130,246,0.15)', color: '#1e3a5f' }}
      >
        <div className="text-xs font-semibold mb-0.5" style={{ color: '#1d4ed8' }}>
          {msg.username ?? `User#${msg.userId}`}
        </div>
        <div>{msg.text}</div>
      </div>
    </div>
  )
}
