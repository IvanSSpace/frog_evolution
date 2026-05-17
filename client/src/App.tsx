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
import { TutorialOverlay } from './components/Tutorial/TutorialOverlay'
import { OnboardingController } from './components/Onboarding/OnboardingController'
import { SerumModal } from './components/CosmicHub/SerumModal'
import { SerumBar } from './components/SerumBar'
import { ActiveBonusesBar } from './components/HUD/ActiveBonusesBar'
import { installBestiaryDevHelpers } from './utils/devHelpers'
import { installOnboardingDevHelpers } from './utils/onboardingDevHelpers'
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
        <div style={{ height: '12%' }}>
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
      {/* Phase 22 Plan 22-04: HUD строка активных archetype bonuses.
          Bar самостоятельно скрывается если bonus pool пуст. z-index 50 — выше Phaser overlays. */}
      <ActiveBonusesBar />
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
      {/* Phase 19-05 (UX-08): tutorial overlay — always mounted; conditional null-render. */}
      <TutorialOverlay />
      {/* Phase 23 Plan 23-01: onboarding coordinator (Wave 1 — empty shell;
          Plan 23-02..05 add Welcome / TapHint / MergeDemo / LocationCelebration overlays). */}
      <OnboardingController />
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
    </QueryClientProvider>
  )
}

export default App
