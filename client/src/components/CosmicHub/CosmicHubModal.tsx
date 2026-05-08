// Phase 11: Cosmic Hub fullscreen modal с 4 табами.
// Lazy-loaded из App.tsx (React.lazy + Suspense → отдельный chunk).
// sessionStorage сохраняет последний активный таб (COSMIC-HUB-07).

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { CosmicTab } from '../../store/cosmic/types'
import { ShipTab } from './ShipTab'
import { BoxesTab } from './BoxesTab'
import { SerumsTab } from './SerumsTab'
import { BestiaryTab } from './BestiaryTab'

const SESSION_KEY = 'cosmic_last_tab'

function getInitialTab(): CosmicTab {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (
      saved === 'scouts' || saved === 'boxes' ||
      saved === 'serums' || saved === 'bestiary'
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
}

interface Props {
  onClose: () => void
}

export default function CosmicHubModal({ onClose }: Props) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<CosmicTab>(getInitialTab)

  // Локализованные labels — внутри компонента, чтобы пере-рендерить при смене языка.
  // Phase 16: tab id остаётся 'scouts' (sessionStorage backward compat),
  // но UI label теперь cosmic_hub.tab_ship («Корабль» / «Ship» / «Nave»).
  const TABS: Tab[] = [
    { id: 'scouts',   label: t('cosmic_hub.tab_ship'),     icon: '🚀' },
    { id: 'boxes',    label: t('cosmic_hub.tab_boxes'),    icon: '🎁' },
    { id: 'serums',   label: t('cosmic_hub.tab_serums'),   icon: '🧪' },
    { id: 'bestiary', label: t('cosmic_hub.tab_bestiary'), icon: '📖' },
  ]

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
      case 'boxes':    return <BoxesTab />
      // Phase 14: SerumsTab закрывает modal на select / drag-start, чтобы юзер
      // мог видеть ферму с halos.
      case 'serums':   return <SerumsTab onClose={onClose} />
      case 'bestiary': return <BestiaryTab />
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

      {/* Tab strip */}
      <div className="flex border-b border-white/10 flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex-1 py-2 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'text-white border-b-2 border-emerald-400'
                : 'text-white/40',
            ].join(' ')}
          >
            <span className="block text-base">{tab.icon}</span>
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
