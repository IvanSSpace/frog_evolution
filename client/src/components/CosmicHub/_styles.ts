// Shared design tokens для CosmicHub tab content.
// Светлая тема под общий ff-panel стиль приложения (зелёный/жёлтый, тёмный текст).

import type { CSSProperties } from 'react'

// ---- Color tokens ----
export const PINK = '#db2777'
export const PINK_LIGHT = '#f9a8d4'
export const PINK_DARK = '#9d174d'
export const GOLD = '#a16207'
export const TEXT_PRIMARY = '#15803d'
export const TEXT_DIM = '#365314'
export const TEXT_VERY_DIM = 'rgba(54, 83, 20, 0.55)'

// ---- Card patterns ----
export const DARK_CARD_STYLE: CSSProperties = {
  borderRadius: 18,
  background: 'linear-gradient(180deg, #fefdf3 0%, #f5e9b8 100%)',
  border: '3px solid #7c5c2a',
  padding: 12,
  boxShadow: '0 0 0 2px #fef9d7 inset, 0 4px 0 #5d4421',
  color: TEXT_DIM,
}

// ---- Pink gradient pill CTA ----
export const PINK_CTA_STYLE: CSSProperties = {
  background: 'linear-gradient(180deg, #f9a8d4 0%, #db2777 100%)',
  borderRadius: 999,
  padding: '10px 20px',
  fontWeight: 800,
  color: '#fff',
  textShadow: '0 1px 0 rgba(0,0,0,0.4)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.45), 0 3px 0 rgba(0,0,0,0.3)',
  border: 'none',
  cursor: 'pointer',
  touchAction: 'manipulation',
}

export const PINK_CTA_MINI_STYLE: CSSProperties = {
  ...PINK_CTA_STYLE,
  padding: '6px 12px',
  fontSize: 12,
}

export const DISABLED_CTA_OVERRIDES: CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
}

// ---- Pink count badge ----
export const PINK_BADGE_STYLE: CSSProperties = {
  background: PINK,
  color: '#fff',
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 12,
  fontWeight: 700,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
}

// ---- Section header ----
export const SECTION_HEADER_STYLE: CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  color: TEXT_PRIMARY,
  marginBottom: 8,
}

export const SECTION_HEADER_LG_STYLE: CSSProperties = {
  ...SECTION_HEADER_STYLE,
  fontSize: 16,
}

// ---- Empty state ----
export const EMPTY_STATE_TEXT_STYLE: CSSProperties = {
  color: TEXT_VERY_DIM,
  fontSize: 14,
  textAlign: 'center',
}

// ---- Mini badge ----
export const MINI_BADGE_STYLE: CSSProperties = {
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 11,
  fontWeight: 700,
  background: 'rgba(54,83,20,0.12)',
  color: TEXT_DIM,
}
