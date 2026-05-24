// Warrior class system for Barracks/PvP mode.
//
// 6 классов × 3 локации (Болото/Лес/Континент) = 18 жаб-воинов.
// Каждая жаба L1-L18 имеет ровно один класс. Класс определяет роль в бою
// (auto-chess style) и набор пассив/абилок.
//
// Распределение синхронизировано с дизайн-документом 2026-05-24.
// См. frog_obsidian/Design Notes/2026-05-24-barracks-classes.md (если будет).
//
// Cosmos-tier жаб (L19+) НЕТ — они не появляются на поле и не доступны
// как воины (см. Локация.md: 3 фарм-локации, max L18).

import { getFrogPrice } from './frogs'

export type WarriorClass =
  | 'tank'
  | 'carry'
  | 'mage'
  | 'assassin'
  | 'support'
  | 'swarm'

export interface AbilityDef {
  /** Уникальный id, для аналитики/event'ов. */
  id: string
  /** Имя для UI. */
  name: string
  /** Короткое описание (русское) — рендерится в туллтипе/карточке. */
  desc: string
  /** Триггер: 'passive' = постоянный эффект; 'tick' = срабатывает по cooldown. */
  trigger: 'passive' | 'tick'
  /** Если trigger='tick' — период в секундах. */
  cooldownSec?: number
}

export interface WarriorConfig {
  level: number // 1..18
  class: WarriorClass
  /** Базовая характеристика — масштабируется от level и tier эволюции. */
  baseHp: number
  baseDamage: number
  baseAttackSpeed: number // удары в секунду
  ability: AbilityDef
}

// ─── Class meta (для UI/badges) ───────────────────────────────────────────

export interface ClassMeta {
  id: WarriorClass
  name: string
  emoji: string
  color: number // Phaser hex tint
  desc: string
}

export const CLASS_META: Record<WarriorClass, ClassMeta> = {
  tank: {
    id: 'tank',
    name: 'Танк',
    emoji: '🛡️',
    color: 0x4d6b1f,
    desc: 'Front line. Поглощает урон, держит агро.',
  },
  carry: {
    id: 'carry',
    name: 'Кэрри',
    emoji: '⚔️',
    color: 0xdc2626,
    desc: 'Single-target melee DPS. Scales поздно.',
  },
  mage: {
    id: 'mage',
    name: 'Маг',
    emoji: '🔮',
    color: 0x8b5cf6,
    desc: 'AoE burst-каст по cooldown.',
  },
  assassin: {
    id: 'assassin',
    name: 'Ассасин',
    emoji: '🗡️',
    color: 0x374151,
    desc: 'Back-line dive. Может стартовать рейд скрытно.',
  },
  support: {
    id: 'support',
    name: 'Саппорт',
    emoji: '🌸',
    color: 0xec4899,
    desc: 'Heal/buff/dispel ауры.',
  },
  swarm: {
    id: 'swarm',
    name: 'Хор',
    emoji: '🐸',
    color: 0x16a34a,
    desc: 'Призыв юнитов, мульти-таргет.',
  },
}

// ─── 18 warrior configs (L1-L18) ──────────────────────────────────────────
//
// Распределение по локациям × классам:
//   Болото L1-6: SWARM(L1), CARRY(L2), SUPPORT(L3), TANK(L4), MAGE(L5), ASSASSIN(L6)
//   Лес L7-12:   ASSASSIN(L7), CARRY(L8), TANK(L9), SUPPORT(L10), MAGE(L11), SWARM(L12)
//   Континент L13-18: ASSASSIN(L13), CARRY(L14), MAGE(L15), TANK(L16), SUPPORT(L17), SWARM(L18)

