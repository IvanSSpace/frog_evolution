// Phase 27 Plan 27-04: relationship progress bar.
//
// Renders a 1-10 horizontal bar with tier color fill + tier label badge + numeric value.
// Subscribes to 'contacts:relationship-delta' for own raceId — triggers CSS keyframe
// pulse on the tier badge when the tier changes (visual delta feedback per CONTEXT D-Reply UX).
//
// Pure-ish: parent (RaceDetailView) passes current value via prop; component derives tier
// + color via getRelationshipTier helper. Internal useState only tracks pulse-active flag.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getRelationshipTier,
  TIER_COLORS,
  TIER_I18N_KEYS,
  RELATIONSHIP_MAX,
} from '../../../game/config/raceChains'
import type { RaceId } from '../../../game/config/races'
import { eventBus } from '../../../store/eventBus'
import { MINI_BADGE_STYLE, TEXT_DIM } from '../_styles'

interface Props {
  raceId: RaceId
  value: number
}

export function RelationshipBar({ raceId, value }: Props) {
  const { t } = useTranslation()
  const tier = getRelationshipTier(value)
  const color = TIER_COLORS[tier]
  const tierLabel = t(TIER_I18N_KEYS[tier])
  const fillPct = Math.min(100, Math.max(0, (value / RELATIONSHIP_MAX) * 100))

  // Pulse-active flag triggered when own raceId's relationship-delta event crosses a tier boundary.
  const [pulseActive, setPulseActive] = useState(false)
  const prevTierRef = useRef(tier)

  useEffect(() => {
    // Subscribe to relationship-delta. Filter to own raceId only.
    const handler = (payload: {
      raceId: string
      oldValue: number
      newValue: number
      delta: number
    }) => {
      if (payload.raceId !== raceId) return
      const oldTier = getRelationshipTier(payload.oldValue)
      const newTier = getRelationshipTier(payload.newValue)
      if (oldTier !== newTier) {
        setPulseActive(true)
        window.setTimeout(() => setPulseActive(false), 800)
      }
    }
    eventBus.on('contacts:relationship-delta', handler)
    return () => {
      eventBus.off('contacts:relationship-delta', handler)
    }
  }, [raceId])

  // Local tier-change detection on prop value (covers non-event re-render path, e.g. when
  // the parent re-renders with new value before our handler fires).
  useEffect(() => {
    if (prevTierRef.current !== tier) {
      setPulseActive(true)
      window.setTimeout(() => setPulseActive(false), 800)
      prevTierRef.current = tier
    }
  }, [tier])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 12px',
      }}
    >
      {/* Pulse keyframe — mount once per component (cheap, no Lottie per memory feedback_animations). */}
      <style>{`
        @keyframes contacts-tier-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.75; }
        }
      `}</style>

      {/* Label row: tier name + numeric value */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            ...MINI_BADGE_STYLE,
            background: color,
            color: '#365314',
            animation: pulseActive
              ? 'contacts-tier-pulse 800ms ease-in-out'
              : undefined,
            transformOrigin: 'center',
          }}
        >
          {tierLabel}
        </span>
        <span style={{ fontSize: 13, color: TEXT_DIM, fontWeight: 700 }}>
          {Math.round(value)} / {RELATIONSHIP_MAX}
        </span>
      </div>

      {/* Bar track + fill */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 8,
          background: 'rgba(54,83,20,0.10)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${fillPct}%`,
            background: color,
            borderRadius: 999,
            transition: 'width 300ms ease-out, background 300ms ease-out',
          }}
        />
      </div>
    </div>
  )
}
