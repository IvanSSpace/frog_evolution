# Phase 22: Carrier merge redesign — Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Source:** PRD Express Path (`frog_obsidian/Design Notes/2026-05-17-carrier-merge-redesign.md`)

<domain>
## Phase Boundary

Полная пересборка carrier-механики: перевод на two-stage carrier life. Серум теряет rarity, carrier стартует с L1 и развивается через стандартный merge до L18. На достижении L18 carrier автоматически возносится (ascension): исчезает с поля, освобождает слот, дает перманентный archetype-bonus + one-shot essence reward.

Добавляется cosmic shop с двумя валютами (серум + essence). Серум-машинерия gate'ится за cosmos unlock (L18+L18 sentinel).

Удаляется значительный объём существующего кода: rarity tiers, mergeCarriers, feed-stabilize awakening mechanic.

**Scope target:** ~23 часа работы. Demo-build качество.

**Out of scope:** colonies на планетах, 64 уникальных archetype buffs, Bestiary visual rework, diminishing returns на bonus pool.

</domain>

<decisions>
## Implementation Decisions

### Serum Model
- Один тип серума, без rarity tier. Все серумы эквивалентны.
- Apply на любую обычную frog любого уровня → carrier того же уровня с element tag.
- Дроп серума: Star Map missions, mega-box drop.
- Опц. (балансировка): carrier на поле тикает крошечные serum-fragment в фоне (10 fragments = 1 серум).

### Carrier Lifecycle
- Carrier = обычная frog + element tag + aura overlay.
- Развивается через **стандартный merge** до L18.
- На достижении L18 ascends instantly (без дополнительного merge):
  - Carrier исчезает с поля
  - Слот освобождается
  - Перманентный archetype bonus добавляется в global pool
  - One-shot essence reward

### Merge Rules
- `normal Ln + normal Ln → normal L(n+1)` (existing)
- `carrier Ln + normal Ln → carrier L(n+1)` — element from carrier
- `carrier Ln + carrier Ln → carrier L(n+1)` — element **target** (drop-on) survives
- `normal L18 + normal L18 → cosmos unlock sentinel` (existing)
- `carrier reaches L18 → ascend instantly` (no further merge needed)

### Archetype Bonuses
- 4 категории + "Прочее"
- Per ascended carrier values (placeholder, балансировка позже):

  | Категория | Архетипы | Bonus |
  |---|---|---|
  | Огонь | fire, plasma, war | +5% box drop speed |
  | Вода | water, forest, gas | +5% tractor gold |
  | Камень | crystal, mechanical, ring | +10% offline cap |
  | Тень | shadow, void, arcane, binary | +1% serum drop |
  | Прочее | ice, toxic, desert | +3% flat gold |

- Линейно стэкается. Soft cap = 16 slots на поле.
- Видны в HUD-строке вверху экрана: `+8% gold, +4% box speed, …`. Click → tooltip с breakdown по carrier'ам.

### Currency Model
- **Gold** — tractor offline, sale → base upgrades, frog shop (existing).
- **Серум** — Star Map mission, mega-box drop → apply on frog, trade-up в cosmic shop.
- **Essence** — ascension (lump per MAX carrier), Star Map secondary → cosmic shop perma upgrades.

### Cosmic Shop Items
- Cosmic box (L7+ frogs ×3) — essence
- Permanent slot +1 — essence (scaling cost)
- Permanent ship speed +5% — essence (scaling cost)
- Permanent serum-drop chance +0.5% — essence (scaling cost)
- Skip ship cooldown — серум
- Trade-up: 3 серума → bonus drop — серум

Конкретные цены — placeholder, балансировка позже.

### Cosmos Gate
- Серум-машинерия (apply, carriers, Star Map missions, cosmic shop) доступна **только после первого unlock'а Cosmos** (текущий L18+L18 sentinel).
- До unlock:
  - Серум не дропается из mega-box
  - SerumBar скрыт
  - Cosmic Hub недоступен
  - Star Map недоступна

### Code Cleanup (destructive)
Удалить (на 100%, не deprecate):
- `Rarity` enum в `client/src/store/cosmic/types.ts`
- `RARITY_TO_STARTING_LEVEL` mapping (`server/src/config/cosmic.ts` + client mirror)
- `rarityRoll.ts` — упростить до boolean «дропнулся серум или нет»
- `applySerum` server validation на rarity-eligibility — упростить
- `mergeCarriers` action в `cosmic/slice.ts`
- `client/src/utils/serumEligibility.ts`
- Feed-stabilize awakening mechanic (вся ветка stabilized state + UI)

