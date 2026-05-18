// Phase 27 Plan 27-05: single event toast banner.
//
// Renders one event notification banner. CSS keyframes for slide-in + fade-out.
// Self-dismisses after AUTO_DISMISS_MS via setTimeout (clears on unmount).
// No Lottie (memory feedback_animations).
//
// i18n: cosmos.event.notification template — "{{raceName}} {{description}}: {{delta}} к отношениям"
// Description resolved from props.textKey (cosmos.event.<key> or race-specific).
// Race name resolved from props.raceId → RACES_BY_ID lookup.

import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RACES_BY_ID, type RaceId } from '../../game/config/races'
import { DARK_CARD_STYLE } from '../CosmicHub/_styles'

const AUTO_DISMISS_MS = 3000
const FADE_DURATION_MS = 250

interface Props {
  id: string // unique key for React + controller queue
  raceId: string // chain owner; defensive cast to RaceId via RACES_BY_ID
  delta: number // signed integer (positive or negative)
  textKey: string // i18n key for description
  onDismiss: (id: string) => void
}

function EventToastInner({ id, raceId, delta, textKey, onDismiss }: Props) {
  const { t } = useTranslation()
  const [fadingOut, setFadingOut] = useState(false)

  // Defensive race lookup — unknown raceId renders placeholder.
  const race = RACES_BY_ID[raceId as RaceId]
  const raceName = race ? t(race.nameKey) : raceId
  const raceEmoji = race?.emojiIcon ?? '❓'

  // Compose notification text via i18n template.
  const description = t(textKey)
  const deltaStr = delta > 0 ? `+${delta}` : `${delta}`
  const message = t('cosmos.event.notification', {
    raceName,
    description,
    delta: deltaStr,
  })

  useEffect(() => {
    // Schedule fade-out then dismiss.
    const fadeTimer = window.setTimeout(() => {
      setFadingOut(true)
    }, AUTO_DISMISS_MS - FADE_DURATION_MS)
    const dismissTimer = window.setTimeout(() => {
      onDismiss(id)
    }, AUTO_DISMISS_MS)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [id, onDismiss])

  const deltaColor = delta < 0 ? '#ef4444' : delta > 0 ? '#22c55e' : '#fff'

  return (
    <div
      style={{
        ...DARK_CARD_STYLE,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        minWidth: 280,
        maxWidth: 360,
        background: 'rgba(26, 46, 26, 0.95)', // darker than _styles default for top-screen contrast
        border: `1px solid ${deltaColor}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        animation: fadingOut
          ? `contacts-toast-fade ${FADE_DURATION_MS}ms ease-in forwards`
          : `contacts-toast-slide 250ms ease-out`,
        pointerEvents: 'auto',
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>
        {raceEmoji}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: '#fff', lineHeight: 1.4 }}>
        {message}
      </span>
      <span
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: deltaColor,
          flexShrink: 0,
        }}
      >
        {deltaStr}
      </span>
    </div>
  )
}

// Perf audit 2026-05-18 (Phase 27): wrap in React.memo. Props (id/raceId/delta/
// textKey/onDismiss) are stable per toast instance — onDismiss is now memoized
// in the controller. When the controller re-renders to add/remove a sibling
// toast, existing toast instances skip their virtual-DOM diff entirely.
export const EventToast = memo(EventToastInner)
