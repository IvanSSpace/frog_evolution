// JourneyMissionSelect — выбор миссии-путешествия и отряда (React-оверлей).
//
// Открывается тайлом BottomBar (planet-миссии). Игрок выбирает миссию из списка
// planet-домена + собирает отряд из лягушек текущей локации, жмёт «В путь» →
// emit journey:start → JourneyScene (см. game/index.ts). ✕ закрывает без запуска.

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { useModalLock } from '../../utils/modalLock'
import { getFrogPath } from '../../game/config/frogs'
import {
  journeyMissionsByDomain,
  type JourneyMission,
} from '../../game/scenes/journey/missions'

type Props = { onClose: () => void }

const MAX_SQUAD = 12

export function JourneyMissionSelect({ onClose }: Props) {
  useModalLock()
  const currentLocation = useGameStore((s) => s.currentLocation)
  const locationFrogs = useGameStore((s) => s.locationFrogs)
  const frogTiers = useGameStore((s) => s.frogTiers)

  const missions = useMemo(() => journeyMissionsByDomain('planet'), [])
  const [missionId, setMissionId] = useState<string>(missions[0]?.id ?? '')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const mission: JourneyMission | undefined = missions.find(
    (m) => m.id === missionId,
  )
  const frogs = locationFrogs[currentLocation - 1] ?? []

  const minSquad = mission?.minSquad ?? 1
  const canLaunch = !!mission && selected.size >= minSquad

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else if (next.size < MAX_SQUAD) next.add(idx)
      return next
    })
  }

  const launch = () => {
    if (!canLaunch || !mission) return
    const crew = [...selected].map((i) => frogs[i])
    eventBus.emit('journey:start', { crew, missionId: mission.id })
    onClose()
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        pointerEvents: 'auto',
        background: 'rgba(10, 24, 8, 0.55)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad))',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#eaf7da',
          touchAction: 'manipulation',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
          <span className="font-bold text-[#1f3a17] text-base">
            🗺️ Миссии на планете
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ touchAction: 'manipulation' }}
            className="text-2xl leading-none text-[#d04545] font-bold px-2"
          >
            ✕
          </button>
        </div>

        {/* Список миссий */}
        <div className="px-3 flex flex-col gap-2 flex-shrink-0">
          {missions.map((m) => {
            const active = m.id === missionId
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMissionId(m.id)}
                style={{ touchAction: 'manipulation' }}
                className={`text-left rounded-xl px-3 py-2 border-2 transition-colors ${
                  active
                    ? 'border-[#3f8a2e] bg-[#d4eeb8]'
                    : 'border-transparent bg-[#dceecb]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1f3a17]">
                    {m.icon} {m.name}
                  </span>
                  <span className="text-sm text-[#2d6a1f] font-bold">
                    +{m.reward} 💧
                  </span>
                </div>
                <div className="text-xs text-[#4a6b3a] mt-0.5">{m.desc}</div>
                <div className="text-[11px] text-[#6b7d5c] mt-0.5">
                  Мин. отряд: {m.minSquad} 🐸
                </div>
              </button>
            )
          })}
        </div>

        {/* Выбор отряда */}
        <div className="px-3 pt-3 pb-1 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-bold text-[#1f3a17]">
            Отряд: {selected.size}/{MAX_SQUAD}
          </span>
          {!canLaunch && (
            <span className="text-xs text-[#a05a2c]">
              нужно ещё {Math.max(0, minSquad - selected.size)} 🐸
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {frogs.length === 0 ? (
            <div className="text-center text-sm text-[#6b7d5c] mt-6">
              На этой локации нет лягушек для отряда.
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {frogs.map((level, idx) => {
                const isSel = selected.has(idx)
                const tier = frogTiers[level - 1] ?? 0
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggle(idx)}
                    style={{ touchAction: 'manipulation' }}
                    className={`relative rounded-lg p-1 border-2 ${
                      isSel
                        ? 'border-[#3f8a2e] bg-[#cfe9b0]'
                        : 'border-transparent bg-[#dceecb]'
                    }`}
                  >
                    <img
                      src={getFrogPath(level, tier)}
                      alt={`L${level}`}
                      className="w-full h-auto pointer-events-none"
                      draggable={false}
                    />
                    <span className="absolute bottom-0 right-0 text-[10px] font-bold text-[#1f3a17] bg-[#eaf7da] rounded px-1">
                      {level}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Кнопка запуска */}
        <div className="px-3 pb-4 pt-1 flex-shrink-0">
          <button
            type="button"
            onClick={launch}
            disabled={!canLaunch}
            style={{ touchAction: 'manipulation' }}
            className={`w-full rounded-xl py-3 font-bold text-white text-base ${
              canLaunch ? 'bg-[#16a34a]' : 'bg-[#94a3a0]'
            }`}
          >
            🐸 В путь
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
