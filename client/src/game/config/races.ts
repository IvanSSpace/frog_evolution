// Phase 26 Plan 26-01: 10 alien races foundation data model.
//
// Pure config (no runtime side-effects). Source of truth for:
//   - RaceId union (10 string literals) — used by cosmic state, eventBus consumers,
//     planetMap inhabitant typing (Plan 26-02), star map rendering (Plan 26-03),
//     Inventory tab listing (Plan 26-04), first-contact controller (Plan 26-05).
//   - RACES readonly array (order = таблица из 26-CONTEXT, crystalloids первой).
//   - RACES_BY_ID O(1) lookup (built через явный typed `for` loop, не Object.fromEntries
//     — TS теряет literal-key типизацию при fromEntries).
//   - getRaceColor / getRaceAffinity helpers — single import surface для downstream.
//
// homeColor reuse Phase 19-06 colorblind-safe palette (ELEMENT_TINTS). Если в будущем
// потребуется per-race override (например тон gold halo для home planets), добавить
// optional override field в RaceConfig и fallback на ELEMENT_TINTS[affinity].
//
// emojiIcon — fallback strategy per CONTEXT D-PlaceholderStrategy: emoji + race color
// в Phase 26, заменим на SVG assets когда user предоставит. Не добавляем `iconPath`
// до тех пор — `placeholder` это feature, не TODO.

import type { Element } from '../../store/cosmic/types'
import { ELEMENT_TINTS } from '../effects/elements/elementTints'

/**
 * Union из 10 race id'шек (kebab-style string literals).
 * Single source of truth для всего race-aware кода.
 *
 * Порядок соответствует таблице 26-CONTEXT.md `## 10 Races (полный лор)`.
 */
export type RaceId =
  | 'crystalloids'
  | 'mechanidons'
  | 'fireworms'
  | 'liquidoids'
  | 'tenebrians'
  | 'plasmaspirits'
  | 'forestcores'
  | 'timeweavers'
  | 'cometfolk'

/**
 * Per-race конфиг.
 *
 * Все text-bearing поля — i18n keys (resolved via `t(nameKey)` в UI). Pattern:
 * `races.{id}.{name|lore_short|personality|communication_style|home_planet_name}`.
 *
 * `emojiIcon` — fallback placeholder visual (per CONTEXT D-PlaceholderStrategy).
 * `homeColor` — Phaser hex для glow вокруг habitable planets (Plan 26-03);
 * defaults to `ELEMENT_TINTS[affinity]` чтобы reuse colorblind-safe palette,
 * но может быть override'нут если нужен distinct race color.
 */
export interface RaceConfig {
  id: RaceId
  /** i18n key e.g. `races.crystalloids.name` */
  nameKey: string
  /** Matches existing 16-element union (Element тип из cosmic/types). */
  affinity: Element
  /** Fallback emoji от affinity — placeholder до SVG assets. */
  emojiIcon: string
  /** Phaser hex; default = ELEMENT_TINTS[affinity]. */
  homeColor: number
  /** i18n key e.g. `races.crystalloids.personality` */
  personalityKey: string
  /** i18n key e.g. `races.crystalloids.communication_style` */
  communicationStyleKey: string
  /** i18n key e.g. `races.crystalloids.lore_short` */
  loreShortKey: string
  /** i18n key e.g. `races.crystalloids.home_planet_name` */
  homePlanetNameKey: string
}

/**
 * Все 10 рас в каноническом порядке (CONTEXT.md table).
 *
 * Affinity mapping (из 26-CONTEXT D-Races-Lore table):
 *   crystalloids→crystal, mechanidons→mechanical, fireworms→fire,
 *   liquidoids→water, tenebrians→shadow, plasmaspirits→plasma, forestcores→forest,
 *   timeweavers→void, cometfolk→binary.
 */
