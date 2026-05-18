// Phase 25-02: shared design tokens для CosmicHub tab content restyle.
// Centralized чтобы DRY между ShipTab/SerumInventoryTab/BestiaryTab/CarriersTab/
// CarrierInfoCard/CosmicShopTab. Использует те же токены что Plan 25-01 shell
// (#1a2e1a фон + #ec4899 pink + #fde047 gold) — Phase 23 WelcomeModal pattern.

import type { CSSProperties } from 'react'

// ---- Color tokens ----
export const PINK = '#ec4899'
export const PINK_LIGHT = '#f9a8d4'
export const PINK_DARK = '#db2777'
export const GOLD = '#fde047'
export const TEXT_DIM = '#d4d4d8'
export const TEXT_VERY_DIM = 'rgba(255,255,255,0.4)'

// ---- Card patterns (per WelcomeModal) ----
export const DARK_CARD_STYLE: CSSProperties = {
  borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: 12,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

// ---- Pink gradient pill CTA (per LocationStack) ----
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

// Mini variant — для inline carrier/shop action buttons.
export const PINK_CTA_MINI_STYLE: CSSProperties = {
  ...PINK_CTA_STYLE,
  padding: '6px 12px',
  fontSize: 12,
}

// Disabled overlay overrides (apply via spread).
export const DISABLED_CTA_OVERRIDES: CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
}

// ---- Pink count badge (для serum/shop count pills) ----
export const PINK_BADGE_STYLE: CSSProperties = {
  background: PINK,
  color: '#fff',
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 12,
  fontWeight: 700,
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 0 rgba(0,0,0,0.2)',
}

// ---- Section header (bold + textShadow) ----
export const SECTION_HEADER_STYLE: CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  color: '#fff',
  textShadow: '0 1px 0 rgba(0,0,0,0.4)',
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

// ---- Mini badge (neutral, для carrier element/level tags) ----
export const MINI_BADGE_STYLE: CSSProperties = {
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 11,
  fontWeight: 700,
  background: 'rgba(255,255,255,0.1)',
  color: '#fff',
}
