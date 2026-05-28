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
          className="ff-card max-w-[70%] px-3 py-2 text-sm"
          style={{
            background: 'linear-gradient(180deg, #fef9c3 0%, #fde68a 100%)',
            borderColor: '#b45309',
          }}
        >
          <div className="text-xs font-semibold mb-0.5" style={{ color: '#7a5a2f' }}>Ты</div>
          <div style={{ color: '#2f1f0e' }}>{msg.text}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-2">
      <div className="ff-card max-w-[70%] px-3 py-2 text-sm">
        <div className="text-xs font-semibold mb-0.5" style={{ color: '#7a5a2f' }}>
          {msg.username ?? `User#${msg.userId}`}
        </div>
        <div style={{ color: '#2f1f0e' }}>{msg.text}</div>
      </div>
    </div>
  )
}
