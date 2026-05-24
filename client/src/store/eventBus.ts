import mitt from 'mitt'
import type { CosmicToastPayload, Element } from './cosmic/types'

// Phase 22: Rarity removed from cosmic types. Legacy rarity strings kept only
// in Gallery/Bestiary where they are UI-only (not serum/carrier state).
type LegacyRarity = 'common' | 'rare' | 'epic' | 'legendary'

type Events = {
  'goo:collected': { value: number }
  'frog:tapped': { frogId: string }
  'merge:happened': { level: number }
  'frog:pickup': { level: number }
  'frog:drop': { level: number; merged: boolean }
  'frog:purchased': { level: number }
  'frog:discovered': { level: number }
  'location:unlocked': { locationId: number }
  'location:changed': { id: number }
  'location:transitionStart': { from: number; to: number }
  'location:transitionEnd': { id: number }
  'rareCrate:opened': {
    x: number
    y: number
    minLevel: number
    maxLevel: number
  }
  'rareCrate:claim': { level: number }
  'starmap:open': void
  'starmap:close': void
  // Phase Barracks (2026-05-24) — PvP raid mode
  'battle:start': { locationId?: number; botId?: string }
  'battle:exit': Record<string, never>
  'starmap:planet-selected': {
    raceId: string
    raceName: string
    raceType: string
    domX: number
    domY: number
    placement: 'below' | 'above'
  }
  'starmap:planet-select': { planetId: string; name: string; archetype: string }
  'starmap:request-fly': { planetId: string }
  'starmap:planet-tapped': {
    id: string
    type: string
    archetype?: string
    durationMs: number
    seed: number
  }
  'starmap:planet-moved': {
    raceId: string
    bottomX: number
    bottomY: number
    topX: number
    topY: number
  }
  'starmap:popover-close': void
  'starmap:centerHome': void
  'starmap:goto-ship': void
  'starmap:follow-ship': { enable: boolean }
  'starmap:follow-changed': { following: boolean }
  'dev:clearAllFrogs': void
  // Cosmic Frogs System (Phase 11+)
  'cosmic:toast': CosmicToastPayload
  // Phase 14 — serum tap-to-select / drag-DnD
  // Phase 22: rarity removed from select-serum payload
  'cosmic:select-serum': { element: Element }
  'cosmic:cancel-serum': void
  'cosmic:serum-pointer-move': { x: number; y: number }
  'cosmic:serum-pointer-up': { x: number; y: number }
  // Phase 16 — ship + mission events
  'cosmic:request-flight': { planetId: string }
  'cosmic:flight-confirm': { planetId: string }
  'cosmic:flight-cancel': void
  'cosmic:ship-arrived': { planetId: string }
  // Phase 17 — carrier evolution (Phase 22: carrier-stabilized removed)
  // Phase 22 Plan 22-03 — carrier ascension event.
  // Emitted by ascendCarrier action after store mutation.
  // Subscribers: MainScene (play ascension tween), FrogOverlayManager (cleanup overlay).
  'cosmic:carrier-ascended': { frogId: string; element: Element }
  // Phase 22 Plan 22-05 — cosmic box purchased (shop).
  // Subscribers: MainScene spawn'ит 3 L7+ frogs на текущей локации.
  'cosmic:cosmic-box-purchased': Record<string, never>
  // Phase 19-01 — box-opened event.
  // Phase 22: rarity removed from box-opened payload.
  'cosmic:box-opened': { boxId: string; element: Element }
  // Offline box drops (boot-time): сколько боксов «упало» пока игрок был away.
  'box:offline-pending': { count: number }
  // Server-authoritative tractor offline income (boot-time).
  'server:welcome-back': { earned: number; durationMs: number }
  // Gallery — open detail panel for a specific archetype/rarity (UI-only, legacy rarity)
  'gallery:open-detail': { archetype: Element; rarity: LegacyRarity }
  // Phase 18 — bestiary milestone (REQ BESTIARY-07)
  'cosmic:bestiary-milestone': {
    threshold: 10 | 24 | 96 | 576
    reward:
      | { readonly type: 'coins'; readonly amount: number }
      | { readonly type: 'serum' }
      | { readonly type: 'frog-exclusive' }
  }
  // Phase 23 Plan 23-03 — onboarding tap-hint (Beat 2).
  // Emitted by BoxController when the very first box lands и
  // (welcomeSeen=true && firstBoxTapSeen=false). Subscribers:
  //   - TapHintOverlay (DOM «Тапни 👆» label, позиционируется по {x,y,width}).
  // boxId — locally-generated stable id, чтобы dismiss event умел сопоставлять.
  // width — boxes display-width (CSS px включая DPR), используем для anchor'а
  // под рингом.
  'tutorial:firstBoxSpawned': {
    x: number
    y: number
    boxId: string
    width: number
  }
  // Emitted при первом tap'е ЛЮБОГО бокса в onboarding'е.
  // Subscribers: TapHintOverlay (fade-out), BoxController (destroy ring),
  // OnboardingController (no-op, реагирует на store change).
  'tutorial:firstBoxTapped': { boxId: string }
  // Phase 23 Plan 23-05 — Beat 4 location celebration coordination
  // между React HUD и Phaser.
  // 'Start' эмитит OnboardingController при первом 'location:unlocked' для
  // данного locationId (idempotent через locationsCelebrated guard).
  // Подписчики:
  //   - LocationUnlockCelebration (DOM toast slide-up snizu)
  //   - LocationStack (pulse ring + glow + bobble на новой location button)
  // 'Dismiss' эмитит LocationStack при tap на pulsing button —
  // гасит pulse + dismiss'ит toast если он ещё не auto-faded.
  'onboarding:locationCelebrationStart': { locationId: number }
  'onboarding:locationCelebrationDismiss': { locationId: number }
  // Phase 23 Plan 23-04 — Beat 3 (Merge demo).
  // 'mergeDemoStart' эмитит OnboardingController когда trigger совпал
  // (welcomeSeen + firstBoxTapSeen + !firstMergeSeen + ≥2 L1 carrier-free frogs).
  // Используется DOM-overlay'ем MergeHintOverlay для anchor'а pill-label'а
  // между двумя frogs.
  // Game coords (Phaser pixels) — overlay сам конвертит в DOM через canvas rect.
  'tutorial:mergeDemoStart': {
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
  }
  // 'firstMerge' эмитит MergeController при первом successful merge ЛЮБЫХ
  // двух frogs (normal+normal / carrier+normal / carrier+carrier — все варианты).
  // Подписчики:
  //   - OnboardingController (cleanup rings + ghost trail, помечает firstMergeSeen
  //     если ещё не помечен auto-fade'ом).
  //   - MergeHintOverlay (hide label, показывает one-time success toast).
  // Idempotent — повторные merges после mark — no-op для подписчиков.
  'tutorial:firstMerge': void
  // Phase 24 Plan 24-01 — Captain creation cinematic coordination.
  // 'captain:birth-start' эмитит MergeController (Plan 24-04) после первого
  // L18+L18 normal merge. Subscribers:
  //   - CaptainBirthEffect (Plan 24-02, Phaser): plays cosmic growing effect
  //     (particles + 3 rings + camera zoom) в данной точке.
  // Coords — Phaser game-pixels (cx, cy из merge midpoint).
  'captain:birth-start': { x: number; y: number }
  // 'captain:birth-effect-complete' эмитит CaptainBirthEffect когда Phaser-эффект
  // отыграл (~3 сек). Subscribers:
  //   - CaptainBirthModal (Plan 24-03, DOM): mount modal с frog + glow + CTA.
  'captain:birth-effect-complete': void
  // Phase 24 Plan 24-03 — Captain Birth modal CTA / dismiss.
  // Эмитит CaptainBirthModal когда пользователь tap'нул CTA «В космос»
  // (либо backdrop click). Subscribers:
  //   - Plan 24-04 hook: spawn L1 frog (Beat 4) + eventBus.emit('starmap:open') (Beat 5).
  // Idempotent: повторные emit'ы no-op для subscribers (modal one-shot).
  'captain:birth-cta': void
  // Phase 26 Plan 26-01 — first contact narrative trigger.
  // Эмитит FirstContactController (Plan 26-05) после user visit'а habitable
  // planet (inhabitant.role === 'home' OR 'colony') если
  // firstContactsSeen[raceId] === false. x, y — экранные координаты planet'ы
  // (anchor для Phaser cinematic light burst, per CONTEXT.md First Contact Event).
  // raceId: string а не `RaceId` намеренно — eventBus.ts избегает импорта RaceId
  // чтобы не создать цикл eventBus → cosmic/slice → races → cosmic/types → eventBus.
  // Consumer (Plan 26-05 FirstContactController) делает narrow cast.
  // Pattern consistent с LegacyRarity (локальный type в eventBus.ts).
  'cosmos:first-contact': { raceId: string; x: number; y: number }
  // Phase 26 Plan 26-05 — first contact Phaser cinematic completion.
  // Эмитит FirstContactEffect (Plan 26-05) после ~2s cinematic'а закончился.
  // Subscribers:
  //   - FirstContactController (mount'ит DOM FirstContactModal с race lore).
  // Безопасно если scene отсутствует — emitter эмитит next-tick fallback чтобы
  // controller не залип в pending state.
  'cosmos:first-contact-effect-complete': void
  // Phase 27 Plan 27-03 — relationship change broadcast.
  // Emitted by slice actions resolveAccept / resolveRefuse and by triggerPendingPull
  // when event ChainItem changes a relationship. Subscribers:
  //   - RelationshipBar (Plan 27-04): pulse animation if tier changed.
  //   - Phase 28/29 may add analytics.
  // raceId: string (not RaceId) — mirror 'cosmos:first-contact' pattern to avoid the
  // eventBus → slice → races → types → eventBus cycle.
  'contacts:relationship-delta': {
    raceId: string
    oldValue: number
    newValue: number
    delta: number
  }
  // Phase 27 Plan 27-03 — event ChainItem auto-applied at pull time.
  // Emitted by triggerPendingPull when pendingEngineTick returns eventToasts.
  // Subscribers:
  //   - EventToast (Plan 27-05): mount top-screen banner with auto-dismiss 3s.
  'contacts:event-applied': {
    raceId: string
    targetRaceId: string
    delta: number
    textKey: string
  }
  // Phase 28 Plan 28-03 — quest activation broadcast.
  // Emitted by slice action activateQuestFromHook after successful activation
  // (cap not reached + questId known).
  // Subscribers:
  //   - Plan 28-04 QuestsTab (re-render active quest list with new entry).
  //   - Phase 29 may add analytics.
  // questId/raceId/activeQuestId typed as `string` (not QuestId/RaceId) — mirrors
  // Phase 27 pattern to avoid the eventBus → slice → races/quests → types → eventBus
  // dependency cycle. Subscribers narrow-cast on consumption.
  'quests:activated': {
    raceId: string
    questId: string
    activeQuestId: string
  }
  // Phase 28 Plan 28-03 — quest activation rejected due to cap.
  // Emitted by activateQuestFromHook when activeQuests.length >= ACTIVE_QUEST_CAP=5.
  // The quest_hook relationship +1 IS still applied (per CONTEXT D-Quest activation
  // cap path) — only the quest push is skipped.
  // Subscribers:
  //   - Plan 28-04 QuestsTab (toast «Лимит активных квестов»).
  'quests:cap-reached': { raceId: string; questId: string }
  // Phase 28 Plan 28-03 — quest completion + reward applied.
  // Emitted by markQuestProgress per quest reaching its target this tick.
  // Subscribers:
  //   - Plan 28-05 QuestRewardPopup (modal mount with reward summary).
  //   - Plan 28-04 QuestsTab (re-render: quest moves to completed history).
  // reward: imported QuestReward type — subscriber narrow-casts on consumption.
  // The `import('...')` form keeps the eventBus module free of value-imports from
  // the quests config (no top-level cycle risk; types are erased at compile time).
  'quests:completed': {
    raceId: string
    questId: string
    activeQuestId: string
    reward: import('../game/config/quests').QuestReward
  }
  // Phase 28 Plan 28-03 — quest cancelled by player.
  // Emitted by cancelQuest after removal + relationship -1 penalty.
  // Subscribers:
  //   - Plan 28-04 QuestsTab (re-render without the cancelled row).
  'quests:cancelled': {
    raceId: string
    questId: string
    activeQuestId: string
  }
}

export const eventBus = mitt<Events>()
