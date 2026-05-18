import { lazy, Suspense, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from './ui/components/Header'
import { BottomBar } from './ui/components/BottomBar'
import { ShopModal } from './ui/components/ShopModal'
import { FrogShopModal } from './ui/components/FrogShopModal'
import { WelcomeBackModal } from './ui/components/WelcomeBackModal'
import { DiscoveryModal } from './ui/components/DiscoveryModal'
import { RareCrateModal } from './ui/components/RareCrateModal'
import { SettingsModal } from './ui/components/SettingsModal'
import { LocationStack } from './ui/components/LocationStack'
import { StarMapHUD } from './ui/components/StarMapHUD'
import { MagnetToggle } from './ui/components/MagnetToggle'
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
// import { TutorialOverlay } from './components/Tutorial/TutorialOverlay'  // disabled 2026-05-18 — Phase 23 onboarding replaces
import { OnboardingController } from './components/Onboarding/OnboardingController'
import { CaptainBirthModal } from './components/Captain/CaptainBirthModal'
import { installCaptainBirthController } from './components/Captain/captainBirthController'
import { FirstContactController } from './components/FirstContact/firstContactController'
import { EventToastController } from './components/Contacts/eventToastController'
// Phase 28 Plan 28-03: quest progress eventBus wiring + boot reconcile.
import { QuestController } from './game/quests/questController'
// Phase 28 Plan 28-05: quest reward popup controller — subscribes to
// 'quests:completed' and renders QuestRewardPopup for head of queue.
import { QuestRewardController } from './components/Quests/questRewardController'
import { SerumModal } from './components/CosmicHub/SerumModal'
import { SerumBar } from './components/SerumBar'
import { installBestiaryDevHelpers } from './utils/devHelpers'
import { installOnboardingDevHelpers } from './utils/onboardingDevHelpers'
import { installCaptainBirthDevHelpers } from './utils/captainBirthDevHelpers'
import { installRaceDevHelpers } from './utils/devRaces'
import { installContactsDevHelpers } from './utils/devContacts'
// Phase 28 Plan 28-03: quest DEV helpers (__activateQuest / __progressQuest /
// __completeQuest / __resetQuests / __dumpQuests).
import { installQuestDevHelpers } from './utils/devQuests'
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

const queryClient = new QueryClient()

// Phase 11: Cosmic Hub modal lazy-loaded → отдельный chunk, не утяжеляет main bundle
const CosmicHubModal = lazy(
  () => import('./components/CosmicHub/CosmicHubModal'),
)

function App() {
  const [shopOpen, setShopOpen] = useState(false)
  const [frogShopOpen, setFrogShopOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cosmicHubOpen, setCosmicHubOpen] = useState(false)
  const [serumOpen, setSerumOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
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
      // Tractor offline income теперь server-authoritative — см. gameSync.ts.

      // 5. Start auto-sync subscribers
      startSync()
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

    return () => {
      cancelled = true
      eventBus.off('frog:discovered', onDiscovered)
      eventBus.off('rareCrate:opened', handleRareCrateOpened)
      eventBus.off('server:welcome-back', onWelcomeBack)
      stopSync()
    }
  }, [])

  // Start Phaser only after state is hydrated (server or localStorage fallback)
  useEffect(() => {
    if (bootState === 'loading') return
    startGame()
  }, [bootState])

  // Phase 24 Plan 24-04: install Captain birth Beat 4 + Beat 5 coordinator.
  // Production-critical (НЕ DEV-only). Idempotent — повторный mount/StrictMode
  // не задублирует handler (см. captainBirthController.ts internal guard).
  useEffect(() => {
    installCaptainBirthController()
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

    w.__resetCrewToday = () => {
      useGameStore.setState((s) => ({
        crew: { ...s.crew, missionsToday: 0 },
      }))
      devLog('[dev] crew reset')
    }

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
    // Phase 23 Plan 23-01: onboarding dev helpers (__resetOnboarding / __skipOnboarding).
    installOnboardingDevHelpers()
    // Phase 24 Plan 24-05: captain birth dev helpers
    // (__triggerCaptainBirth / __resetCaptainBirth / __captainBirthState).
    installCaptainBirthDevHelpers()
    // Phase 26 Plan 26-01: race / first-contact dev helpers
    // (__listRaces / __markFirstContact / __resetFirstContacts / __firstContactsState).
    // Returns cleanup function для symmetric uninstall в useEffect return.
    const raceDevCleanup = installRaceDevHelpers()
    // Phase 27 Plan 27-03: contacts / relationship / chain dev helpers
    // (__addPending / __resetRelationships / __advanceChain / __dumpContacts).
    const contactsDevCleanup = installContactsDevHelpers()
    // Phase 28 Plan 28-03: quest mechanic dev helpers
    // (__activateQuest / __progressQuest / __completeQuest / __resetQuests /
    // __dumpQuests). Tree-shaken from production via import.meta.env.DEV guard.
    const questDevCleanup = installQuestDevHelpers()
    // Tech-debt 2026-05-19: TG safe-area overlay helper
    // (__toggleTgSafeAreaDebug / __tgSafeAreaDebug). Default OFF.
    const tgSafeAreaDevCleanup = installTelegramSafeAreaDebugHelper()

    return () => {
      delete w.__resetCrewToday
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
      // Phase 26 Plan 26-01: race dev helpers cleanup.
      raceDevCleanup()
      // Phase 27 Plan 27-03: contacts dev helpers cleanup.
      contactsDevCleanup()
      // Phase 28 Plan 28-03: quest dev helpers cleanup.
      questDevCleanup()
      // Tech-debt 2026-05-19: TG safe-area helper cleanup.
      tgSafeAreaDevCleanup()
    }
  }, [])

  const handleRareCrateClaim = (wonLevel: number) => {
    setRareCrate(null)
    eventBus.emit('rareCrate:claim', { level: wonLevel })
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
      {bootState === 'offline' && !import.meta.env.DEV && (
        <div className="fixed top-4 left-4 z-50 bg-amber-700/90 text-white px-3 py-2 rounded text-xs">
          Offline режим — изменения не сохраняются
        </div>
      )}
      <div className="w-full h-full flex flex-col">
        <div style={{ height: 'calc(12% + 54px)' }}>
          <Header />
        </div>
        <div className="flex-1" />
        <div style={{ height: '13%' }}>
          <BottomBar
            onOpenShop={() => setShopOpen(true)}
            onOpenFrogShop={() => setFrogShopOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenCosmicHub={() => setCosmicHubOpen(true)}
            onOpenSerumModal={() => setSerumOpen(true)}
            onOpenGallery={() => setGalleryOpen(true)}
          />
        </div>
      </div>

      <MagnetToggle />
      <StarMapHUD />
      <ShipFollowButton />
      <SerumBar />
      {/* tech-debt 2026-05-19: ActiveBonusesBar removed from HUD.
          Bonuses теперь показаны в Cosmic Hub → Carriers tab как
          CarrierBonusesPanel (display-only section, не интерактивный HUD pill). */}
      <LocationStack />

      {galleryOpen && <GalleryModal onClose={() => setGalleryOpen(false)} />}
      <GalleryDetailModal />
      {shopOpen && <ShopModal onClose={() => setShopOpen(false)} />}
      {frogShopOpen && <FrogShopModal onClose={() => setFrogShopOpen(false)} />}
      {serumOpen && <SerumModal onClose={() => setSerumOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      <Suspense fallback={null}>
        {cosmicHubOpen && (
          <CosmicHubModal onClose={() => setCosmicHubOpen(false)} />
        )}
      </Suspense>
      {/* Phase 18 (REQ BESTIARY-07): milestone toast — listens cosmic:bestiary-milestone
          event from cosmicSlice.setBestiaryBit; visible regardless of Cosmic Hub state. */}
      <MilestoneToast />
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
      {/* Phase 26 Plan 26-05: first-contact event flow coordinator —
          listens starmap:planet-tapped → gate firstContactsSeen → emits
          cosmos:first-contact → Phaser cinematic → on completion mounts
          FirstContactModal с race lore. Per-race idempotent. */}
      <FirstContactController />
      {/* Phase 27 Plan 27-05: event toast coordinator — subscribes to
          eventBus 'contacts:event-applied' (emitted by pendingEngineTick
          when inline event ChainItem auto-applies). Renders top-center
          stack of up to 3 toasts (z-index 150, between hub 100 and modal 200),
          each auto-dismissing after 3s via CSS keyframes. */}
      <EventToastController />
      {/* Phase 28 Plan 28-03: quest progress eventBus → slice wiring +
          boot-time reconcile (gold/relationship/discoveredLevels polling).
          Null-render; controller-only. Subscribes to merge:happened,
          cosmic:box-opened, starmap:planet-select, cosmic:ship-arrived,
          contacts:relationship-delta and delegates to markQuestProgress. */}
      <QuestController />
      {/* Phase 28 Plan 28-05: quest reward popup controller — subscribes to
          eventBus 'quests:completed' (emitted by markQuestProgress in Plan 28-03)
          и queue'ит popups для sequential display. Renders QuestRewardPopup
          для head of queue; auto-pops on dismiss. Null-render when queue empty
          (peer level с FirstContactController + EventToastController). */}
      <QuestRewardController />
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
    </QueryClientProvider>
  )
}

export default App
