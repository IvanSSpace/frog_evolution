import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from './ui/components/Header'
import { BottomBar } from './ui/components/BottomBar'
import { ShopModal } from './ui/components/ShopModal'
import { FrogShopModal } from './ui/components/FrogShopModal'
import { WelcomeBackModal } from './ui/components/WelcomeBackModal'
import { DiscoveryModal } from './ui/components/DiscoveryModal'
import { LocationStack } from './ui/components/LocationStack'
import { eventBus } from './store/eventBus'
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

const queryClient = new QueryClient()

function App() {
  const [shopOpen, setShopOpen] = useState(false)
  const [frogShopOpen, setFrogShopOpen] = useState(false)
  const [welcomeBack, setWelcomeBack] = useState<{ earned: number; hours: number } | null>(null)
  const [discovered, setDiscovered] = useState<number | null>(null)

  useEffect(() => {
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

    return () => {
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', saveSessionTimestamp)
      eventBus.off('frog:discovered', onDiscovered)
      stopSync()
    }
  }, [])

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
          />
        </div>
      </div>

      <MagnetToggle />
      <LocationStack />

      {shopOpen && <ShopModal onClose={() => setShopOpen(false)} />}
      {frogShopOpen && <FrogShopModal onClose={() => setFrogShopOpen(false)} />}
      {discovered !== null && (
        <DiscoveryModal level={discovered} onClose={() => setDiscovered(null)} />
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

function MagnetToggle() {
  const magnetLevel = useGameStore((s) => s.upgrades.magnet)
  const magnetEnabled = useGameStore((s) => s.magnetEnabled)
  const toggleMagnet = useGameStore((s) => s.toggleMagnet)
  const currentLocation = useGameStore((s) => s.currentLocation)

  if (magnetLevel < 1) return null // не куплен — не показываем
  if (currentLocation !== 1) return null // магнит работает только на Болоте

  return (
    <button
      onClick={() => { hapticSelection(); toggleMagnet() }}
      aria-label={magnetEnabled ? 'выключить магнит' : 'включить магнит'}
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
