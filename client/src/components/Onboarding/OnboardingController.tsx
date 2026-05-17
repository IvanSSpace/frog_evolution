// Phase 23: Soft 4-beat onboarding coordinator.
//
// State machine:
//   Beat 1: Welcome modal (if !welcomeSeen) — Plan 23-02 ✓ integrated below
//   Beat 2: Tap-hint pulse (if welcomeSeen && !firstBoxTapSeen && box landed) — Plan 23-03 ✓
//   Beat 3: Merge demo (if firstBoxTapSeen && !firstMergeSeen && ≥2 L1 frogs) — Plan 23-04 ✓
//   Beat 4: Location celebration on 'location:unlocked' (if !locationsCelebrated[id]) — Plan 23-05 ✓
//
// Plan 23-04 (Beat 3) integration:
//   - useEffect watches: welcomeSeen + firstBoxTapSeen + !firstMergeSeen +
//     locationFrogs[currentLocation-1].count(L1) ≥ 2 (исключая carriers).
//   - Когда trigger совпал и `__mainScene` доступен:
//       a) Берёт 2 первых L1 carrier-free frogs из scene.frogs (Phaser-side).
//       b) Создаёт 2 TutorialPulseRing (frog-sized, smaller radius).
//       c) Эмитит 'tutorial:mergeDemoStart' с game-coords для MergeHintOverlay.
//       d) Запускает GhostFrogTrail (loops=3) между ними.
//       e) Подписывается на 'tutorial:firstMerge' → cleanup ring+ghost.
//       f) Подписывается на 'frog:pickup' → cancel ghost trail (rings stay).
//       g) Auto-fade через 8с: cleanup + markFirstMergeSeen().
//   - Cleanup в useEffect return — гасит rings/ghost/listeners/timer.
//   - useRef guard'ит идемпотентность — demo стартует один раз.
//
// IMPORTANT (memory feedback_clickability): все future beat overlays use
//   - <button type="button"> для интерактивных элементов
//   - z-index ≥ 100 чтобы сидеть выше Phaser canvas + LocationStack
//   - pointer-events handled explicitly на overlay root
//
// IMPORTANT (memory feedback_frog_container_alpha): do NOT tween frog.container.alpha
// для любого hint/highlight эффекта — добавь отдельный child sprite (что делает
// GhostFrogTrail — отдельный Phaser.Image, НЕ оригинальный frog).

import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { useGameStore } from '../../store/gameStore'
import { useOnboardingStore } from '../../store/onboarding/onboardingSlice'
import { eventBus } from '../../store/eventBus'
import { ConfettiBurst } from '../../game/effects/ConfettiBurst'
import { TutorialPulseRing } from '../../game/effects/TutorialPulseRing'
import { GhostFrogTrail } from '../../game/effects/GhostFrogTrail'
import { textureKeyForLevel } from '../../game/config/frogs'
import type { MainScene } from '../../game/scenes/MainScene'
import { WelcomeModal } from './WelcomeModal'
import { TapHintOverlay } from './TapHintOverlay'
import { MergeHintOverlay, MergeSuccessToast } from './MergeHintOverlay'
import { LocationUnlockCelebration } from './LocationUnlockCelebration'

// Confetti palettes per location (per CONTEXT.md):
//   2 — Болото: green/yellow swamp
//   3 — Лес:    green/brown forest
//   6 — Star Map (cosmos): cyan/violet
const CONFETTI_PALETTES: Record<number, number[]> = {
  2: [0xbef264, 0xfdd87a, 0x65a30d, 0xfacc15],
  3: [0x86efac, 0x15803d, 0xa16207, 0x854d0e],
  6: [0x67e8f9, 0x0e7490, 0xa78bfa, 0x6d28d9],
}

const MERGE_DEMO_AUTO_FADE_MS = 8000
const MERGE_DEMO_RING_RADIUS_PX = 38 // frog-sized: меньше чем box ring (Plan 23-03 ~50px)

