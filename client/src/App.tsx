import { lazy, Suspense, useEffect, useRef, useState } from 'react'
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
import type { CosmicToastPayload } from './store/cosmic/types'
import { findPlanetById, DAILY_CAP, type MissionResult } from './game/data/missionConfig'
import { FlightConfirmDialog } from './components/CosmicHub/FlightConfirmDialog'
import { MissionOverlay } from './components/MissionOverlay/MissionOverlay'
import { StabilizationModal } from './components/CosmicHub/StabilizationModal'

const queryClient = new QueryClient()

// Phase 11: Cosmic Hub modal lazy-loaded → отдельный chunk, не утяжеляет main bundle
const CosmicHubModal = lazy(() => import('./components/CosmicHub/CosmicHubModal'))

function App() {
  const [shopOpen, setShopOpen] = useState(false)
  const [frogShopOpen, setFrogShopOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cosmicHubOpen, setCosmicHubOpen] = useState(false)
  const [welcomeBack, setWelcomeBack] = useState<{ earned: number; hours: number } | null>(null)
  const [discovered, setDiscovered] = useState<number | null>(null)
  const [rareCrate, setRareCrate] = useState<{ minLevel: number; maxLevel: number } | null>(null)
  // Phase 11: cosmic toast (multi-grouping COSMIC-HUB-06)
  const [cosmicToast, setCosmicToast] = useState<CosmicToastPayload | null>(null)
  const toastBufferRef = useRef<CosmicToastPayload[]>([])
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Phase 16 (REQ SHIP-07/08): Flight confirm dialog state.
  // Set non-null когда юзер тапает по planet на StarMap при открытом Cosmic Hub.
  const [pendingFlightPlanetId, setPendingFlightPlanetId] = useState<string | null>(null)

  // Phase 16 (REQ MISSION-01..08): mission overlay state.
  // Set non-null когда eventBus emits 'cosmic:start-mission' и валидация прошла.
  const [activeMissionPlanetId, setActiveMissionPlanetId] = useState<string | null>(null)

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
      console.log('[discovery] new level:', level)
      // Лёгкая задержка чтобы pop-анимация на поле успела сыграть
      setTimeout(() => setDiscovered(level), 250)
    }
    eventBus.on('frog:discovered', onDiscovered)

    const handleRareCrateOpened = ({ x: _x, y: _y, minLevel, maxLevel }: { x: number; y: number; minLevel: number; maxLevel: number }) => {
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

  // Phase 11 (COSMIC-HUB-05/06): cosmic:toast subscriber + multi-grouping.
  // Несколько emit'ов за GROUPING_WINDOW_MS объединяются в один grouped toast.
  // Phase 14 (SERUM-10): payload.duration override (default 4000ms).
  useEffect(() => {
    const GROUPING_WINDOW_MS = 1000
    const DEFAULT_AUTO_HIDE_MS = 4000

    const handler = (payload: CosmicToastPayload) => {
      toastBufferRef.current.push(payload)

      // Сбросить старый окно-таймер, открыть новый — окно "плывёт"
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)

      toastTimerRef.current = setTimeout(() => {
        const buffer = toastBufferRef.current
        toastBufferRef.current = []
        toastTimerRef.current = null

        if (buffer.length === 0) return

        let next: CosmicToastPayload
        if (buffer.length === 1) {
          next = buffer[0]
        } else {
          // Grouped toast: суммируем count (если payload.count не задан → 1 за событие)
          const totalCount = buffer.reduce((sum, t) => sum + (t.count ?? 1), 0)
          // Action — только если все одинаковые (по label) — иначе ambiguity
          const firstLabel = buffer[0].action?.label
          const allSameAction = firstLabel != null &&
            buffer.every((t) => t.action?.label === firstLabel)
          // duration: max между всеми payload'ами (защита от мерцающих undo toast'ов)
          const maxDuration = buffer.reduce<number | undefined>((m, t) => {
            if (t.duration == null) return m
            return m == null ? t.duration : Math.max(m, t.duration)
          }, undefined)
          next = {
            type: buffer[0].type,
            msg: `${totalCount} событий`,
            count: totalCount,
            action: allSameAction ? buffer[0].action : undefined,
            duration: maxDuration,
          }
        }

        setCosmicToast(next)

        // Phase 14: payload.duration override (default 4000ms).
        const hideMs = next.duration ?? DEFAULT_AUTO_HIDE_MS
        if (toastHideTimerRef.current) clearTimeout(toastHideTimerRef.current)
        toastHideTimerRef.current = setTimeout(() => {
          setCosmicToast(null)
          toastHideTimerRef.current = null
        }, hideMs)
      }, GROUPING_WINDOW_MS)
    }

    eventBus.on('cosmic:toast', handler)
    return () => {
      eventBus.off('cosmic:toast', handler)
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
      if (toastHideTimerRef.current) {
        clearTimeout(toastHideTimerRef.current)
        toastHideTimerRef.current = null
      }
    }
  }, [])

  // Phase 16 (REQ SHIP-10): подписка на arrival event → toast «Прибыли на NAME [Изучить]».
  // Re-используем cosmic:toast pipeline для grouping consistency.
  useEffect(() => {
    const handleArrived = ({ planetId }: { planetId: string }) => {
      const planet = findPlanetById(planetId)
      const name = planet?.name ?? planetId.toUpperCase()
      eventBus.emit('cosmic:toast', {
        type: 'generic',
        msg: `Прибыли на ${name}`,
        action: {
          label: 'Изучить',
          onClick: () => {
            // Open Cosmic Hub on Корабль tab + emit start-mission.
            // Plan 16-04 wires up — Plan 16-02 emit'ит start-mission scaffold.
            eventBus.emit('cosmic:start-mission', { planetId })
          },
        },
      })
    }
    eventBus.on('cosmic:ship-arrived', handleArrived)
    return () => { eventBus.off('cosmic:ship-arrived', handleArrived) }
  }, [])

  // Phase 16 (REQ SHIP-07/08): subscriber на 'cosmic:request-flight'
  // → показывать FlightConfirmDialog только если Cosmic Hub открыт.
  // Same-planet docked → пропускаем confirm (SHIP-08).
  useEffect(() => {
    const handleRequestFlight = ({ planetId }: { planetId: string }) => {
      if (!cosmicHubOpen) return
      const ship = useGameStore.getState().ship
      if (ship && ship.state === 'docked' && ship.planetId === planetId) return
      setPendingFlightPlanetId(planetId)
    }
    eventBus.on('cosmic:request-flight', handleRequestFlight)
    return () => { eventBus.off('cosmic:request-flight', handleRequestFlight) }
  }, [cosmicHubOpen])

  // Phase 16 (REQ MISSION-01): subscriber на 'cosmic:start-mission'
  // → mount MissionOverlay (с валидацией ship.docked + crew credits).
  useEffect(() => {
    const handleStart = ({ planetId }: { planetId: string }) => {
      const state = useGameStore.getState()
      if (!state.ship || state.ship.state !== 'docked' || state.ship.planetId !== planetId) return
      if (state.crew.missionsToday >= DAILY_CAP) return
      setActiveMissionPlanetId(planetId)
    }
    eventBus.on('cosmic:start-mission', handleStart)
    return () => { eventBus.off('cosmic:start-mission', handleStart) }
  }, [])

  // Phase 16 (REQ MISSION-05): subscriber на 'cosmic:mission-complete'
  // → call investigatePlanet (atomic credit + addBox + toast).
  useEffect(() => {
    const handleComplete = ({ planetId, result }: { planetId: string; result: MissionResult }) => {
      useGameStore.getState().investigatePlanet(planetId, result)
      setActiveMissionPlanetId(null)
    }
    eventBus.on('cosmic:mission-complete', handleComplete)
    return () => { eventBus.off('cosmic:mission-complete', handleComplete) }
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

    // Window-exposed dev helpers (testability: forceMissionType etc.).
    const w = window as unknown as Record<string, unknown>

    w.__forceMissionType = (type: 'rhythm' | 'defend' | 'hotspot') => {
      localStorage.setItem('__force_mission_type', type)
      console.log('[dev] forced mission type:', type)
    }

    w.__resetCrewToday = () => {
      useGameStore.setState((s) => ({
        crew: { ...s.crew, missionsToday: 0 },
      }))
      console.log('[dev] crew reset')
    }

    w.__unlockAllTabs = () => {
      const s = useGameStore.getState()
      s.setHasFirstFeed(true)
      s.setHasFirstMission(true)
      s.setHasOpenedAnyBox(true)
      console.log('[dev] all tabs unlocked')
    }

    w.__lockAllTabs = () => {
      const s = useGameStore.getState()
      s.setHasFirstFeed(false)
      s.setHasFirstMission(false)
      s.setHasOpenedAnyBox(false)
      console.log('[dev] all tabs locked (simulating fresh prod install)')
    }

    w.__shipTo = (planetId: string) => {
      useGameStore.getState().arriveShipAt(planetId)
    }

    return () => {
      delete w.__forceMissionType
      delete w.__resetCrewToday
      delete w.__unlockAllTabs
      delete w.__lockAllTabs
      delete w.__shipTo
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
          />
        </div>
      </div>

      <MagnetToggle />
      <StarMapHUD />
      <LocationStack />

      {shopOpen && <ShopModal onClose={() => setShopOpen(false)} />}
      {frogShopOpen && <FrogShopModal onClose={() => setFrogShopOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      <Suspense fallback={null}>
        {cosmicHubOpen && (
          <CosmicHubModal onClose={() => setCosmicHubOpen(false)} />
        )}
      </Suspense>
      {/* Phase 17 (CARRIER-08): stabilization modal — top-level always-mounted,
          listens cosmic:carrier-stabilized event independent of Cosmic Hub state. */}
      <StabilizationModal />
      {pendingFlightPlanetId && (
        <FlightConfirmDialog
          toPlanetId={pendingFlightPlanetId}
          onConfirm={() => {
            useGameStore.getState().sendShipTo(pendingFlightPlanetId)
            setPendingFlightPlanetId(null)
          }}
          onCancel={() => setPendingFlightPlanetId(null)}
        />
      )}
      {activeMissionPlanetId && (
        <MissionOverlay
          planetId={activeMissionPlanetId}
          onClose={() => setActiveMissionPlanetId(null)}
        />
      )}
      {discovered !== null && (
        <DiscoveryModal level={discovered} onClose={() => setDiscovered(null)} />
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
      {cosmicToast && (
        <CosmicToast
          payload={cosmicToast}
          onClose={() => setCosmicToast(null)}
        />
      )}
    </QueryClientProvider>
  )
}

// Phase 11: cosmic toast UI (COSMIC-HUB-05/06).
// Появляется внизу экрана (над BottomBar), автоматически скрывается через 4 сек.
function CosmicToast({
  payload,
  onClose,
}: {
  payload: CosmicToastPayload
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(13% + 16px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        background: '#1f2937',
        color: '#fff',
        borderRadius: 12,
        padding: '12px 16px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 320,
        width: 'calc(100% - 32px)',
        pointerEvents: 'auto',
      }}
    >
      <span style={{ fontSize: 14, flex: 1 }}>{payload.msg}</span>
      {payload.action && (
        <button
          onClick={() => { payload.action!.onClick(); onClose() }}
          style={{
            color: '#34d399',
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {payload.action.label}
        </button>
      )}
      <button
        onClick={onClose}
        style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: 18,
          lineHeight: 1,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  )
}

// HUD Звёздной карты — координаты, zoom, FPS. DOM-overlay поверх Phaser canvas.
// Появляется только когда StarMap активен.
function StarMapHUD() {
  const [active, setActive] = useState(false)
  const [data, setData] = useState({ x: 0, y: 0, zoom: 1, fps: 60, vis: 0, total: 0 })

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

  const fpsColor = data.fps > 50 ? '#86efac' : data.fps > 30 ? '#fde047' : '#fca5a5'
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
      <span style={{ opacity: 0.7 }}>{data.vis}/{data.total}</span>
    </div>
  )
}

// Popover-модалка под выбранной главной планетой. Появляется при тапе на расе.
// Следует за планетой при движении камеры. Закрывается при тапе по другой
// планете или при закрытии Звёздной карты.
type PopoverData = {
  raceId: string
  raceName: string
  raceType: string
  domX: number
  domY: number
  placement: 'below' | 'above'
}

// @ts-expect-error заменён Phaser-popover в StarMapScene; оставляю код для возможного отката
function PlanetPopover() {
  // data — для UI содержимого (имя, тип, placement). НЕ обновляется при move
  // (placement зафиксирован при select). Position обновляется напрямую через ref/RAF
  // минуя React state, чтобы не отставать от Phaser camera на 1 кадр.
  const [data, setData] = useState<PopoverData | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  // Текущие координаты якоря — обновляются из event без re-render
  const liveCoordsRef = useRef<{ bottomX: number; bottomY: number; topX: number; topY: number } | null>(null)

  useEffect(() => {
    const onSelect = (e: PopoverData) => {
      liveCoordsRef.current = {
        bottomX: e.placement === 'below' ? e.domX : e.domX,
        bottomY: e.placement === 'below' ? e.domY : e.domY,
        topX: e.domX,
        topY: e.domY,
      }
      setData(e)
    }
    const onMoved = (e: { raceId: string; bottomX: number; bottomY: number; topX: number; topY: number }) => {
      liveCoordsRef.current = {
        bottomX: e.bottomX, bottomY: e.bottomY,
        topX: e.topX, topY: e.topY,
      }
    }
    const onClose = () => { liveCoordsRef.current = null; setData(null) }
    eventBus.on('starmap:planet-selected', onSelect)
    eventBus.on('starmap:planet-moved', onMoved)
    eventBus.on('starmap:popover-close', onClose)
    eventBus.on('starmap:close', onClose)
    return () => {
      eventBus.off('starmap:planet-selected', onSelect)
      eventBus.off('starmap:planet-moved', onMoved)
      eventBus.off('starmap:popover-close', onClose)
      eventBus.off('starmap:close', onClose)
    }
  }, [])

  // RAF-loop — обновляет style.left/top напрямую через DOM ref. Это синхронно
  // с rendering и не зависит от React batching.
  useEffect(() => {
    if (!data) return
    let raf = 0
    const POPOVER_WIDTH = 170
    const isBelow = data.placement === 'below'
    const tick = () => {
      const coords = liveCoordsRef.current
      const el = popoverRef.current
      if (coords && el) {
        const x = isBelow ? coords.bottomX : coords.topX
        const y = isBelow ? coords.bottomY : coords.topY
        el.style.left = `${x - POPOVER_WIDTH / 2}px`
        el.style.top = `${y}px`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [data])

  // Click outside — закрываем popover при клике на любой DOM-элемент вне модалки.
  // Тапы по самому popover не закрывают (stopPropagation). Тапы по Phaser canvas
  // обрабатываются отдельно в Phaser scene (там есть своя логика tapHandled).
  useEffect(() => {
    if (!data) return
    const onDocClick = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (popoverRef.current && popoverRef.current.contains(target)) return
      // Канвас Phaser сам разберётся — не закрываем тут двойным
      const canvas = document.querySelector('#game-canvas canvas')
      if (canvas && canvas.contains(target)) return
      eventBus.emit('starmap:popover-close')
    }
    document.addEventListener('pointerdown', onDocClick)
    return () => document.removeEventListener('pointerdown', onDocClick)
  }, [data])

  if (!data) return null

  const TYPE_LABELS: Record<string, string> = {
    home: 'Родина', crystal: 'Кристаллы', rocky: 'Камень', ancient: 'Древние',
    mystic: 'Провидцы', organic: 'Органики', forge: 'Кузнецы', military: 'Военные',
    destroyed: 'Уничтожено', crystal_bio: 'Кристалло-биоты', mechano: 'Механо',
    energy: 'Энергеты', mist: 'Туман', aquatic: 'Водные', shadow: 'Тени', aerial: 'Воздушные',
  }
  const typeLabel = TYPE_LABELS[data.raceType] || data.raceType

  // Стрелка: при placement=below кончик ВВЕРХ к планете, при above кончик ВНИЗ
  const ARROW_W = 22
  const ARROW_H = 16
  const ARROW_INNER_W = 14
  const ARROW_INNER_H = 10
  const isBelow = data.placement === 'below'

  const POPOVER_WIDTH = 170
  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        // left/top устанавливаются динамически через RAF в useEffect выше
        left: 0,
        top: 0,
        width: POPOVER_WIDTH,
        transform: isBelow ? 'none' : 'translateY(-100%)',
        zIndex: 200,
        pointerEvents: 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Стрелка-обводка — для below сверху панели (top:0), для above снизу (bottom:0) */}
      <div
        style={{
          position: 'absolute',
          ...(isBelow ? { top: 0 } : { bottom: 0 }),
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: `${ARROW_W / 2}px solid transparent`,
          borderRight: `${ARROW_W / 2}px solid transparent`,
          ...(isBelow
            ? { borderBottom: `${ARROW_H}px solid #4d6b1f` }
            : { borderTop: `${ARROW_H}px solid #4d6b1f` }
          ),
        }}
      />
      {/* Внутренняя стрелка — кремовая заливка */}
      <div
        style={{
          position: 'absolute',
          ...(isBelow ? { top: 5 } : { bottom: 5 }),
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: `${ARROW_INNER_W / 2}px solid transparent`,
          borderRight: `${ARROW_INNER_W / 2}px solid transparent`,
          ...(isBelow
            ? { borderBottom: `${ARROW_INNER_H}px solid #f5fbe9` }
            : { borderTop: `${ARROW_INNER_H}px solid #f5fbe9` }
          ),
        }}
      />
      {/* Компактная панель — width фиксирован на родителе */}
      <div
        className="ff-panel"
        style={{
          ...(isBelow ? { marginTop: ARROW_H } : { marginBottom: ARROW_H }),
          padding: '8px 10px 10px',
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: 'Russo One, system-ui, sans-serif',
        }}
      >
        {/* Заголовок */}
        <div style={{
          fontFamily: 'Russo One, system-ui, sans-serif',
          letterSpacing: 1,
          fontSize: 16,
          color: '#dc2626',
          textShadow: '0 1px 0 rgba(255,255,255,0.85), 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff',
          marginBottom: 2,
          lineHeight: 1,
        }}>
          {data.raceName}
        </div>
        {/* Подпись типа */}
        <div style={{
          fontSize: 10,
          color: '#4d6b1f',
          marginBottom: 8,
          fontFamily: 'Nunito, system-ui, sans-serif',
          fontWeight: 700,
        }}>
          {typeLabel}
        </div>
        {/* Кнопки — компактные */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <button
            onClick={() => console.log('connect', data.raceId)}
            className="ff-btn ff-btn-green"
            style={{ width: '100%', justifyContent: 'flex-start', fontSize: 11, padding: '5px 9px', borderBottomWidth: 4 }}
          >
            <span style={{ fontSize: 13, marginRight: 5 }}>📡</span>
            Связаться
          </button>
          <button
            onClick={() => console.log('send', data.raceId)}
            className="ff-btn ff-btn-amber"
            style={{ width: '100%', justifyContent: 'flex-start', fontSize: 11, padding: '5px 9px', borderBottomWidth: 4 }}
          >
            <span style={{ fontSize: 13, marginRight: 5 }}>🚀</span>
            Скаут
          </button>
          <button
            onClick={() => console.log('info', data.raceId)}
            className="ff-btn ff-btn-purple"
            style={{ width: '100%', justifyContent: 'flex-start', fontSize: 11, padding: '5px 9px', borderBottomWidth: 4 }}
          >
            <span style={{ fontSize: 13, marginRight: 5 }}>📋</span>
            Описание
          </button>
        </div>
      </div>
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
      onClick={() => { hapticSelection(); toggleMagnet() }}
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
      <span style={{
        filter: magnetEnabled ? 'drop-shadow(0 1px 0 rgba(0,0,0,0.25))' : 'grayscale(0.7)',
      }}>🧲</span>
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
            textShadow: '0 0 4px rgba(255,255,255,0.85), 0 0 6px rgba(255,255,255,0.6)',
            pointerEvents: 'none',
          }}
        >
          ⊘
        </span>
      )}
    </button>
  )
}

export default App
