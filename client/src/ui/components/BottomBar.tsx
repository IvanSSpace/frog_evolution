import React from 'react'

type BadgeProps = { children: React.ReactNode }

function NotifBadge({ children }: BadgeProps) {
  return (
    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-white text-[10px] font-bold leading-none">
      {children}
    </span>
  )
}

type BtnProps = {
  emoji: string
  bg: string
  border?: string
  size?: 'md' | 'lg'
  badge?: boolean
}

function Btn({ emoji, bg, border, size = 'md', badge = false }: BtnProps) {
  const dim = size === 'lg' ? 'w-16 h-16 text-3xl rounded-2xl' : 'w-12 h-12 text-2xl rounded-xl'
  const borderCls = border ? `border-4 ${border}` : ''
  return (
    <button
      className={`relative flex-shrink-0 flex items-center justify-center ${dim} ${bg} ${borderCls} shadow-md active:scale-95 transition-transform`}
      style={{ pointerEvents: 'auto' }}
    >
      {emoji}
      {badge && <NotifBadge>!</NotifBadge>}
    </button>
  )
}

export function BottomBar() {
  return (
    <div className="w-full h-full flex items-center justify-between px-3 py-2" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}>
      {/* Left — current frog */}
      <Btn emoji="🐸" bg="bg-teal-100" border="border-teal-400" size="lg" />

      {/* Center — 4 action buttons */}
      <div className="flex gap-2 items-center">
        <Btn emoji="⬆️"  bg="bg-green-500"  />
        <Btn emoji="🎨"  bg="bg-purple-400" badge />
        <Btn emoji="🎁"  bg="bg-red-400"    badge />
        <Btn emoji="🛍️" bg="bg-emerald-400" />
      </div>

      {/* Right — journal */}
      <Btn emoji="📖" bg="bg-orange-100" border="border-orange-500" size="lg" badge />
    </div>
  )
}
