import { useEffect, useState } from 'react'

// Lock orientation в portrait. На iOS Safari/TG WebView программный lock через
// Screen Orientation API не работает — поэтому overlay-fallback обязателен.
// При landscape показываем экран «поверните устройство» поверх всего.

function isLandscape(): boolean {
  if (typeof window === 'undefined') return false
  // matchMedia надёжнее чем window.innerWidth/innerHeight в TG WebView
  return window.matchMedia('(orientation: landscape)').matches
}

export function OrientationLock() {
  const [landscape, setLandscape] = useState(isLandscape)

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    const handler = (e: MediaQueryListEvent) => setLandscape(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  if (!landscape) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0a1a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        padding: '32px',
        color: '#e5f5e5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
      }}
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 64 64"
        fill="none"
        style={{
          animation: 'rotate-phone 2s ease-in-out infinite',
          transformOrigin: '50% 50%',
        }}
      >
        <rect
          x="18"
          y="6"
          width="28"
          height="52"
          rx="5"
          stroke="#7ed957"
          strokeWidth="3"
          fill="#1a2e1a"
        />
        <circle cx="32" cy="52" r="2" fill="#7ed957" />
        <rect x="28" y="10" width="8" height="2" rx="1" fill="#7ed957" />
        {/* curved arrow — направление поворота */}
        <path
          d="M 8 32 A 24 24 0 0 1 32 8"
          stroke="#7ed957"
          strokeWidth="2"
          fill="none"
          strokeDasharray="3 2"
        />
        <path d="M 8 32 L 6 28 M 8 32 L 12 30" stroke="#7ed957" strokeWidth="2" />
      </svg>

      <div style={{ fontSize: '20px', fontWeight: 600 }}>
        Поверните устройство
      </div>
      <div style={{ fontSize: '14px', opacity: 0.7, maxWidth: '280px' }}>
        Игра работает только в вертикальной ориентации
      </div>

      <style>{`
        @keyframes rotate-phone {
          0%   { transform: rotate(-90deg); }
          50%  { transform: rotate(-90deg); }
          70%  { transform: rotate(0deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  )
}