### Claude's Discretion
- Внутренняя реализация ascension tween (короткий visual, использовать существующий `ElementAuraOverlay`)
- HUD layout «active bonuses» строки (компонент существует — добавить или интегрировать в существующий)
- Структура cosmic shop UI (новая модалка / extension существующего CosmicHub)
- State shape для archetype bonus pool (вычисляемое из активных carriers vs persisted)
- Server validation для carrier+carrier merge (target element survives)
- Migration path для существующих сейв'ов (carriers с rarity → strip rarity)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Spec (Source of Truth)
- `frog_obsidian/Design Notes/2026-05-17-carrier-merge-redesign.md` — Полный дизайн редизайна. Все mechanics, currency model, archetype bonuses, cleanup list, gating.

### Glossary (relevant terms)
- `frog_obsidian/Glossary/Сыворотка.md` — текущее состояние серума (будет переписан после реализации)
- `frog_obsidian/Glossary/Пробуждённая лягушка.md` — устаревает после редизайна
- `frog_obsidian/Glossary/Стабилизация.md` — устаревает после редизайна
- `frog_obsidian/Glossary/Редкость сыворотки.md` — устаревает после редизайна
- `frog_obsidian/Glossary/Эффект архетипа.md` — обновится под 4-категорную схему
- `frog_obsidian/Glossary/Капитан.md` — L18+L18 sentinel для cosmos gate
- `frog_obsidian/Glossary/Звёздная карта.md` — Star Map gate

### Codebase Touchpoints
- `frog_evolution_code/client/src/store/cosmic/types.ts` — Carrier, Rarity, cosmic state types
- `frog_evolution_code/client/src/store/cosmic/slices/serumSlice.ts` — applySerum (async optimistic + rollback)
- `frog_evolution_code/client/src/store/cosmic/slice.ts` — mergeCarriers (to delete)
- `frog_evolution_code/client/src/api/cosmic.ts` — API wrappers
- `frog_evolution_code/server/src/routes/cosmic.ts` — POST /game/cosmic/apply-serum endpoint
- `frog_evolution_code/server/src/config/cosmic.ts` — RARITY_TO_STARTING_LEVEL (to delete)
- `frog_evolution_code/client/src/utils/serumEligibility.ts` — client mirror (to delete)
- `frog_evolution_code/client/src/game/scenes/main/MergeController.ts` — merge logic (extend for carrier+normal, carrier+carrier rules)
- `frog_evolution_code/client/src/game/effects/ElementAuraOverlay.ts` — aura visuals (reuse for ascension tween)
- `frog_evolution_code/client/src/game/effects/elementAuraSpecs.ts` — 15 aura specs (keep)
- `frog_evolution_code/client/src/components/SerumBar.tsx` — серум inventory UI (simplify, no rarity)
- `frog_evolution_code/client/src/ui/components/LocationStack.tsx` — Star Map gate

### Planning Context
- `.planning/STATE.md` — текущее состояние проекта
- `.planning/ROADMAP.md` — Phase 22 entry, deps on Phase 20
- `.planning/REQUIREMENTS.md` — milestone requirements

</canonical_refs>

<specifics>
## Specific Ideas

- **Ascension tween:** короткий scale + fade + aura pulse используя существующий `ElementAuraOverlay` (~30 строк). Не новый art.
- **Carrier+carrier merge rule:** target survives. Player контролирует через drag direction (drag A onto B → B's element wins).
- **HUD bonuses строка:** одна строка вверху, читается слева направо. Кликабельна → tooltip с per-carrier breakdown.
- **Cosmos gate enforcement:** проверять через существующий `markDiscovered(19)` sentinel из `MergeController.ts`. Если не unlocked — все серум-related UI компоненты скрыты (use existing show/hide patterns from SerumBar).
- **Двух-валютная модель:** серум как short-term currency (быстро циркулирует), essence как long-term (только от ascensions). Стандартный idle game pattern.

</specifics>

<deferred>
## Deferred Ideas

- **Колонии carrier'ов на планетах** — отдельная фича, требует art, отложено indefinitely.
- **64 уникальных archetype buffs** — заменены 4-категорной схемой.
- **Bestiary visual rework** — отдельная фаза если потребуется.
- **Diminishing returns** на archetype bonus pool — может добавиться в balance phase.
- **Carrier-on-field serum-fragment tick** — решим при балансировке (не блокирует Phase 22 реализацию).
- **Migration UI** для существующих сейвов с rarity-carriers — если потребуется, отдельный pass.
- **Глоссарий cleanup** в obsidian — после реализации, отдельным sweep'ом.

</deferred>

---

*Phase: 22-carrier-merge-redesign*
*Context gathered: 2026-05-17 via PRD Express Path*
