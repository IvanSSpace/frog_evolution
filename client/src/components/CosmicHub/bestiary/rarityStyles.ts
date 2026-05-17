// Phase 18: rarity → визуальные стили (REQ BESTIARY-06).
// Цвета согласованы с awakened presets (Phase 13) и общей UX-палитрой.

import type { LegacyRarity } from '../../../store/cosmic/bestiary'

/** Tailwind border classes per rarity. */
export const RARITY_BORDER: Record<LegacyRarity, string> = {
  common: 'border-2 border-slate-400',
  rare: 'border-2 border-sky-400',
  epic: 'border-2 border-violet-400',
  legendary: 'border-2 border-amber-400',
}

/** Tailwind/inline glow per rarity (через arbitrary value, чтобы не зависеть от safelist). */
export const RARITY_GLOW: Record<LegacyRarity, string> = {
  common: 'shadow-[0_0_4px_rgba(148,163,184,0.4)]',
  rare: 'shadow-[0_0_6px_rgba(56,189,248,0.5)]',
  epic: 'shadow-[0_0_8px_rgba(167,139,250,0.6)]',
  legendary: 'shadow-[0_0_10px_rgba(252,211,77,0.7)]',
}

/** i18n keys для rarity labels. */
export const RARITY_LABEL_KEY: Record<LegacyRarity, string> = {
  common: 'cosmic_hub.bestiary.rarity_common',
  rare: 'cosmic_hub.bestiary.rarity_rare',
  epic: 'cosmic_hub.bestiary.rarity_epic',
  legendary: 'cosmic_hub.bestiary.rarity_legendary',
}

/** Преобразует Phaser numeric tint (0xRRGGBB) в CSS hex string. */
export function tintToCss(tint: number): string {
  return `#${tint.toString(16).padStart(6, '0')}`
}
