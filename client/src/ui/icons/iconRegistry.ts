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
  | 'ship'
  | 'cosmic-hub'
  | 'bestiary'
  | 'inventory'
  // Кнопки корабля
  | 'recall'
  | 'in-transit'
  | 'unload'
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

/** Эмодзи-fallback пока нет SVG в public/icons/<name>.svg. */
export const ICON_EMOJI: Record<IconName, string> = {
  'frog-shop': '🐸',
  'upgrade-shop': '⬆️',
  gallery: '📊',
  ship: '🚀',
  'cosmic-hub': '🧬',
  bestiary: '📖',
  inventory: '🎒',
  recall: '↩',
  'in-transit': '🛸',
  unload: '🛬',
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
}

// 2026-05-28: footer-иконки лежат в public/footer_icons/ как PNG.
// Override маппит ключи на свои пути; остальные ищутся в /icons/<name>.svg.
const FOOTER_OVERRIDE: Partial<Record<IconName, string>> = {
  'frog-shop': '/footer_icons/icon_frog.png',
  'upgrade-shop': '/footer_icons/icon_upgrade.png',
  ship: '/footer_icons/icon_rocket.png',
  'cosmic-hub': '/footer_icons/icon_shield.png',
  bestiary: '/footer_icons/icon_book.png',
  inventory: '/footer_icons/icon_backpack.png',
}

/** Путь к SVG/PNG-ассету иконки в public/icons/. */
export function iconSrc(name: IconName): string {
  return FOOTER_OVERRIDE[name] ?? `/icons/${name}.svg`
}