export const WARRIORS: readonly WarriorConfig[] = [
  // ─── Болото L1-6 ───
  {
    level: 1,
    class: 'swarm',
    baseHp: 80,
    baseDamage: 6,
    baseAttackSpeed: 1.0,
    ability: {
      id: 'tadpole_spawn',
      name: 'Призыв головастиков',
      desc: 'Каждые 7s вызывает 2 головастиков (HP 20, dmg 3).',
      trigger: 'tick',
      cooldownSec: 7,
    },
  },
  {
    level: 2,
    class: 'carry',
    baseHp: 100,
    baseDamage: 12,
    baseAttackSpeed: 1.0,
    ability: {
      id: 'basic_strike',
      name: 'Базовый удар',
      desc: 'Стартовый класс. +5% AS пассив.',
      trigger: 'passive',
    },
  },
  {
    level: 3,
    class: 'support',
    baseHp: 90,
    baseDamage: 7,
    baseAttackSpeed: 0.9,
    ability: {
      id: 'lotus_aura',
      name: 'Лотос-аура',
      desc: 'Пассив: +5 HP/s всем союзникам в радиусе 2 клеток.',
      trigger: 'passive',
    },
  },
  {
    level: 4,
    class: 'tank',
    baseHp: 200,
    baseDamage: 8,
    baseAttackSpeed: 0.7,
    ability: {
      id: 'shell_block',
      name: 'Панцирь',
      desc: 'Пассив: -1 урон с каждого получаемого удара (мин 1).',
      trigger: 'passive',
    },
  },
  {
    level: 5,
    class: 'mage',
    baseHp: 80,
    baseDamage: 10,
    baseAttackSpeed: 0.8,
    ability: {
      id: 'spore_cloud',
      name: 'Облако спор',
      desc: 'Каждые 4s — AoE poison (15 dmg, 2-клетки радиус).',
      trigger: 'tick',
      cooldownSec: 4,
    },
  },
  {
    level: 6,
    class: 'assassin',
    baseHp: 100,
    baseDamage: 18,
    baseAttackSpeed: 1.1,
    ability: {
      id: 'stealth_pounce',
      name: 'Прыжок из тени',
      desc: 'Каждые 6s — стелс + прыжок на back-line. Используется в raid-opener.',
      trigger: 'tick',
      cooldownSec: 6,
    },
  },

  // ─── Лес L7-12 ───
  {
    level: 7,
    class: 'assassin',
    baseHp: 140,
    baseDamage: 26,
    baseAttackSpeed: 1.0,
    ability: {
      id: 'antler_charge',
      name: 'Рога вперёд',
      desc: 'Каждые 5s — charge сквозь линию врагов, dmg по всем.',
      trigger: 'tick',
      cooldownSec: 5,
    },
  },
  {
    level: 8,
    class: 'carry',
    baseHp: 160,
    baseDamage: 30,
    baseAttackSpeed: 1.1,
    ability: {
      id: 'leap_strike',
      name: 'Прыжок-удар',
      desc: 'Каждые 5s — прыгает на самого дальнего таргета.',
      trigger: 'tick',
      cooldownSec: 5,
    },
  },
  {
    level: 9,
    class: 'tank',
    baseHp: 380,
    baseDamage: 14,
    baseAttackSpeed: 0.6,
    ability: {
      id: 'bump_armor',
      name: 'Бугры',
      desc: 'Пассив: -20% physical damage.',
      trigger: 'passive',
    },
  },
  {
    level: 10,
    class: 'support',
    baseHp: 200,
    baseDamage: 12,
    baseAttackSpeed: 0.8,
    ability: {
      id: 'belly_bounce',
      name: 'Удар брюхом',
      desc: 'Каждые 5s — knockback + slow всем врагам в радиусе.',
      trigger: 'tick',
      cooldownSec: 5,
    },
  },
  {
    level: 11,
    class: 'mage',
    baseHp: 140,
    baseDamage: 18,
    baseAttackSpeed: 0.8,
    ability: {
      id: 'quill_rain',
      name: 'Дождь шипов',
      desc: 'Каждые 6s — дождь шипов на 3-клетки область (25 dmg).',
      trigger: 'tick',
      cooldownSec: 6,
    },
  },
  {
    level: 12,
    class: 'swarm',
    baseHp: 180,
    baseDamage: 14,
    baseAttackSpeed: 0.9,
    ability: {
      id: 'quill_brood',
      name: 'Выводок шипастиков',
      desc: 'На старте боя призывает 3 младших шипастиков (HP 30, dmg 6).',
      trigger: 'passive',
    },
  },

  // ─── Континент L13-18 ───
  {
    level: 13,
    class: 'assassin',
    baseHp: 220,
    baseDamage: 42,
    baseAttackSpeed: 0.9,
    ability: {
      id: 'lantern_lure',
      name: 'Фонарь-приманка',
      desc: 'Пассив: аура приманивает ближайшего врага к нему (пуллит aggro).',
      trigger: 'passive',
    },
  },
  {
    level: 14,
    class: 'carry',
    baseHp: 250,
    baseDamage: 48,
    baseAttackSpeed: 1.2,
    ability: {
      id: 'claw_frenzy',
      name: 'Когти-фьюри',
      desc: 'Пассив: +30% attack speed.',
      trigger: 'passive',
    },
  },
  {
    level: 15,
    class: 'mage',
    baseHp: 200,
    baseDamage: 28,
    baseAttackSpeed: 0.7,
    ability: {
      id: 'mind_pulse',
      name: 'Психо-импульс',
      desc: 'Каждые 7s — AoE stun на 1.5s.',
      trigger: 'tick',
      cooldownSec: 7,
    },
  },
  {
    level: 16,
    class: 'tank',
    baseHp: 600,
    baseDamage: 22,
    baseAttackSpeed: 0.6,
    ability: {
      id: 'roar_taunt',
      name: 'Рык',
      desc: 'Каждые 6s — ревёт, агро всех врагов в радиусе.',
      trigger: 'tick',
      cooldownSec: 6,
    },
  },
  {
    level: 17,
    class: 'support',
    baseHp: 280,
    baseDamage: 20,
    baseAttackSpeed: 0.8,
    ability: {
      id: 'witch_aura',
      name: 'Колдовская аура',
      desc: 'Пассив: +30% damage всем союзникам.',
      trigger: 'passive',
    },
  },
  {
    level: 18,
    class: 'swarm',
    baseHp: 320,
    baseDamage: 24,
    baseAttackSpeed: 0.9,
    ability: {
      id: 'kings_call',
      name: 'Зов короля',
      desc: 'Каждые 12s — вызов 2 элитных воинов (HP 100, dmg 18).',
      trigger: 'tick',
      cooldownSec: 12,
    },
  },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────

export function getWarriorConfig(level: number): WarriorConfig | undefined {
  if (level < 1 || level > WARRIORS.length) return undefined
  return WARRIORS[level - 1]
}

export function getWarriorClass(level: number): WarriorClass | undefined {
  return getWarriorConfig(level)?.class
}

/**
 * Цена конвертации жабы из фарма в воина.
 * = базовая цена жабы (basePrice). Игрок платит slime, получает воина в клетке казармы.
 *
 * MVP: используем basePrice(level, purchases=0) — простой sticker price.
 * Можем затюнить позже если нужно (например ×0.5 со временем).
 */
export function getWarriorConvertCost(level: number): number {
  return getFrogPrice(level, 0)
}

/** Список всех классов в детерминированном порядке (для UI/фильтров). */
export const ALL_CLASSES: readonly WarriorClass[] = [
  'tank',
  'carry',
  'mage',
  'assassin',
  'support',
  'swarm',
]
