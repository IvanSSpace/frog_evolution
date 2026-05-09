import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { eventBus } from './store/eventBus'
import { initSfx } from './audio/sfxBootstrap'
import { initPlanetVoice } from './audio/planetVoice'
import { authenticate } from './utils/auth'
import { loadGameState, startSync, stopSync } from './utils/gameSync'
import { hapticSelection } from './utils/telegram'
import {
  useGameStore,
  saveSessionTimestamp,
  getOfflineElapsedMs,
  getTractorCapMs,
  getTractorIncomePerSec,
} from './store/gameStore'
import type { Element, Rarity } from './store/cosmic/types'
import { StabilizationModal } from './components/CosmicHub/StabilizationModal'
import { MilestoneToast } from './components/CosmicHub/bestiary/MilestoneToast'
import { TutorialOverlay } from './components/Tutorial/TutorialOverlay'
import { SerumModal } from './components/CosmicHub/SerumModal'
import { SerumBar } from './components/SerumBar'
import { installBestiaryDevHelpers } from './utils/devHelpers'
import { devLog } from './utils/devLog'

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
  const [rareCrate, setRareCrate] = useState<{
    minLevel: number
    maxLevel: number
  } | null>(null)
  useEffect(() => {
    initSfx()
    initPlanetVoice()

    // Авторизация → загрузка состояния с сервера → запуск авто-синка
    authenticate().then(async (result) => {
      if (result.mode === 'failed') {
        console.error('[app] auth failed — продолжаем без сервера')
        return
      }
      // Тянем серверное состояние (если доступно) — переписывает локальный стор
      const loaded = await loadGameState()
      if (loaded) startSync()
    })

    // Расчёт офлайн-дохода трактора при загрузке
    const elapsedMs = getOfflineElapsedMs()
    const tractorLevel = useGameStore.getState().upgrades.tractor
    if (tractorLevel > 0 && elapsedMs > 0) {
      const capMs = getTractorCapMs(tractorLevel)
      const earnedMs = Math.min(elapsedMs, capMs)
      const earnedSec = Math.floor(earnedMs / 1000)
      const income = earnedSec * getTractorIncomePerSec(tractorLevel)
      if (income > 0) {
        useGameStore.getState().addGold(income)
        setWelcomeBack({ earned: income, hours: earnedMs / 3_600_000 })
      }
    }
    saveSessionTimestamp()

    // Heartbeat — пишем timestamp каждые 5 сек
    const heartbeat = window.setInterval(saveSessionTimestamp, 5000)

    // Сохраняем когда таб уходит в фон
    const onVisibility = () => {
      if (document.hidden) saveSessionTimestamp()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', saveSessionTimestamp)

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

    return () => {
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', saveSessionTimestamp)
      eventBus.off('frog:discovered', onDiscovered)
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

// HUD Звёздной карты — координаты, zoom, FPS. DOM-overlay поверх Phaser canvas.
// Появляется только когда StarMap активен.
function StarMapHUD() {
  const [active, setActive] = useState(false)
  const [data, setData] = useState({
    x: 0,
    y: 0,
    zoom: 1,
    fps: 60,
    vis: 0,
    total: 0,
  })

  useEffect(() => {
    const onOpen = () => setActive(true)
    const onClose = () => setActive(false)
    eventBus.on('starmap:open', onOpen)
    eventBus.on('starmap:close', onClose)
    return () => {
      eventBus.off('starmap:open', onOpen)
      eventBus.off('starmap:close', onClose)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    let raf = 0
    const tick = async () => {
      const { getStarMapHUD } = await import('./game')
      const d = getStarMapHUD()
      if (d) setData(d)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [active])

  if (!active) return null

  const fpsColor =
    data.fps > 50 ? '#86efac' : data.fps > 30 ? '#fde047' : '#fca5a5'
  return (
    <div
      style={{
        position: 'fixed',
        top: 6,
        left: 8,
        zIndex: 200,
        pointerEvents: 'none',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        lineHeight: 1.3,
        color: '#ffd700',
        textShadow: '0 0 3px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.95)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        display: 'flex',
        gap: 8,
      }}
    >
      <span>X:{data.x}</span>
      <span>Y:{data.y}</span>
      <span>Z:{data.zoom.toFixed(2)}</span>
      <span style={{ color: fpsColor }}>FPS:{Math.round(data.fps)}</span>
      <span style={{ opacity: 0.7 }}>
        {data.vis}/{data.total}
      </span>
    </div>
  )
}

function MagnetToggle() {
  const { t } = useTranslation()
  const magnetLevel = useGameStore((s) => s.upgrades.magnet)
  const magnetEnabled = useGameStore((s) => s.magnetEnabled)
  const toggleMagnet = useGameStore((s) => s.toggleMagnet)
  const currentLocation = useGameStore((s) => s.currentLocation)
  const [starMapActive, setStarMapActive] = useState(false)

  useEffect(() => {
    const onOpen = () => setStarMapActive(true)
    const onClose = () => setStarMapActive(false)
    eventBus.on('starmap:open', onOpen)
    eventBus.on('starmap:close', onClose)
    return () => {
      eventBus.off('starmap:open', onOpen)
      eventBus.off('starmap:close', onClose)
    }
  }, [])

  if (magnetLevel < 1) return null
  if (currentLocation !== 1) return null
  if (starMapActive) return null // на Звёздной карте магнит не нужен

  return (
    <button
      onClick={() => {
        hapticSelection()
        toggleMagnet()
      }}
      aria-label={magnetEnabled ? t('magnet.off') : t('magnet.on')}
      style={{
        position: 'fixed',
        top: 'calc(12% + 2px)',
        left: 12,
        zIndex: 50,
        pointerEvents: 'auto',
        ['--ff-tile-from' as never]: magnetEnabled ? '#fcd34d' : '#9ca3af',
        ['--ff-tile-to' as never]: magnetEnabled ? '#d97706' : '#4b5563',
        ['--ff-tile-border' as never]: magnetEnabled ? '#78350f' : '#1f2937',
        opacity: magnetEnabled ? 1 : 0.7,
      }}
      className="ff-tile w-12 h-12 text-2xl"
    >
      <span
        style={{
          filter: magnetEnabled
            ? 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))'
            : 'grayscale(0.7)',
        }}
      >
        🧲
      </span>
      {!magnetEnabled && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626',
            fontSize: '32px',
            fontWeight: 900,
            textShadow:
              '0 0 4px rgba(255,255,255,0.85), 0 0 6px rgba(255,255,255,0.6)',
            pointerEvents: 'none',
          }}
        >
          ⊘
        </span>
      )}
    </button>
  )
}

function ShipFollowButton() {
  const shipState = useGameStore((s) => s.ship?.state)
  const [following, setFollowing] = useState(false)
  const [starMapActive, setStarMapActive] = useState(false)

  useEffect(() => {
    const onOpen = () => setStarMapActive(true)
    const onClose = () => {
      setStarMapActive(false)
      setFollowing(false)
    }
    eventBus.on('starmap:open', onOpen)
    eventBus.on('starmap:close', onClose)
    return () => {
      eventBus.off('starmap:open', onOpen)
      eventBus.off('starmap:close', onClose)
    }
  }, [])

  // Scene cancels follow (e.g. drag or ship docked)
  useEffect(() => {
    const handler = ({ following: f }: { following: boolean }) =>
      setFollowing(f)
    eventBus.on('starmap:follow-changed', handler)
    return () => eventBus.off('starmap:follow-changed', handler)
  }, [])

  if (!starMapActive || shipState !== 'transit') return null

  const toggle = () => {
    const next = !following
    setFollowing(next)
    eventBus.emit('starmap:follow-ship', { enable: next })
  }

  return (
    <button
      onClick={toggle}
      aria-label={following ? 'Отключить слежение' : 'Следовать за кораблём'}
      style={{
        position: 'fixed',
        top: 'calc(12% + 10px)',
        left: 12,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 20,
        border: following
          ? '1.5px solid #34d399'
          : '1.5px solid rgba(255,255,255,0.25)',
        background: following ? 'rgba(16,185,129,0.18)' : 'rgba(0,0,0,0.55)',
        color: following ? '#34d399' : 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: 600,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        cursor: 'pointer',
        pointerEvents: 'auto',
        transition: 'all 0.2s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <span style={{ fontSize: 14 }}>{following ? '📍' : '🚀'}</span>
      {following ? 'Следую' : 'Следовать'}
    </button>
  )
}

export default App
