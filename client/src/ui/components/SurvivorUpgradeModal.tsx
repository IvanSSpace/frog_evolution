// SurvivorUpgradeModal — выбор апгрейда на левелапе в VS-арене.
//
// DOM-оверлей ПОВЕРХ канваса (не внутри Phaser — там тапы по тексту не ловились),
// в стиле кнопок приложения. Сцена SurvivorScene на левелапе эмитит
// 'survivor:level-up' { level, choices } и замирает (paused). Игрок жмёт карту →
// 'survivor:pick-upgrade' { id } → сцена применяет апгрейд и продолжает.
//
// Самомонтируется в App (рендерит null пока нет события). Бэкдроп ловит тапы,
// чтобы они не проходили на канвас под модалкой.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { eventBus } from '../../store/eventBus'
import { hapticImpact } from '../../utils/telegram'
import { useModalLock } from '../../utils/modalLock'

type Choice = {
  id: string
  icon: string
  title: string
  desc: string
  kind: 'attack' | 'defense'
}

const KIND_META = {
  attack: { label: '⚔ Атака', accent: '#dc2626', glow: 'rgba(220,38,38,0.5)' },
  defense: {
    label: '🛡 Защита',
    accent: '#2563eb',
    glow: 'rgba(37,99,235,0.5)',
  },
} as const

export function SurvivorUpgradeModal() {
  const [data, setData] = useState<{ level: number; choices: Choice[] } | null>(
    null,
  )

  useEffect(() => {
    const onLevel = (p: { level: number; choices: Choice[] }) => setData(p)
    const onExit = () => setData(null)
    eventBus.on('survivor:level-up', onLevel)
    eventBus.on('survivor:exit', onExit)
    return () => {
      eventBus.off('survivor:level-up', onLevel)
      eventBus.off('survivor:exit', onExit)
    }
  }, [])

  // Глушит pointer-events у Phaser canvas пока модалка открыта — иначе canvas
  // перехватывает тапы и кнопки не кликаются (см. body.modal-open в modalLock).
  useModalLock(data !== null)

  if (!data) return null

  const pick = (id: string) => {
    hapticImpact('medium')
    setData(null)
    eventBus.emit('survivor:pick-upgrade', { id })
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(4,8,12,0.72)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 20,
        pointerEvents: 'auto',
      }}
    >
      <div
        className="ff-display"
        style={{
          fontSize: 24,
          color: '#ffe27a',
          textShadow: '0 2px 0 #0b1b0e',
          textAlign: 'center',
        }}
      >
        ⭐ Уровень {data.level}
      </div>
      <div
        className="ff-body"
        style={{ color: '#cbe0a0', fontSize: 13, marginTop: -6 }}
      >
        Выбери апгрейд
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: '100%',
          maxWidth: 380,
          marginTop: 6,
        }}
      >
        {data.choices.map((c) => {
          const meta = KIND_META[c.kind]
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              className="ff-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                textAlign: 'left',
                width: '100%',
                borderLeft: `6px solid ${meta.accent}`,
                boxShadow: `0 0 0 2px ${meta.glow}`,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 34, flexShrink: 0 }}>{c.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  className="ff-display"
                  style={{
                    display: 'block',
                    fontSize: 16,
                    color: '#1f3d12',
                    lineHeight: 1.15,
                  }}
                >
                  {c.title}
                </span>
                <span
                  className="ff-body"
                  style={{ display: 'block', fontSize: 12, color: '#3a5214' }}
                >
                  {c.desc}
                </span>
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#fff',
                  background: meta.accent,
                  borderRadius: 6,
                  padding: '3px 7px',
                  flexShrink: 0,
                }}
              >
                {meta.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
