import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from './ui/components/Header'
import { BottomBar } from './ui/components/BottomBar'
import { ShopModal } from './ui/components/ShopModal'
import { FrogShopModal } from './ui/components/FrogShopModal'
import { ExpeditionModal } from './ui/components/ExpeditionModal'
import { JourneyMissionSelect } from './ui/components/JourneyMissionSelect'
import {
  startLoc2FrogFactory,
  stopLoc2FrogFactory,
} from './game/factory/loc2FrogFactory'
import { InventoryModal } from './ui/components/InventoryModal'
import { DronerModal } from './ui/components/DronerModal'
import { EctoDronerModal } from './ui/components/EctoDronerModal'
import { EvolutionModal } from './ui/components/EvolutionModal'
import { ConveyorModal } from './ui/components/ConveyorModal'
import { Loc3LottieTest } from './ui/components/Loc3LottieTest'
import { FireLevelsModal } from './ui/components/FireLevelsModal'
import { startExpedition } from './api/expedition'
import { WelcomeBackModal } from './ui/components/WelcomeBackModal'
import { DiscoveryModal } from './ui/components/DiscoveryModal'
import { RareCrateModal } from './ui/components/RareCrateModal'
import { SettingsModal } from './ui/components/SettingsModal'
import { LocationStack } from './ui/components/LocationStack'
import { StarMapHUD } from './ui/components/StarMapHUD'
import { ShipFollowButton } from './ui/components/ShipFollowButton'
import { OrientationLock } from './ui/components/OrientationLock'
import { LoadingScreen } from './ui/components/LoadingScreen'
import { eventBus } from './store/eventBus'
import { initSfx } from './audio/sfxBootstrap'
import { initPlanetVoice } from './audio/planetVoice'
import { useGameStore } from './store/gameStore'
import { saveDiscovered } from './store/persistence'
import type { Element } from './store/cosmic/types'
import { GalleryModal } from './components/Gallery/GalleryModal'
import { GalleryDetailModal } from './components/Gallery/GalleryDetailModal'
import { MilestoneToast } from './components/CosmicHub/bestiary/MilestoneToast'
import { AchievementToast } from './ui/components/AchievementToast'
import { MixerDevPage } from './ui/components/MixerDevPage'
import { GooDialog } from './ui/components/GooDialog'
// import { TutorialOverlay } from './components/Tutorial/TutorialOverlay'  // disabled 2026-05-18 — Phase 23 onboarding replaces
import { OnboardingController } from './components/Onboarding/OnboardingController'
import { CaptainBirthModal } from './components/Captain/CaptainBirthModal'
import { EvolutionCeremony } from './components/Evolution/EvolutionCeremony'
import { installCaptainBirthController } from './components/Captain/captainBirthController'
import { StarUnionsModal } from './components/StarUnions/StarUnionsModal'
import { installBestiaryDevHelpers } from './utils/devHelpers'
import { installFrogTierDevHelpers } from './utils/devFrogTiers'
import { installOnboardingDevHelpers } from './utils/onboardingDevHelpers'
import { installCaptainBirthDevHelpers } from './utils/captainBirthDevHelpers'
import { installAchievementDevHelpers } from './utils/achievementDevHelpers'
import { installGooDialogDevHelpers } from './utils/gooDialogDevHelpers'
// Tech-debt 2026-05-19: DEV-only Telegram safe-area visual overlay.
// Tree-shaken из production через import.meta.env.DEV guard в самом компоненте
// + mount-site guard ниже. Toggle: window.__toggleTgSafeAreaDebug().
import {
  TelegramSafeAreaDebugOverlay,
  installTelegramSafeAreaDebugHelper,
} from './components/Debug/TelegramSafeAreaDebugOverlay'
import { devLog } from './utils/devLog'
import { pingHealth } from './api/client'
import { ensureLogin } from './api/auth'
import { loadGameState, startSync, stopSync } from './api/gameSync'
import { startGame } from './game/index'
import { useClanStore } from './store/clan/slice'
import { useShipsStore } from './store/ships/slice'

const queryClient = new QueryClient()

