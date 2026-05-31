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
  // Pan камеры к указанной планете (по id из MAIN_RACES). Используется
  // для навигации в StarMap.
  'starmap:focus-planet': { planetId: string }
  // Космическая экспедиция: сцена снаряжения корабля (ShipDeckScene).
  'shipdeck:open': {
    shipId: number
    location: number
    minL: number
    maxL: number
    demo: boolean
  }
  'shipdeck:launch': { shipId: number; crew: number[]; demo: boolean }
  'shipdeck:cancel': Record<string, never>
  // Миссии-путешествия (авто-раннер). JourneyMissionSelect (React) собирает отряд
  // и эмитит journey:start → JourneyScene. По завершении сцена шлёт journey:complete
  // (награда уже начислена), выход — journey:exit (✕ или «На ферму»).
  'journey:start': { crew: number[]; missionId: string }
  'journey:complete': { missionId: string; reward: number; survivors: number }
  'journey:exit': Record<string, never>
  'starmap:planet-select': { planetId: string; name: string; archetype: string }
  'starmap:request-fly': { planetId: string }
  'starmap:planet-tapped': {
    id: string
    type: string
    archetype?: string
    durationMs: number
    seed: number
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
  // Тап по боксу на поле (раз на жест, не per-box) → лёгкий boxPop sfx.
  'box:tapOpened': Record<string, never>
  // Клик по зданию зоны строений → открыть связанную модалку (React слушает в App.tsx).
  'building:open': { modal: string }
  // Offline box fill: gameSync считает сколько боксов накопилось за AFK, MainScene выкладывает на поле.
  'boxes:offline-fill': { count: number }
  // Server-authoritative goo collector offline income (boot-time).
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
  // Phase Evolution — Pokemon-style evolution ceremony trigger.
  // Эмитит FrogShopModal.handleEvolve после успешного upgradeFrogTier(level).
  // Subscribers:
  //   - EvolutionCeremony (DOM overlay): old→flash→new + «Эволюция!» + бонус.
  // oldPath/newPath — SVG-пути тиров (getFrogPath), tint — цвет уровня.
  'frog:evolution-ceremony': {
    level: number
    newTier: number
    oldPath: string
    newPath: string
    tint: number
    name: string
    bonusPct: number
  }
  'field:toggleZone': void
  'field:zoneChanged': { zone: 'frogs' | 'buildings' }
  // MainScene.create завершён — базовые ассеты загружены, можно убрать лоадер.
  'game:ready': void
}

export const eventBus = mitt<Events>()
