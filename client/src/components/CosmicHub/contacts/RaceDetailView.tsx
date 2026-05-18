// Phase 27 Plan 27-04: race detail view.
//
// Sub-view of ContactsTab (NOT a modal — in-tab navigation per CONTEXT D-Race-detail screen).
// Layout:
//   1. Back arrow + header (emoji + race name)
//   2. Lore card (home planet + personality + lore_short)
//   3. RelationshipBar
//   4. Pending interaction (msg / dialog / quest_hook) OR empty_state / all_read
//
// Cliclability checklist (memory feedback_clickability):
//   - All buttons: type="button", touchAction: 'manipulation', stopPropagation in onClick.
//   - z-index inherits CosmicHubModal (100) — no overrides needed.
//   - Back arrow: simple onClick → onBack() callback (parent ContactsTab handles state).

import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../../store/gameStore'
import { RACES_BY_ID, type RaceId } from '../../../game/config/races'
import { RACE_CHAINS, type PendingItem } from '../../../game/config/raceChains'
import { RelationshipBar } from './RelationshipBar'
import {
  DARK_CARD_STYLE,
  SECTION_HEADER_STYLE,
  PINK_CTA_MINI_STYLE,
  GOLD,
  TEXT_DIM,
  EMPTY_STATE_TEXT_STYLE,
} from '../_styles'

interface Props {
  raceId: RaceId
  onBack: () => void
}

export function RaceDetailView({ raceId, onBack }: Props) {
  const { t } = useTranslation()
  const race = RACES_BY_ID[raceId]

  // Granular Zustand selectors — avoid whole-store re-render (Phase 26-04 pattern).
  const relationship = useGameStore((s) => s.raceRelationships[raceId] ?? 1)
  const chainProgress = useGameStore((s) => s.chainProgress[raceId] ?? 0)
  const pendingItem = useGameStore((s) =>
    s.pendingItems.find((p) => p.raceId === raceId),
  )
  const resolveAccept = useGameStore((s) => s.resolveAccept)
  const resolveRefuse = useGameStore((s) => s.resolveRefuse)
  const resolveAcknowledge = useGameStore((s) => s.resolveAcknowledge)

  const chainLen = RACE_CHAINS[raceId]?.length ?? 0

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      {/* ─── HEADER: back arrow + race emoji + name ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onBack()
          }}
          aria-label="Back"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: 22,
            padding: '4px 8px',
            cursor: 'pointer',
            touchAction: 'manipulation',
            lineHeight: 1,
          }}
        >
          ←
        </button>
        <span style={{ fontSize: 32, lineHeight: 1 }}>{race.emojiIcon}</span>
        <span style={{ fontSize: 18, fontWeight: 800 }}>{t(race.nameKey)}</span>
      </div>

      {/* ─── LORE CARD ─── */}
      <section style={{ marginBottom: 12 }}>
        <div style={{ ...DARK_CARD_STYLE, padding: 12 }}>
          <div
            style={{
              fontSize: 13,
              color: GOLD,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {t(race.homePlanetNameKey)}
          </div>
          <div
            style={{
              fontSize: 12,
              fontStyle: 'italic',
              color: TEXT_DIM,
              marginBottom: 8,
            }}
          >
            {t(race.personalityKey)}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#fff' }}>
            {t(race.loreShortKey)}
          </div>
        </div>
      </section>

      {/* ─── RELATIONSHIP BAR ─── */}
      <section style={{ marginBottom: 12 }}>
        <h3 style={SECTION_HEADER_STYLE}>
          {t('cosmic_hub.contacts.relationship_label')}
        </h3>
        <div style={DARK_CARD_STYLE}>
          <RelationshipBar raceId={raceId} value={relationship} />
        </div>
      </section>

      {/* ─── PENDING INTERACTION ─── */}
      <section style={{ marginBottom: 12 }}>
        {pendingItem ? (
          <PendingInteraction
            pending={pendingItem}
            onAccept={() => resolveAccept(pendingItem.id)}
            onRefuse={() => resolveRefuse(pendingItem.id)}
            onAcknowledge={() => resolveAcknowledge(pendingItem.id)}
          />
        ) : (
          <EmptyPending atEnd={chainProgress >= chainLen} />
        )}
      </section>
    </div>
  )
}

interface PendingProps {
  pending: PendingItem
  onAccept: () => void
  onRefuse: () => void
  onAcknowledge: () => void
}

function PendingInteraction({
  pending,
  onAccept,
  onRefuse,
  onAcknowledge,
}: PendingProps) {
  const { t } = useTranslation()
  const item = pending.item

  // All 4 ChainItem variants carry a text_key field (msg/dialog/quest_hook/event).
  // 'event' shouldn't appear in pendingItems (engine auto-applies), but defensive render
  // handles it as msg with Acknowledge button.
  const bodyText = t(item.text_key)

  return (
    <div style={{ ...DARK_CARD_STYLE, padding: 16 }}>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: '#fff',
          marginBottom: 12,
        }}
      >
        {bodyText}
      </div>

      {item.type === 'quest_hook' && (
        <div
          style={{
            fontSize: 12,
            fontStyle: 'italic',
            color: GOLD,
            marginBottom: 12,
            opacity: 0.85,
          }}
        >
          {t('cosmic_hub.contacts.quest_stub')}
        </div>
      )}

      {/* Buttons row */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {item.type === 'msg' || item.type === 'event' ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAcknowledge()
            }}
            style={{ ...PINK_CTA_MINI_STYLE, touchAction: 'manipulation' }}
          >
            {t('cosmic_hub.contacts.acknowledge')}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRefuse()
              }}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {t('cosmic_hub.contacts.refuse')} (
              {formatDelta(item.refuse_delta)})
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAccept()
              }}
              style={{ ...PINK_CTA_MINI_STYLE, touchAction: 'manipulation' }}
            >
              {t('cosmic_hub.contacts.support')} (
              {formatDelta(item.accept_delta)})
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function formatDelta(d: number): string {
  return d > 0 ? `+${d}` : `${d}`
}

function EmptyPending({ atEnd }: { atEnd: boolean }) {
  const { t } = useTranslation()
  return (
    <div style={{ ...DARK_CARD_STYLE, padding: 16, textAlign: 'center' }}>
      <div style={EMPTY_STATE_TEXT_STYLE}>
        {atEnd
          ? t('cosmic_hub.contacts.all_read')
          : t('cosmic_hub.contacts.empty_state')}
      </div>
    </div>
  )
}