function App() {
  const [shopOpen, setShopOpen] = useState(false)
  const [frogShopOpen, setFrogShopOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [expeditionOpen, setExpeditionOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [dronerOpen, setDronerOpen] = useState(false)
  const [ectoDronerOpen, setEctoDronerOpen] = useState(false)
  const [evolutionOpen, setEvolutionOpen] = useState(false)
  const [conveyorOpen, setConveyorOpen] = useState(false)
  const [fireLevelsOpen, setFireLevelsOpen] = useState(false)
  const [clanOpen, setClanOpen] = useState(false)
  const [journeyOpen, setJourneyOpen] = useState(false)
  const [welcomeBack, setWelcomeBack] = useState<{
    earned: number
    hours: number
  } | null>(null)
  const [discovered, setDiscovered] = useState<number | null>(null)
  const [rareCrate, setRareCrate] = useState<{
    minLevel: number
    maxLevel: number
  } | null>(null)
  const [bootState, setBootState] = useState<'loading' | 'ready' | 'offline'>(
    'loading',
  )
  // Phaser догрузил базовые ассеты (MainScene.create) — убираем лоадер-оверлей.
  const [gameReady, setGameReady] = useState(false)
  // Держим лоадер ещё чуть после gameReady, чтобы полоса добежала до 100%.
  const [showLoader, setShowLoader] = useState(true)

  useEffect(() => {
    let cancelled = false

    initSfx()
    initPlanetVoice()

    async function boot() {
      // 1. Ping server
      const health = await pingHealth()
      if (cancelled) return

      if (health) {
        console.log('[server] ✓ alive at', new Date(health.ts).toISOString())
      } else {
        console.warn('[server] ✗ unreachable on boot')
      }

      // 2. Login
      const auth = await ensureLogin()
      if (cancelled) return

      if (!auth) {
        console.warn('[server] login failed — entering offline mode')
        setBootState('offline')
        return
      }

      console.log('[server] logged in as user', auth.user.id)
      useGameStore.getState().setCurrentUser({
        id: auth.user.id,
        username: auth.user.username ?? null,
        telegramId: auth.user.telegramId,
        devFlags: auth.user.devFlags ?? [],
      })

      // 3. Load state from server with timeout
      const TIMEOUT_MS = 5000
      const loaded = await Promise.race<boolean>([
        loadGameState(),
        new Promise<boolean>((r) => setTimeout(() => r(false), TIMEOUT_MS)),
      ])
      if (cancelled) return

      if (loaded) {
        console.log('[server] state loaded — server is primary')
        setBootState('ready')
      } else {
        console.warn(
          '[server] state load failed or timeout — using localStorage',
        )
        setBootState('offline')
      }

      // 4. Post-load: offline box drops
      // Offline box drops: пока игрок был away, боксы должны были падать.
      // Расчёт: offlineMs с сервера / dropInterval = сколько боксов «должно было» упасть.
      // Реальное распределение по полю делает MainScene через pendingBoxCount —
      // с учётом ENTITY_CAP / MAX_PENDING_BOXES.
      // Goo Collector offline income теперь server-authoritative — см. gameSync.ts.

      // 5. Start auto-sync subscribers
      startSync()

      // 6. Background preload clan + ships — не блокируем boot, fire-and-forget
      void Promise.allSettled([
        useClanStore.getState().fetchClanMe(),
        useShipsStore.getState().fetchShips(),
      ])
    }

    boot()

    // Открытие нового вида лягушки
    const onDiscovered = ({ level }: { level: number }) => {
      devLog('[discovery] new level:', level)
      // Лёгкая задержка чтобы pop-анимация на поле успела сыграть
      setTimeout(() => setDiscovered(level), 250)
    }
    eventBus.on('frog:discovered', onDiscovered)

    const handleRareCrateOpened = ({
      x: _x,
      y: _y,
      minLevel,
      maxLevel,
    }: {
      x: number
      y: number
      minLevel: number
      maxLevel: number
    }) => {
      setRareCrate({ minLevel, maxLevel })
    }
    eventBus.on('rareCrate:opened', handleRareCrateOpened)

    const onWelcomeBack = ({
      earned,
      durationMs,
    }: {
      earned: number
      durationMs: number
    }) => {
      if (durationMs >= 60 * 60 * 1000) {
        setWelcomeBack({ earned, hours: durationMs / 3_600_000 })
      }
    }
    eventBus.on('server:welcome-back', onWelcomeBack)

    // Клик по зданию зоны строений → открыть соответствующую модалку.
    const onBuildingOpen = ({ modal }: { modal: string }) => {
      if (modal === 'inventory') setInventoryOpen(true)
      else if (modal === 'shop') setShopOpen(true)
      else if (modal === 'droner') setDronerOpen(true)
      else if (modal === 'ectoDroner') setEctoDronerOpen(true)
      // Чанк 2: фабрика конвейера. Чанк 1 задаёт opens:'conveyor' на здании.
      else if (modal === 'conveyor') setConveyorOpen(true)
      // Чанк 1: центр эволюции Loc3 (evoblock opens:'evolution').
      else if (modal === 'evolution') setEvolutionOpen(true)
      // Loc3 монумент: уровень горения огня. Чанк 1 задаёт opens:'fireLevels'.
      else if (modal === 'fireLevels') setFireLevelsOpen(true)
    }
    eventBus.on('building:open', onBuildingOpen)

    return () => {
      cancelled = true
      eventBus.off('frog:discovered', onDiscovered)
      eventBus.off('rareCrate:opened', handleRareCrateOpened)
      eventBus.off('server:welcome-back', onWelcomeBack)
      eventBus.off('building:open', onBuildingOpen)
      stopSync()
    }
  }, [])

  // Start Phaser only after state is hydrated (server or localStorage fallback)
  useEffect(() => {
    if (bootState === 'loading') return
    startGame()
  }, [bootState])

  // Лоадер-оверлей висит пока MainScene.create не отработает (базовые ассеты,
  // вкл. тяжёлый toxic_map2size, загружены). Safety-таймаут на случай если
  // event не придёт — не оставляем юзера на вечном лоадере.
  useEffect(() => {
    const onReady = () => setGameReady(true)
    eventBus.on('game:ready', onReady)
    const safety = window.setTimeout(() => setGameReady(true), 20000)
    return () => {
      eventBus.off('game:ready', onReady)
      window.clearTimeout(safety)
    }
  }, [])

  // После готовности даём полосе ~450мс добежать до 100%, потом прячем лоадер.
  useEffect(() => {
    if (!gameReady) return
    const id = window.setTimeout(() => setShowLoader(false), 450)
    return () => window.clearTimeout(id)
  }, [gameReady])

  // Завод loc2: пассивно производит L7-лягушек (самодостаточный модуль).
  useEffect(() => {
    startLoc2FrogFactory()
    return () => stopLoc2FrogFactory()
  }, [])

  // Phase 24 Plan 24-04: install Captain birth Beat 4 + Beat 5 coordinator.
  // Production-critical (НЕ DEV-only). Idempotent — повторный mount/StrictMode
  // не задублирует handler (см. captainBirthController.ts internal guard).
  useEffect(() => {
    installCaptainBirthController()
  }, [])

  // Космическая экспедиция: ShipDeckScene ↔ модалка. На «Снарядить» модалка
  // закрывается (видна Phaser-сцена). Сцена эмитит launch (старт экспедиции с
  // экипажем) или cancel → переоткрываем модалку.
  useEffect(() => {
    const onLaunch = ({
      shipId,
      crew,
      demo,
    }: {
      shipId: number
      crew: number[]
      demo: boolean
    }) => {
      void startExpedition(demo, shipId, crew)
        .catch(() => {})
        .finally(() => setExpeditionOpen(true))
    }
    const onCancel = () => setExpeditionOpen(true)
    eventBus.on('shipdeck:launch', onLaunch)
    eventBus.on('shipdeck:cancel', onCancel)
    return () => {
      eventBus.off('shipdeck:launch', onLaunch)
      eventBus.off('shipdeck:cancel', onCancel)
    }
  }, [])

  // Phase 16 (REQ UX-09): DEV-mode unlocks all sentinel flags + window dev helpers.
  // Production: флаги управляются gameplay (hasFirstMission через investigatePlanet,
  // hasFirstFeed/hasOpenedAnyBox в Phase 17/18). DEV — всё true для testability.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    // Defer на microtask чтобы dev tools видели init.
    queueMicrotask(() => {
      const cur = useGameStore.getState()
      if (!cur.hasFirstFeed) cur.setHasFirstFeed(true)
      if (!cur.hasFirstMission) cur.setHasFirstMission(true)
      if (!cur.hasOpenedAnyBox) cur.setHasOpenedAnyBox(true)
    })

    // Window-exposed dev helpers.
    const w = window as unknown as Record<string, unknown>

    w.__unlockAllTabs = () => {
      const s = useGameStore.getState()
      s.setHasFirstFeed(true)
      s.setHasFirstMission(true)
      s.setHasOpenedAnyBox(true)
      devLog('[dev] all tabs unlocked')
    }

    w.__lockAllTabs = () => {
      const s = useGameStore.getState()
      s.setHasFirstFeed(false)
      s.setHasFirstMission(false)
      s.setHasOpenedAnyBox(false)
      devLog('[dev] all tabs locked (simulating fresh prod install)')
    }

    w.__unlockAllLocations = () => {
      const levels = [1, 7, 13, 19]
      saveDiscovered(levels)
      useGameStore.setState({ discoveredLevels: levels })
      devLog('[dev] all locations unlocked + persisted')
    }

    w.__lockAllLocations = () => {
      saveDiscovered([])
      useGameStore.setState({ discoveredLevels: [] })
      devLog('[dev] all locations locked (back to start) + persisted')
    }

    w.__shipTo = (planetId: string) => {
      useGameStore.getState().arriveShipAt(planetId)
    }

    // Phase 22: rarity removed; addSerum(element, count)
    w.__grantSerum = (element: Element, count = 1) => {
      useGameStore.getState().addSerum(element, count)
      devLog(`[dev] granted ${count}× ${element} serum`)
    }

    // Phase 18: bestiary dev helpers (window.__unlockBestiaryCells / __bestiaryCount / __resetBestiary).
    installBestiaryDevHelpers()
    // 2026-05-24: frog tier visual comparison (window.__spawnTierRow(level)).
    installFrogTierDevHelpers()
    // Phase 23 Plan 23-01: onboarding dev helpers (__resetOnboarding / __skipOnboarding).
    installOnboardingDevHelpers()
    // Phase 24 Plan 24-05: captain birth dev helpers
    // (__triggerCaptainBirth / __resetCaptainBirth / __captainBirthState).
    installCaptainBirthDevHelpers()
    // Ачивки: dev-тест уведомления (__testAchievement(id?) / __listAchievements()).
    installAchievementDevHelpers()
    // Онбординг-диалог goo_collector: dev-вызов (__gooDialog(text?, title?)).
    installGooDialogDevHelpers()
    // Tech-debt 2026-05-19: TG safe-area overlay helper
    // (__toggleTgSafeAreaDebug / __tgSafeAreaDebug). Default OFF.
    const tgSafeAreaDevCleanup = installTelegramSafeAreaDebugHelper()

    return () => {
      delete w.__unlockAllTabs
      delete w.__lockAllTabs
      delete w.__unlockAllLocations
      delete w.__lockAllLocations
      delete w.__shipTo
      delete w.__grantSerum
      delete w.__unlockBestiaryCells
      delete w.__bestiaryCount
      delete w.__resetBestiary
      delete w.__resetOnboarding
      delete w.__skipOnboarding
      delete w.__triggerCaptainBirth
      delete w.__resetCaptainBirth
      delete w.__captainBirthState
      // Tech-debt 2026-05-19: TG safe-area helper cleanup.
      tgSafeAreaDevCleanup()
    }
  }, [])

  const handleRareCrateClaim = (wonLevel: number) => {
    setRareCrate(null)
    // Deferred emit — даём React закоммитить unmount модалки (useModalLock cleanup
    // → setPhaserInputEnabled(true)) ДО спавна frog'а. Иначе body.setInteractive
    // регистрируется пока Phaser input disabled, и draggable не активируется.
    setTimeout(() => {
      eventBus.emit('rareCrate:claim', { level: wonLevel })
    }, 0)
  }

  if (bootState === 'loading') {
    return (
      <>
        <OrientationLock />
        <LoadingScreen />
      </>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <OrientationLock />
      {/* Лоадер поверх всего пока Phaser не догрузил базовые ассеты. UI снизу
          уже смонтирован (нужен #game-canvas), оверлей прячет pop-in. */}
      {showLoader && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
          <LoadingScreen done={gameReady} />
        </div>
      )}
      {bootState === 'offline' && !import.meta.env.DEV && (
        <div className="fixed top-4 left-4 z-50 bg-amber-700/90 text-white px-3 py-2 rounded text-xs">
          Offline режим — изменения не сохраняются
        </div>
      )}
      <div className="w-full h-full flex flex-col">
        <div
          style={{
            height: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad))',
          }}
        >
          <Header onOpenIncome={() => setGalleryOpen(true)} />
        </div>
        <div className="flex-1" />
        <div style={{ height: '9%' }}>
          <BottomBar
            onOpenShop={() => setShopOpen(true)}
            onOpenFrogShop={() => setFrogShopOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenExpedition={() => setExpeditionOpen(true)}
            onOpenInventory={() => setInventoryOpen(true)}
            onOpenClan={() => setClanOpen(true)}
            onOpenJourney={() => setJourneyOpen(true)}
          />
        </div>
      </div>

      <StarMapHUD />
      <ShipFollowButton />
      {/* 2026-05-29: SerumBar убран с поля — серумы теперь применяются только
         из InventoryModal (см. InvSlot → Применить). */}
      <LocationStack />

      {galleryOpen && <GalleryModal onClose={() => setGalleryOpen(false)} />}
      <GalleryDetailModal />
      {shopOpen && <ShopModal onClose={() => setShopOpen(false)} />}
      {frogShopOpen && <FrogShopModal onClose={() => setFrogShopOpen(false)} />}
      {journeyOpen && (
        <JourneyMissionSelect onClose={() => setJourneyOpen(false)} />
      )}
      {expeditionOpen && (
        <ExpeditionModal onClose={() => setExpeditionOpen(false)} />
      )}
      {dronerOpen && <DronerModal onClose={() => setDronerOpen(false)} />}
      {ectoDronerOpen && (
        <EctoDronerModal onClose={() => setEctoDronerOpen(false)} />
      )}
      {evolutionOpen && (
        <EvolutionModal onClose={() => setEvolutionOpen(false)} />
      )}
      {conveyorOpen && <ConveyorModal onClose={() => setConveyorOpen(false)} />}
      <Loc3LottieTest />
      {fireLevelsOpen && (
        <FireLevelsModal onClose={() => setFireLevelsOpen(false)} />
      )}
      {inventoryOpen && (
        <InventoryModal onClose={() => setInventoryOpen(false)} />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {clanOpen && <StarUnionsModal onClose={() => setClanOpen(false)} />}
      {/* Phase 18 (REQ BESTIARY-07): milestone toast — listens cosmic:bestiary-milestone
          event from cosmicSlice.setBestiaryBit; visible regardless of Cosmic Hub state. */}
      <MilestoneToast />
      <AchievementToast />
      <GooDialog />
      {/* Phase 19-05 (UX-08): tutorial overlay — DISABLED 2026-05-18.
          Phase 23 onboarding (OnboardingController) полностью заменяет:
          - first-box → Phase 23 Beat 2 (tap hint banner)
          - first-serum → отдельная Phase 23 фича (TBD)
          - first-feed → устарел (Phase 22 убрал feed механику)
          - first-stabilize → устарел (Phase 22 убрал stabilize)
          Дублирующиеся подсказки на разных позициях экрана = user complaint. */}
      {/* <TutorialOverlay /> */}
      {/* Phase 23 Plan 23-01: onboarding coordinator (Wave 1 — empty shell;
          Plan 23-02..05 add Welcome / TapHint / MergeDemo / LocationCelebration overlays). */}
      <OnboardingController />
      {/* Phase 24 Plan 24-04: Captain birth modal — self-subscribes к
          eventBus 'captain:birth-effect-complete' (Plan 24-02), null-render'ит
          когда invisible. Cinematic trigger — MergeController L18+L18 branch. */}
      <CaptainBirthModal />
      {/* Phase Evolution: Pokemon-style evolution ceremony — self-subscribes к
          eventBus 'frog:evolution-ceremony' (эмитит FrogShopModal после
          успешного upgradeFrogTier), null-render'ит когда invisible. */}
      <EvolutionCeremony />
      {discovered !== null && (
        <DiscoveryModal
          level={discovered}
          onClose={() => setDiscovered(null)}
        />
      )}
      {rareCrate && (
        <RareCrateModal
          minLevel={rareCrate.minLevel}
          maxLevel={rareCrate.maxLevel}
          onClose={handleRareCrateClaim}
        />
      )}
      {welcomeBack && (
        <WelcomeBackModal
          earned={welcomeBack.earned}
          hours={welcomeBack.hours}
          onClose={() => setWelcomeBack(null)}
        />
      )}
      {/* Tech-debt 2026-05-19: DEV-only Telegram safe-area visual overlay.
          import.meta.env.DEV guard здесь + повторный guard внутри компонента
          → Vite tree-shake'ит и mount-site, и сам компонент в production. */}
      {import.meta.env.DEV && <TelegramSafeAreaDebugOverlay />}
      {import.meta.env.DEV && <MixerDevPage />}
    </QueryClientProvider>
  )
}

export default App
