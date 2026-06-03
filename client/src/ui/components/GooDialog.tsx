// GooDialog — уютный онбординг-диалог с персонажем goo_collector (слева).
//
// Небольшой плавающий блок снизу (как подсказки-онбординг в играх): слева —
// персонаж в кружке (лёгкий боб), справа — заголовок + текст + кнопка «Понятно».
// Поп-ин снизу, мягкая палитра. Без тёмного бэкдропа (игра остаётся видна).
//
// Показ: eventBus 'goo:dialog' {text, title?}. Mounted один раз в App.tsx.
// Тест: window.__gooDialog(text?, title?) (см. gooDialogDevHelpers).

import { useEffect, useState } from 'react'
import { eventBus } from '../../store/eventBus'

interface DialogData {
  title?: string
  text: string
}

export function GooDialog() {
  const [data, setData] = useState<DialogData | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const handler = (d: DialogData) => {
      setClosing(false)
      setData(d)
    }
    eventBus.on('goo:dialog', handler)
    return () => eventBus.off('goo:dialog', handler)
  }, [])

  const close = () => {
    setClosing(true)
    window.setTimeout(() => setData(null), 200)
  }

  if (!data) return null

  return (
    <>
      <style>{`
        @keyframes goo-pop { 0%{transform:translateY(40px) scale(.92);opacity:0}
          100%{transform:translateY(0) scale(1);opacity:1} }
        @keyframes goo-out { 0%{transform:translateY(0) scale(1);opacity:1}
          100%{transform:translateY(30px) scale(.95);opacity:0} }
        @keyframes goo-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
          zIndex: 250,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          padding: '0 14px',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            width: 'min(94vw, 420px)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px 12px 12px',
            borderRadius: 22,
            border: '3px solid #6fae3e',
            background:
              'linear-gradient(135deg, #f3fbe6 0%, #e4f4cf 60%, #d8efbe 100%)',
            boxShadow: '0 10px 30px rgba(40,70,20,0.28)',
            position: 'relative',
            animation: closing
              ? 'goo-out 200ms ease-in forwards'
              : 'goo-pop 320ms cubic-bezier(.2,.85,.3,1)',
          }}
        >
          {/* Персонаж слева */}
          <div
            style={{
              width: 72,
              height: 72,
              flexShrink: 0,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 40% 35%, #ffffff, #cfe9a8 75%)',
              border: '2px solid #6fae3e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 -3px 8px rgba(80,120,40,0.25)',
            }}
          >
            <img
              src="/goo_collector.webp"
              alt=""
              draggable={false}
              style={{
                width: 56,
                height: 56,
                objectFit: 'contain',
                animation: 'goo-bob 2.4s ease-in-out infinite',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Текст справа */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {data.title && (
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#2f6b1f',
                  lineHeight: 1.2,
                  marginBottom: 2,
                }}
              >
                {data.title}
              </div>
            )}
            <div
              style={{
                fontSize: 13,
                color: '#3a5a26',
                lineHeight: 1.35,
              }}
            >
              {data.text}
            </div>
            <button
              type="button"
              onClick={close}
              style={{
                touchAction: 'manipulation',
                marginTop: 8,
                padding: '6px 16px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(#7cc24a, #4d8a26)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: '0 2px 0 #3a6a1c',
                cursor: 'pointer',
              }}
            >
              Понятно
            </button>
          </div>

          {/* ✕ */}
          <button
            type="button"
            onClick={close}
            aria-label="Закрыть"
            style={{
              touchAction: 'manipulation',
              position: 'absolute',
              top: 6,
              right: 8,
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(80,120,40,0.18)',
              color: '#3a5a26',
              fontSize: 13,
              lineHeight: '22px',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </>
  )
}
