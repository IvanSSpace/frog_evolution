// Icon registry — единая точка для всех UI-иконок (замена эмодзи).
//
// Как работает: <Icon name="..."/> рендерит /icons/<name>.svg (drop файла в
// public/icons/ → подхватится автоматом). Пока файла нет — fallback на эмодзи
// из ICON_EMOJI. Т.е. чтобы «сделать красиво» достаточно положить SVG/PNG
// с правильным именем в public/icons/ — код менять не нужно.
//
// Phaser-сцены — отдельно (позже, через загрузку текстур).

export type IconName =
  // Футер
  | 'frog-shop'
  | 'upgrade-shop'
  | 'gallery'
  | 'barracks'
  | 'ship'
  | 'cosmic-hub'
  | 'bestiary'
  // Кнопки казармы / корабля
  | 'combat-tree'
  | 'raid'
  | 'recall'
  | 'in-transit'
  | 'unload'
  // Combat tree
  | 'damage'
  | 'hp'
  | 'armor'
  // Валюты
  | 'slime'
  | 'gold'
  | 'essence'
  | 'serum'
  // Локации
  | 'loc-swamp'
  | 'loc-forest'
  | 'loc-continent'
  | 'loc-starmap'
  // Cosmic Hub табы
  | 'tab-carriers'
  | 'tab-serum'
  | 'tab-contacts'
  | 'tab-quests'
  // Общие
  | 'close'
  | 'lock'
  | 'attack'

/** Эмодзи-fallback пока нет SVG в public/icons/<name>.svg. */
export const ICON_EMOJI: Record<IconName, string> = {
  'frog-shop': '🐸',
  'upgrade-shop': '⬆️',
  gallery: '📊',
  barracks: '⚔️',
  ship: '🚀',
  'cosmic-hub': '🧬',
  bestiary: '📖',
  'combat-tree': '⬆',
  raid: '⚔',
  recall: '↩',
  'in-transit': '🛸',
  unload: '🛬',
  damage: '🗡',
  hp: '❤',
  armor: '🛡',
  slime: '💧',
  gold: '🪙',
  essence: '💠',
  serum: '🧪',
  'loc-swamp': '🌿',
  'loc-forest': '🌲',
  'loc-continent': '🌍',
  'loc-starmap': '✨',
  'tab-carriers': '🐸',
  'tab-serum': '🧪',
  'tab-contacts': '📡',
  'tab-quests': '📜',
  close: '✕',
  lock: '🔒',
  attack: '⚔',
}

/** Путь к SVG/PNG-ассету иконки в public/icons/. */
export function iconSrc(name: IconName): string {
  return `/icons/${name}.svg`
}