export const RACES: readonly RaceConfig[] = [
  {
    // Кристаллозиды — кремниевая жизнь, кристаллические друзы. Холодные/мудрые/медленные.
    id: 'crystalloids',
    nameKey: 'races.crystalloids.name',
    affinity: 'crystal',
    emojiIcon: '💎',
    homeColor: ELEMENT_TINTS.crystal,
    personalityKey: 'races.crystalloids.personality',
    communicationStyleKey: 'races.crystalloids.communication_style',
    loreShortKey: 'races.crystalloids.lore_short',
    homePlanetNameKey: 'races.crystalloids.home_planet_name',
  },
  {
    // Механидоны — гибрид био+машина. Структурированные, рациональные.
    id: 'mechanidons',
    nameKey: 'races.mechanidons.name',
    // 2026-05-23: серум `mechanical` удалён, переназначено на crystal.
    affinity: 'crystal',
    emojiIcon: '⚙️',
    homeColor: ELEMENT_TINTS.crystal,
    personalityKey: 'races.mechanidons.personality',
    communicationStyleKey: 'races.mechanidons.communication_style',
    loreShortKey: 'races.mechanidons.lore_short',
    homePlanetNameKey: 'races.mechanidons.home_planet_name',
  },
  {
    // Огнечервы — плазменные тела в звёздах. Воинственные, прямолинейные.
    id: 'fireworms',
    nameKey: 'races.fireworms.name',
    affinity: 'fire',
    emojiIcon: '🔥',
    homeColor: ELEMENT_TINTS.fire,
    personalityKey: 'races.fireworms.personality',
    communicationStyleKey: 'races.fireworms.communication_style',
    loreShortKey: 'races.fireworms.lore_short',
    homePlanetNameKey: 'races.fireworms.home_planet_name',
  },
  {
    // Жидко-сферы — амебоидная жидкая жизнь. Торговцы, гибкие.
    id: 'liquidoids',
    nameKey: 'races.liquidoids.name',
    affinity: 'water',
    emojiIcon: '💧',
    homeColor: ELEMENT_TINTS.water,
    personalityKey: 'races.liquidoids.personality',
    communicationStyleKey: 'races.liquidoids.communication_style',
    loreShortKey: 'races.liquidoids.lore_short',
    homePlanetNameKey: 'races.liquidoids.home_planet_name',
  },
  {
    // Тенебрисы — anti-matter, между измерений. Мистики, наблюдатели.
    id: 'tenebrians',
    nameKey: 'races.tenebrians.name',
    // 2026-05-23: серум `shadow` удалён, переназначено на toxic.
    affinity: 'toxic',
    emojiIcon: '🌑',
    homeColor: ELEMENT_TINTS.toxic,
    personalityKey: 'races.tenebrians.personality',
    communicationStyleKey: 'races.tenebrians.communication_style',
    loreShortKey: 'races.tenebrians.lore_short',
    homePlanetNameKey: 'races.tenebrians.home_planet_name',
  },
  {
    // Плазма-духи — плазменные сущности. Импульсивные, кочевники.
    id: 'plasmaspirits',
    nameKey: 'races.plasmaspirits.name',
    affinity: 'plasma',
    emojiIcon: '⚡',
    homeColor: ELEMENT_TINTS.plasma,
    personalityKey: 'races.plasmaspirits.personality',
    communicationStyleKey: 'races.plasmaspirits.communication_style',
    loreShortKey: 'races.plasmaspirits.lore_short',
    homePlanetNameKey: 'races.plasmaspirits.home_planet_name',
  },
  {
    // Лесо-кореня — грибная-корневая. Древние, спокойные.
    id: 'forestcores',
    nameKey: 'races.forestcores.name',
    affinity: 'forest',
    emojiIcon: '🌲',
    homeColor: ELEMENT_TINTS.forest,
    personalityKey: 'races.forestcores.personality',
    communicationStyleKey: 'races.forestcores.communication_style',
    loreShortKey: 'races.forestcores.lore_short',
    homePlanetNameKey: 'races.forestcores.home_planet_name',
  },
  {
    // Время-ткачи — вне-временные существа. Эзотерики, философы.
    id: 'timeweavers',
    nameKey: 'races.timeweavers.name',
    // 2026-05-23: серум `void` удалён, переназначено на binary.
    affinity: 'binary',
    emojiIcon: '🌀',
    homeColor: ELEMENT_TINTS.binary,
    personalityKey: 'races.timeweavers.personality',
    communicationStyleKey: 'races.timeweavers.communication_style',
    loreShortKey: 'races.timeweavers.lore_short',
    homePlanetNameKey: 'races.timeweavers.home_planet_name',
  },
  {
    // Кометники — кометно-облачные путешественники. Дружелюбные, открытые.
    id: 'cometfolk',
    nameKey: 'races.cometfolk.name',
    affinity: 'binary',
    emojiIcon: '☄️',
    homeColor: ELEMENT_TINTS.binary,
    personalityKey: 'races.cometfolk.personality',
    communicationStyleKey: 'races.cometfolk.communication_style',
    loreShortKey: 'races.cometfolk.lore_short',
    homePlanetNameKey: 'races.cometfolk.home_planet_name',
  },
] as const

/**
 * O(1) lookup by RaceId.
 *
 * Построен через явный `for` loop (НЕ Object.fromEntries — TypeScript теряет
 * literal-key типизацию для built-in fromEntries сигнатуры, тип получился бы
 * `Record<string, RaceConfig>` вместо `Record<RaceId, RaceConfig>`).
 */
export const RACES_BY_ID: Record<RaceId, RaceConfig> = (() => {
  const out = {} as Record<RaceId, RaceConfig>
  for (const race of RACES) {
    out[race.id] = race
  }
  return out
})()

/**
 * Helper: Phaser hex для glow/halo вокруг race home/colony planets (Plan 26-03).
 */
export function getRaceColor(raceId: RaceId): number {
  return RACES_BY_ID[raceId].homeColor
}

/**
 * Helper: archetype affinity (один из 16 Element литералов). Используется для
 * planet selection (Plan 26-02 матчит affinity с planet archetype) и для
 * cross-reference в Inventory (Plan 26-04).
 */
export function getRaceAffinity(raceId: RaceId): Element {
  return RACES_BY_ID[raceId].affinity
}
