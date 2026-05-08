// Phase 11: Cosmic Hub fullscreen modal с 4 табами.
// Lazy-loaded из App.tsx (React.lazy + Suspense → отдельный chunk).
// sessionStorage сохраняет последний активный таб (COSMIC-HUB-07).
// Phase 16: progressive disclosure (UX-09) — табы Корабль/Боксы gated через
// sentinel флаги hasFirstFeed/hasFirstMission. DEV-mode unlocks all.

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { CosmicTab } from '../../store/cosmic/types'
import { useGameStore } from '../../store/gameStore'
import { ShipTab } from './ShipTab'
import { BoxesTab } from './BoxesTab'
import { SerumsTab } from './SerumsTab'
import { BestiaryTab } from './BestiaryTab'
import { CarriersTab } from './CarriersTab'

const SESSION_KEY = 'cosmic_last_tab'

function getInitialTab(): CosmicTab {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (
      saved === 'scouts' || saved === 'boxes' ||
      saved === 'serums' || saved === 'bestiary' ||
      saved === 'carriers'
    ) {
      return saved
    }
  } catch { /* ignore */ }
  return 'scouts'
}

interface Tab {
  id: CosmicTab
  label: string
  icon: string
  enabled: boolean
  lockReason?: string  // i18n key для tooltip
}

interface Props {
  onClose: () => void
}

export default function CosmicHubModal({ onClose }: Props) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<CosmicTab>(getInitialTab)

  // Phase 16: sentinel flags для UX-09 gating
  const hasFirstFeed = useGameStore((s) => s.hasFirstFeed)
  const hasFirstMission = useGameStore((s) => s.hasFirstMission)
  const isDev = import.meta.env.DEV

  // Локализованные labels — внутри компонента, чтобы пере-рендерить при смене языка.
  // Phase 16: tab id остаётся 'scouts' (sessionStorage backward compat),
  // но UI label теперь cosmic_hub.tab_ship («Корабль» / «Ship» / «Nave»).
  const TABS: Tab[] = [
    {
      id: 'scouts',
      label: t('cosmic_hub.tab_ship'),
      icon: '🚀',
      enabled: isDev || hasFirstFeed,
      lockReason: 'cosmic_hub.lock_first_feed',
    },
    {
      id: 'boxes',
      label: t('cosmic_hub.tab_boxes'),
      icon: '🎁',
      enabled: isDev || hasFirstMission,
      lockReason: 'cosmic_hub.lock_first_mission',
    },
    {
      id: 'serums',
      label: t('cosmic_hub.tab_serums'),
      icon: '🧪',
      enabled: true,  // всегда unlock'ed
    },
    {
      id: 'bestiary',
      label: t('cosmic_hub.tab_bestiary'),
      icon: '📖',
      // Bestiary tab всегда видим в Phase 16 — empty state. Phase 18 polish может gate.
      enabled: true,
    },
    {
      id: 'carriers',
      label: t('cosmic_hub.tab_carriers'),
      icon: '🐸',
      // Phase 17: carriers tab всегда видим. Empty state когда carriers пуст.
      enabled: true,
    },
  ]

  // Если активный таб теперь disabled — fall back на первый enabled
  useEffect(() => {
    const active = TABS.find((tab) => tab.id === activeTab)
    if (active && !active.enabled) {
      const firstEnabled = TABS.find((tab) => tab.enabled)
      if (firstEnabled) setActiveTab(firstEnabled.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFirstFeed, hasFirstMission])

  // Сохраняем активный таб в sessionStorage при каждом переключении (COSMIC-HUB-07)
  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY, activeTab) } catch { /* ignore */ }
  }, [activeTab])

  // Блокировать скролл body пока modal открыт
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const renderTab = () => {
    switch (activeTab) {
      // Phase 16: ShipTab заменил ScoutsTab. Pass onClose чтобы «Открыть карту» / «Изучить» закрывали Hub.
      case 'scouts':   return <ShipTab onClose={onClose} />
      // Phase 15: BoxesTab закрывает Hub при tap на box / open-all чтобы
       // CascadeRevealModal / BulkOpenSummary показывались на full screen.
      case 'boxes':    return <BoxesTab onClose={onClose} />
      // Phase 14: SerumsTab закрывает modal на select / drag-start, чтобы юзер
      // мог видеть ферму с halos.
      case 'serums':   return <SerumsTab onClose={onClose} />
      case 'bestiary': return <BestiaryTab />
      case 'carriers': return <CarriersTab />
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gray-950"
      style={{ touchAction: 'none' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <span className="text-white font-bold text-lg">🧬 {t('cosmic_hub.title')}</span>
        <button
          onClick={onClose}
          className="text-white/60 text-2xl leading-none px-2"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Tab strip — Phase 16: progressive disclosure (UX-09) с lock indicator */}
      <div className="flex border-b border-white/10 flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => tab.enabled && setActiveTab(tab.id)}
            disabled={!tab.enabled}
            title={!tab.enabled && tab.lockReason ? t(tab.lockReason) : undefined}
            className={[
              'flex-1 py-2 text-xs font-medium transition-colors',
              !tab.enabled
                ? 'text-white/20 cursor-not-allowed'
                : activeTab === tab.id
                  ? 'text-white border-b-2 border-emerald-400'
                  : 'text-white/40',
            ].join(' ')}
          >
            <span className="block text-base">{tab.enabled ? tab.icon : '🔒'}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {renderTab()}
      </div>
    </div>
  )
}