export function OnboardingController() {
  // Per-flag selectors — каждый render зависит только от своего флага,
  // никаких лишних re-render'ов когда меняется чужой флаг.
  const welcomeSeen = useOnboardingStore((s) => s.welcomeSeen)
  // Plan 23-03: Beat 2 mount-условие — Welcome пройден, но Beat 2 ещё не seen.
  const firstBoxTapSeen = useOnboardingStore((s) => s.firstBoxTapSeen)
  // Plan 23-04: Beat 3 mount-условие.
  const firstMergeSeen = useOnboardingStore((s) => s.firstMergeSeen)
  // locationsCelebrated НЕ селекторим в render — Beat 4 чисто event-driven,
  // нет JSX-условия завязанного на эту карту (toast/pulse активируются по событиям).

  // gameStore для Beat 3 trigger: меняется при spawn/merge на текущей локации.
  const locationFrogs = useGameStore((s) => s.locationFrogs)
  const currentLocation = useGameStore((s) => s.currentLocation)
  const carriers = useGameStore((s) => s.carriers)

  // Idempotency guard — Beat 3 demo стартует ровно один раз за session
  // (даже если эффект re-run'ется при изменении locationFrogs/carriers).
  const demoStartedRef = useRef(false)

  // Beat 4: подписываемся на 'location:unlocked' и инициируем celebration.
  // Один раз на mount — store читаем snapshot'ом в обработчике, иначе useEffect
  // re-attach'ился бы при каждом mark и могли бы лишний раз re-bind listener
  // (или хуже — потерять in-flight event между cleanup и re-subscribe).
  useEffect(() => {
    const onUnlock = ({ locationId }: { locationId: number }) => {
      const palette = CONFETTI_PALETTES[locationId]
      if (!palette) return // unknown locationId — нет celebration assets
      const store = useOnboardingStore.getState()
      if (store.locationsCelebrated[locationId]) return // already celebrated
      store.markLocationCelebrated(locationId)

      // Phaser confetti — в центре canvas (если scene доступна).
      // MainScene exposes window.__mainScene (см. MainScene.create() Plan 23-05).
      const w = window as unknown as { __mainScene?: Phaser.Scene }
      const scene = w.__mainScene
      if (scene) {
        const canvas = scene.sys.game.canvas
        ConfettiBurst.fire({
          scene,
          x: canvas.width / 2,
          y: canvas.height / 2,
          palette,
        })
      }
      // DOM toast + LocationStack pulse — оба подписаны на этот event.
      eventBus.emit('onboarding:locationCelebrationStart', { locationId })
    }
    eventBus.on('location:unlocked', onUnlock)
    return () => {
      eventBus.off('location:unlocked', onUnlock)
    }
  }, [])

  // ===========================================================================
  // Beat 3: Merge demo coordinator.
  // ===========================================================================
  // Trigger: welcomeSeen && firstBoxTapSeen && !firstMergeSeen && ≥2 L1 frogs
  // (carrier-free) на current location. Эффект пересматривает условие при
  // каждом spawn/merge (locationFrogs change), но demoStartedRef блокирует
  // повторный запуск после первого старта.
  //
  // Cleanup: useEffect return гасит rings/ghost/listeners/timer когда:
  //   - firstMergeSeen становится true (controller flag flip)
  //   - component unmount'ится
  // Если cleanup приходит ДО firstMerge mark — пользователь сменил локацию или
  // overlay был unmount'ен по другой причине; demo прерывается gracefully.
  useEffect(() => {
    if (!welcomeSeen || !firstBoxTapSeen || firstMergeSeen) return
    if (demoStartedRef.current) return

    // Phaser scene access — exposed MainScene.create() (Plan 23-05).
    const w = window as unknown as { __mainScene?: MainScene }
    const scene = w.__mainScene
    if (!scene) return

    // Найдём 2 первых L1 carrier-free frog'а на сцене. scene.frogs — массив
    // FrogData с .container.x/.y/.active и .id/.level. Авторитативно для
    // позиций (locationFrogs из store содержит только levels — без coords).
    const carrierIds = new Set(carriers.map((c) => c.frogId))
    const l1Free = scene.frogs.filter(
      (f) =>
        f.level === 1 && !f.isMerging && !f.isDragging && !carrierIds.has(f.id),
    )
    if (l1Free.length < 2) return

    // Берём первых двух — порядок не критичен, важно лишь чтобы это были
    // два разных живых L1 frog'а на поле.
    const src = l1Free[0]
    const tgt = l1Free[1]

    demoStartedRef.current = true

    // 2 pulse rings — frog-sized, тоньше чем box ring.
    const ring1 = new TutorialPulseRing({
      scene,
      target: src.container,
      radius: MERGE_DEMO_RING_RADIUS_PX,
    })
    const ring2 = new TutorialPulseRing({
      scene,
      target: tgt.container,
      radius: MERGE_DEMO_RING_RADIUS_PX,
    })

    // Anchor для DOM label — capture coords ОДИН раз, потом frogs могут
    // подвинуться (idle wander), но label следовать не должен (не хочется
    // jitter'а pill'а). Если frogs ушли далеко за 8с — label остаётся над
    // их starting mid-point: acceptable trade-off.
    const sourceX = src.container.x
    const sourceY = src.container.y
    const targetX = tgt.container.x
    const targetY = tgt.container.y

    eventBus.emit('tutorial:mergeDemoStart', {
      sourceX,
      sourceY,
      targetX,
      targetY,
    })

    // Ghost trail — same texture как L1 frog. textureKeyForLevel(1) даёт
    // загруженный key из MainScene.preload (frog_lvl_1).
    // ВАЖНО: container.scaleX может быть НЕГАТИВНЫМ из-за FrogSpawner FlipX
    // (`(movingRight ? 1 : -1) * BASE_SCALE`). Negative scale на ghost даёт
    // огромный flipped frog + burst×1.3 → перекрывает весь viewport
    // (баг наблюдался 2026-05-18 — pink/тёмный полукруг на screenshot'е).
    // Используем Math.abs чтобы получить magnitude, и hard cap чтобы
    // защититься от случайных огромных scale значений.
    const rawScale = Math.abs(src.container.scaleX) || 1
    const ghostScale = Math.min(rawScale, 1.2)
    let ghost: GhostFrogTrail | null = new GhostFrogTrail({
      scene,
      textureKey: textureKeyForLevel(src.level),
      source: { x: sourceX, y: sourceY },
      target: { x: targetX, y: targetY },
      loops: 3,
      scale: ghostScale,
    })

    // На реальном merge ANY two frogs — MergeController emit'ит
    // 'tutorial:firstMerge' и mark'ает firstMergeSeen. React useEffect
    // re-run на изменении firstMergeSeen → cleanup вызовется.
    // Дополнительный onMerge listener гасит ghost trail немедленно
    // (чтобы не ждать React render cycle и не дать ghost'у мелькнуть
    // лишний раз поверх happening merge).
    const onMerge = () => {
      ghost?.destroy()
      ghost = null
      ring1.destroy()
      ring2.destroy()
    }
    eventBus.on('tutorial:firstMerge', onMerge)

    // Cancel ghost при реальном pickup (player начал drag во время demo).
    // Rings оставляем — продолжают подсказывать визуально куда тянуть.
    const onPickup = () => {
      ghost?.destroy()
      ghost = null
    }
    eventBus.on('frog:pickup', onPickup)

    // Auto-fade через 8с — если player ничего не сделал, гасим всё и
    // mark'аем seen чтобы demo не вернулась после reload.
    const autoFadeTimer = window.setTimeout(() => {
      ghost?.destroy()
      ghost = null
      ring1.destroy()
      ring2.destroy()
      // markFirstMergeSeen → useEffect re-run → cleanup (no-op, всё уже погашено).
      useOnboardingStore.getState().markFirstMergeSeen()
    }, MERGE_DEMO_AUTO_FADE_MS)

    return () => {
      clearTimeout(autoFadeTimer)
      eventBus.off('tutorial:firstMerge', onMerge)
      eventBus.off('frog:pickup', onPickup)
      ghost?.destroy()
      ring1.destroy()
      ring2.destroy()
    }
    // demoStartedRef.current служит идемпотентным guard'ом — ESLint может
    // ругаться на отсутствие в deps, но это сознательно: ref не должен
    // re-trigger'ить эффект.
  }, [
    welcomeSeen,
    firstBoxTapSeen,
    firstMergeSeen,
    locationFrogs,
    currentLocation,
    carriers,
  ])

  // WelcomeModal сам вызывает markWelcomeSeen() в конце своей fade-out animation;
  // как только store mutates, этот компонент re-render'ится с welcomeSeen=true
  // → WelcomeModal unmount'ится автоматически.
  //
  // LocationUnlockCelebration mount'ится unconditionally — сам управляет
  // visibility через event subscription. Это исключает race window между
  // 'location:unlocked' и conditional mount по store-флагу.
  //
  // MergeSuccessToast аналогично — always-mounted listener; подхватывает
  // 'tutorial:firstMerge' и живёт 3с независимо от MergeHintOverlay mount.
  return (
    <>
      {!welcomeSeen && <WelcomeModal />}
      {welcomeSeen && !firstBoxTapSeen && <TapHintOverlay />}
      {welcomeSeen && firstBoxTapSeen && !firstMergeSeen && (
        <MergeHintOverlay />
      )}
      <MergeSuccessToast />
      <LocationUnlockCelebration />
    </>
  )
}
