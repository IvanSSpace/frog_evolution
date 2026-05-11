import { lazy, Suspense, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from './ui/components/Header'
import { BottomBar } from './ui/components/BottomBar'
import { ShopModal } from './ui/components/ShopModal'
import { FrogShopModal } from './ui/components/FrogShopModal'
import { WelcomeBackModal } from './ui/components/WelcomeBackModal'
import { DiscoveryModal } from './ui/components/DiscoveryModal'
import { UnlockComic } from './ui/components/UnlockComic/UnlockComic'
import { RareCrateModal } from './ui/components/RareCrateModal'
import { SettingsModal } from './ui/components/SettingsModal'
import { LocationStack } from './ui/components/LocationStack'
import { StarMapHUD } from './ui/components/StarMapHUD'
import { MagnetToggle } from './ui/components/MagnetToggle'
import { ShipFollowButton } from './ui/components/ShipFollowButton'
import { eventBus } from './store/eventBus'
import { initSfx } from './audio/sfxBootstrap'
import { initPlanetVoice } from './audio/planetVoice'
import {
  useGameStore,
  saveSessionState,
  getOfflineSession,
  getTractorCapMs,
} from './store/gameStore'
import { saveDiscovered } from './store/persistence'
import type { Element, Rarity } from './store/cosmic/types'
import { StabilizationModal } from './components/CosmicHub/StabilizationModal'
import { MilestoneToast } from './components/CosmicHub/bestiary/MilestoneToast'
import { TutorialOverlay } from './components/Tutorial/TutorialOverlay'
import { SerumModal } from './components/CosmicHub/SerumModal'
import { SerumBar } from './components/SerumBar'
import { installBestiaryDevHelpers } from './utils/devHelpers'
import { devLog } from './utils/devLog'
import { pingHealth } from './api/client'
import { ensureLogin } from './api/auth'
import { loadGameState, startSync, stopSync } from './api/gameSync'

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
  const [welcomeBack, setWelcomeBack] = useState<{
    earned: number
    hours: number
  } | null>(null)
  const [discovered, setDiscovered] = useState<number | null>(null)
  const [unlockedLocation, setUnlockedLocation] = useState<number | null>(null)
  const [rareCrate, setRareCrate] = useState<{
    minLevel: number
    maxLevel: number
  } | null>(null)
  useEffect(() => {
    initSfx()
    initPlanetVoice()

    // Liveness check → авторизация → загрузка состояния с сервера → запуск авто-синка
    pingHealth().then((h) => {
      if (h) {
        console.log('[server] ✓ alive at', new Date(h.ts).toISOString())
      } else {
        console.warn('[server] ✗ unreachable (skipping login)')
      }
    })
    ensureLogin().then(async (auth) => {
      if (!auth) {
        console.error('[app] auth failed — продолжаем без сервера')
        return
      }
      console.log(
        '[server] logged in as user',
        auth.user.id,
        auth.user.telegramId,
      )
      // Тянем серверное состояние (если доступно) — переписывает локальный стор
      const loaded = await loadGameState()
      if (loaded) startSync()
    })

    // Расчёт офлайн-дохода трактора при загрузке.
    // Доход теперь считается по сохранённому incomePerSec (фактический доход
    // фермы на момент ухода), а не по фиксированной таблице уровней трактора.
    // Уровень трактора всё ещё определяет cap-time через getTractorCapMs.
    const session = getOfflineSession()
    const tractorLevel = useGameStore.getState().upgrades.tractor
    if (session && tractorLevel > 0 && session.elapsedMs > 0) {
      const capMs = getTractorCapMs(tractorLevel)
      const earnedMs = Math.min(session.elapsedMs, capMs)
      const earnedSec = Math.floor(earnedMs / 1000)
      const income = Math.floor(earnedSec * session.incomePerSec)
      if (income > 0) {
        useGameStore.getState().addGold(income)
        // Модалка показывается только при отсутствии 1+ часа — иначе
        // мелькала бы при каждом быстром переоткрытии вкладки.
        if (session.elapsedMs >= 60 * 60 * 1000) {
          setWelcomeBack({ earned: income, hours: earnedMs / 3_600_000 })
        }
      }
    }
    const saveSession = () =>
      saveSessionState(useGameStore.getState().incomePerSec)
    saveSession()

    // Heartbeat — пишем timestamp + текущий incomePerSec каждые 5 сек
    const heartbeat = window.setInterval(saveSession, 5000)

    // Сохраняем когда таб уходит в фон
    const onVisibility = () => {
      if (document.hidden) saveSession()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', saveSession)

    // Открытие нового вида лягушки
    const onDiscovered = ({ level }: { level: number }) => {
      // L25 — sentinel для unlock Звёздной карты, не лягушка.
      // Подавляем DiscoveryModal — играется UnlockComic вместо.
      if (level === 25) return
      devLog('[discovery] new level:', level)
      // Лёгкая задержка чтобы pop-анимация на поле успела сыграть
      setTimeout(() => setDiscovered(level), 250)
    }
    eventBus.on('frog:discovered', onDiscovered)

    // Progressive location unlock — emit'ится из MergeController после
    // markDiscovered трогающего trigger-уровень (L7/L13/L19) или L25-sentinel.
    const onLocationUnlocked = ({ locationId }: { locationId: number }) => {
      setUnlockedLocation(locationId)
    }
    eventBus.on('location:unlocked', onLocationUnlocked)

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

    return () => {
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', saveSession)
      eventBus.off('frog:discovered', onDiscovered)
      eventBus.off('location:unlocked', onLocationUnlocked)
      eventBus.off('rareCrate:opened', handleRareCrateOpened)
      stopSync()
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
      const levels = [1, 7, 13, 19, 25]
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

    w.__grantSerum = (
      element: Element,
      rarity: Rarity = 'common',
      count = 1,
    ) => {
      useGameStore.getState().addSerum(element, rarity, count)
      devLog(`[dev] granted ${count}× ${rarity} ${element} serum`)
    }

    // Phase 18: bestiary dev helpers (window.__unlockBestiaryCells / __bestiaryCount / __resetBestiary).
    installBestiaryDevHelpers()

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
    }
  }, [])

  const handleRareCrateClaim = (wonLevel: number) => {
    setRareCrate(null)
    eventBus.emit('rareCrate:claim', { level: wonLevel })
  }

  return (
    <QueryClientProvider client={queryClient}>
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
          />
        </div>
      </div>

      <MagnetToggle />
      <StarMapHUD />
      <ShipFollowButton />
      <SerumBar />
      <LocationStack />

      {shopOpen && <ShopModal onClose={() => setShopOpen(false)} />}
      {frogShopOpen && <FrogShopModal onClose={() => setFrogShopOpen(false)} />}
      {serumOpen && <SerumModal onClose={() => setSerumOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      <Suspense fallback={null}>
        {cosmicHubOpen && (
          <CosmicHubModal onClose={() => setCosmicHubOpen(false)} />
        )}
      </Suspense>
      {/* Phase 17 (CARRIER-08): stabilization modal — top-level always-mounted,
          listens cosmic:carrier-stabilized event independent of Cosmic Hub state. */}
      <StabilizationModal />
      {/* Phase 18 (REQ BESTIARY-07): milestone toast — listens cosmic:bestiary-milestone
          event from cosmicSlice.setBestiaryBit; visible regardless of Cosmic Hub state. */}
      <MilestoneToast />
      {/* Phase 19-05 (UX-08): tutorial overlay — always mounted; conditional null-render. */}
      <TutorialOverlay />
      {discovered !== null && (
        <DiscoveryModal
          level={discovered}
          onClose={() => setDiscovered(null)}
        />
      )}
      {unlockedLocation !== null && (
        <UnlockComic
          locationId={unlockedLocation}
          onClose={() => setUnlockedLocation(null)}
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
