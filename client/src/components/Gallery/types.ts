import type { Element } from '../../store/cosmic/types'
import type { LegacyRarity } from '../../store/cosmic/bestiary'

export interface GalleryEntry {
  archetype: Element
  rarity: LegacyRarity
  unlocked: boolean
  /** Level которого собран для preview (lowest unlocked, или 1 если не unlocked). */
  previewLevel: number
}

export const ARCHETYPE_EMOJI: Record<Element, string> = {
  fire: '🔥',
  ice: '❄️',
  water: '💧',
  forest: '🌿',
  toxic: '☢️',
  plasma: '⚡',
  shadow: '🌑',
  crystal: '💎',
  desert: '🏜️',
  gas: '💨',
  ring: '🪐',
  binary: '👯',
  arcane: '✨',
  mechanical: '⚙️',
  war: '⚔️',
  void: '🕳️',
}

export const ARCHETYPE_NAME_RU: Record<Element, string> = {
  fire: 'Огонь',
  ice: 'Лёд',
  water: 'Вода',
  forest: 'Лес',
  toxic: 'Яд',
  plasma: 'Плазма',
  shadow: 'Тень',
  crystal: 'Кристалл',
  desert: 'Пустыня',
  gas: 'Газ',
  ring: 'Кольцо',
  binary: 'Парность',
  arcane: 'Магия',
  mechanical: 'Механика',
  war: 'Война',
  void: 'Пустота',
}

export const RARITY_LABEL: Record<LegacyRarity, string> = {
  common: 'C',
  rare: 'R',
  epic: 'E',
  legendary: 'L',
}

export const RARITY_COLOR: Record<LegacyRarity, string> = {
  common: '#86efac', // green
  rare: '#93c5fd', // blue
  epic: '#d8b4fe', // purple
  legendary: '#fde047', // yellow
}
