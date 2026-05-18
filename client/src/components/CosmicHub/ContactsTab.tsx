// Phase 27 Plan 27-04: contacts tab — 7th in Cosmic Hub.
//
// Two-view component: list (default) ↔ detail (RaceDetailView). Local useState toggles
// between them. In-tab navigation, NOT modal (per CONTEXT D-Race-detail screen).
//
// List row: race emoji + name + tier badge + unread dot (если pending для этой расы).
// Header: pending count "Очередь: N/3".
//
// Mount effect: triggerPendingPull() — covers case where firstContactsSeen изменился
// пока вкладка была inactive (engine реактивен на slice change, но повторный pull
// безопасен — engine идемпотентен).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import { RACES, type RaceId } from '../../game/config/races'
import {
  getRelationshipTier,
  TIER_COLORS,
  TIER_I18N_KEYS,
} from '../../game/config/raceChains'
import { RaceDetailView } from './contacts/RaceDetailView'
import {
  DARK_CARD_STYLE,
  SECTION_HEADER_STYLE,
  MINI_BADGE_STYLE,
  PINK,
  TEXT_DIM,
} from './_styles'

export function ContactsTab() {
  const { t } = useTranslation()
  const [selectedRaceId, setSelectedRaceId] = useState<RaceId | null>(null)

  // Granular Zustand selectors — Phase 26-04 pattern, avoid whole-store re-render.
  const raceRelationships = useGameStore((s) => s.raceRelationships)
  const firstContactsSeen = useGameStore((s) => s.firstContactsSeen)
  const pendingItems = useGameStore((s) => s.pendingItems)
  const triggerPendingPull = useGameStore((s) => s.triggerPendingPull)

  // Mount effect: refill queue on tab open. Engine is idempotent — safe to re-pull.
  useEffect(() => {
    triggerPendingPull()
  }, [triggerPendingPull])

  // Detail view path.
  if (selectedRaceId !== null) {
    return (
      <RaceDetailView
        raceId={selectedRaceId}
        onBack={() => setSelectedRaceId(null)}
      />
    )
  }

  // List view path.
  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <section style={{ marginBottom: 12 }}>
        <h3 style={SECTION_HEADER_STYLE}>
          {t('cosmic_hub.contacts.pending_count', {
            count: pendingItems.length,
          })}
        </h3>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {RACES.map((race) => {
          const value = raceRelationships[race.id] ?? 1
          const tier = getRelationshipTier(value)
          const tierColor = TIER_COLORS[tier]
          const tierLabel = t(TIER_I18N_KEYS[tier])
          const hasPending = pendingItems.some((p) => p.raceId === race.id)
          const isContacted = firstContactsSeen[race.id] === true

          return (
            <button
              key={race.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedRaceId(race.id)
              }}
              style={{
                ...DARK_CARD_STYLE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                border: 'none',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                cursor: 'pointer',
                touchAction: 'manipulation',
                width: '100%',
                textAlign: 'left',
                opacity: isContacted ? 1 : 0.6,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>
                  {race.emojiIcon}
                </span>
                <span
                  style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {t(race.nameKey)}
                  </span>
                  <span style={{ fontSize: 11, color: TEXT_DIM }}>
                    {isContacted ? tierLabel : '—'}
                  </span>
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {hasPending && (
                  <span
                    aria-label="unread"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: PINK,
                      boxShadow: '0 0 6px ' + PINK,
                    }}
                  />
                )}
                <span
                  style={{
                    ...MINI_BADGE_STYLE,
                    background: isContacted
                      ? tierColor
                      : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                  }}
                >
                  {isContacted ? `${value}/10` : '?'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
