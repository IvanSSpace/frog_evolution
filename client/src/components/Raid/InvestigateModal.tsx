// InvestigateModal — scout-разведка вражеской планеты.
// Открывается при «Изучить» на race-планете (через investigatePlanetId).
// Показывает 3 локации противника (как фарм-локации игрока, но вражеские):
// имя + огненный фон + отряд по уровням. «Атаковать» запускает
// последовательный бой по локациям (BattleScene loc 1→2→3).

import { createPortal } from 'react-dom'
import { useMemo } from 'react'
import { useGameStore } from '../../store/gameStore'
import { eventBus } from '../../store/eventBus'
import { useModalLock } from '../../utils/modalLock'
import { botDeckLevels } from '../../game/scenes/battle/battleUnits'
import { getLocationById } from '../../game/config/locations'
import {
  biomeForPlanetId,
  planetNameById,
} from '../../game/scenes/starmap/planetarium'

interface Props {
  planetId: string
  onClose: () => void
}

// Порядок прохождения рейда — те же id, что BattleScene гоняет 1→2→3.
const RAID_LOCATION_IDS = [1, 2, 3] as const

// Raid-фон локации по биому планеты. Ассеты: /maps/<biome>_map[N].png.
const RAID_BIOMES = ['fire', 'ice', 'desert', 'toxic']
const biomeBg = (biome: string, locId: number): string => {
  const b = RAID_BIOMES.includes(biome) ? biome : 'fire'
  const suffix = locId <= 1 ? '' : String(locId)
  return `/maps/${b}_map${suffix}.png`
}

// Оставшееся время неуязвимости → «1ч 23м» / «12м».
const fmtRemain = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 60000))
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}ч ${m}м` : `${m}м`
}

// Emoji биома — для подписи локаций в карточках.
const BIOME_EMOJI: Record<string, string> = {
  fire: '🔥',
  ice: '❄️',
  desert: '🏜️',
  toxic: '☣️',
}

export function InvestigateModal({ planetId, onClose }: Props) {
  useModalLock()
  // Имя + биом резолвятся для ЛЮБОЙ планеты (main + bg), не только MAIN_RACES.
  const planetName = useMemo(() => planetNameById(planetId), [planetId])
  const biome = useMemo(() => biomeForPlanetId(planetId), [planetId])
  const biomeEmoji = BIOME_EMOJI[biome] ?? '🔥'
  const locations = useMemo(
    () =>
      RAID_LOCATION_IDS.map((id) => ({
        id,
        name: getLocationById(id).name,
        levels: botDeckLevels(id, planetId),
        bg: biomeBg(biome, id),
      })),
    [biome, planetId],
  )

  const setScoutPlanetId = useGameStore((s) => s.setScoutPlanetId)
  const setRaidCooldown = useGameStore((s) => s.setRaidCooldown)
  const raidCooldowns = useGameStore((s) => s.raidCooldowns)
  const onCooldown = (raidCooldowns[planetId] ?? 0) > Date.now()

  const handleAttack = () => {
    if (onCooldown) return
    // Планета становится неуязвимой 1.5ч после атаки (любой исход).
    setRaidCooldown(planetId)
    onClose()
    // Запуск последовательного боя — BattleScene сам идёт loc 1→2→3.
    eventBus.emit('raid:battle-start', { planetId })
  }

  const handleScout = () => {
    // Immersive-осмотр локаций (RaidScoutScene, zoom-переключение как ферма).
    // Запоминаем planet чтобы вернуться в эту модалку по «Назад».
    setScoutPlanetId(planetId)
    onClose()
    eventBus.emit('raid:scout-open', {})
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 260,
        pointerEvents: 'auto',
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #1f2937 0%, #111827 100%)',
          border: '3px solid #dc2626',
          borderRadius: 16,
          padding: 16,
          maxWidth: 380,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          color: '#fff',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 2,
          }}
        >
          🛰 Разведка
        </div>
        <div
          style={{
            textAlign: 'center',
            fontSize: 13,
            opacity: 0.85,
            marginBottom: 12,
          }}
        >
          Цель: <span style={{ color: '#fca5a5' }}>{planetName}</span>
          {' · '}
          локаций: {locations.length}
        </div>

        {/* Карточки локаций противника */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {locations.map((loc, idx) => (
            <div
              key={loc.id}
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid rgba(220,38,38,0.5)',
                background: '#1a1010',
              }}
            >
              {/* Фон-локации (затемнённый) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${loc.bg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: 0.35,
                }}
              />
              <div style={{ position: 'relative', padding: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {biomeEmoji} {idx + 1}. {loc.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fca5a5',
                      background: 'rgba(0,0,0,0.45)',
                      borderRadius: 8,
                      padding: '2px 8px',
                    }}
                  >
                    {loc.levels.length} юн.
                  </span>
                </div>
                {/* Отряд — чипы уровней */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                  }}
                >
                  {loc.levels.map((lvl, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#fff',
                        background:
                          'linear-gradient(180deg, #7f1d1d 0%, #450a0a 100%)',
                        border: '1px solid #fca5a5',
                        borderRadius: 6,
                        padding: '3px 7px',
                        minWidth: 26,
                        textAlign: 'center',
                      }}
                    >
                      L{lvl}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Осмотреть — immersive-вид локаций с zoom-переключением (как ферма). */}
        <button
          type="button"
          onClick={handleScout}
          style={{
            width: '100%',
            marginTop: 14,
            padding: '11px',
            background: 'linear-gradient(180deg, #0e7490 0%, #155e75 100%)',
            border: '2px solid #67e8f9',
            borderRadius: 10,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          🔭 Осмотреть
        </button>

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 10,
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            Уйти
          </button>
          <button
            type="button"
            onClick={handleAttack}
            disabled={onCooldown}
            style={{
              flex: 2,
              padding: '12px',
              background: onCooldown
                ? 'linear-gradient(180deg, #475569 0%, #334155 100%)'
                : 'linear-gradient(180deg, #dc2626 0%, #7f1d1d 100%)',
              border: onCooldown ? '2px solid #94a3b8' : '2px solid #fca5a5',
              borderRadius: 10,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: onCooldown ? 'not-allowed' : 'pointer',
              opacity: onCooldown ? 0.8 : 1,
              touchAction: 'manipulation',
            }}
          >
            {onCooldown
              ? `🛡 Неуязвима ${fmtRemain((raidCooldowns[planetId] ?? 0) - Date.now())}`
              : 'Атаковать ⚔️'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Используется в App.tsx через store state — флаг investigatePlanetId.
// Когда set'ится non-null → modal mount'ится.
export function InvestigateModalController() {
  const investigatePlanetId = useGameStore((s) => s.investigatePlanetId)
  const setInvestigatePlanetId = useGameStore((s) => s.setInvestigatePlanetId)
  if (!investigatePlanetId) return null
  return (
    <InvestigateModal
      planetId={investigatePlanetId}
      onClose={() => setInvestigatePlanetId(null)}
    />
  )
}
