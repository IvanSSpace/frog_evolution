// SurvivorMissionSelect — выбор миссии перед стартом VS-арены.
//
// ShipDeck «⚔️ На миссию» эмитит 'survivor:choose-mission' { crew, shipId }.
// Здесь игрок выбирает миссию → 'survivor:start' { crew, shipId, missionId } →
// game/index.ts бутит SurvivorScene. Отмена → закрываем, остаёмся в ShipDeck.
//
// DOM-оверлей поверх канваса, useModalLock (условный монтаж) — иначе Phaser
// canvas перехватывает тапы.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { eventBus } from '../../store/eventBus'
import { hapticImpact, hapticSelection } from '../../utils/telegram'
import { setPhaserInputEnabled } from '../../game'
import { SURVIVOR_MISSIONS } from '../../game/scenes/survivor/missions'

type Ctx = { crew: number[]; shipId: number }

export function SurvivorMissionSelect() {
  const [ctx, setCtx] = useState<Ctx | null>(null)

  useEffect(() => {
    const onChoose = (p: Ctx) => setCtx(p)
    const onExit = () => setCtx(null)
    eventBus.on('survivor:choose-mission', onChoose)
    eventBus.on('survivor:start', onExit)
    eventBus.on('shipdeck:cancel', onExit)
    return () => {
      eventBus.off('survivor:choose-mission', onChoose)
      eventBus.off('survivor:start', onExit)
      eventBus.off('shipdeck:cancel', onExit)
    }
  }, [])

  if (!ctx) return null
  return <MissionOverlay ctx={ctx} onClose={() => setCtx(null)} />
}

function MissionOverlay({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  // Прямой toggle canvas-input на mount/unmount (без глобального modalLock).
  useEffect(() => {
    setPhaserInputEnabled(false)
    return () => setPhaserInputEnabled(true)
  }, [])

  const launch = (missionId: string) => {
    hapticImpact('medium')
    eventBus.emit('survivor:start', {
      crew: ctx.crew,
      shipId: ctx.shipId,
      missionId,
    })
    onClose()
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(4,8,12,0.78)',
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
          fontSize: 22,
          color: '#ffe27a',
          textShadow: '0 2px 0 #0b1b0e',
          textAlign: 'center',
        }}
      >
        ⚔️ Выбери миссию
      </div>
      <div
        className="ff-body"
        style={{ color: '#cbe0a0', fontSize: 12, marginTop: -6 }}
      >
        Отряд: {ctx.crew.length} 🐸
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: '100%',
          maxWidth: 400,
          marginTop: 6,
          maxHeight: '62vh',
          overflowY: 'auto',
          padding: '2px 2px',
        }}
      >
        {SURVIVOR_MISSIONS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => launch(m.id)}
            className="ff-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              textAlign: 'left',
              width: '100%',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 34, flexShrink: 0 }}>{m.icon}</span>
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
                {m.name}
              </span>
              <span
                className="ff-body"
                style={{ display: 'block', fontSize: 12, color: '#3a5214' }}
              >
                {m.desc}
              </span>
              <span
                className="ff-body"
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: '#5a7a2a',
                  marginTop: 2,
                }}
              >
                Враги ×{m.enemyMult} · босс {Math.round(m.bossTimeMs / 1000)}с ·
                награда ×{m.rewardMult}
              </span>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="ff-btn ff-btn-grey"
        style={{ padding: '10px 24px', marginTop: 4 }}
        onClick={() => {
          hapticSelection()
          onClose()
        }}
      >
        Отмена
      </button>
    </div>,
    document.body,
  )
}
