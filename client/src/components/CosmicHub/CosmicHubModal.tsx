// Phase 11: Cosmic Hub fullscreen modal с 4 табами.
// Lazy-loaded из App.tsx (React.lazy + Suspense → отдельный chunk).
// sessionStorage сохраняет последний активный таб (COSMIC-HUB-07).
// Phase 16: progressive disclosure (UX-09) — табы Корабль/Боксы gated через
// sentinel флаги hasFirstFeed/hasFirstMission. DEV-mode unlocks all.

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { CosmicTab } from '../../store/cosmic/types'
import { useGameStore } from '../../store/gameStore'
import { ShipTab } from './ShipTab'
import { SerumInventoryTab } from './SerumInventoryTab'
import { BestiaryTab } from './BestiaryTab'
import { CarriersTab } from './CarriersTab'
import { CosmicShopTab } from './CosmicShopTab'
import { InventoryTab } from './InventoryTab'
import { ContactsTab } from './ContactsTab'
import { QuestsTab } from './QuestsTab'
import { PityCounterDisplay } from './PityCounterDisplay'
// Phase 22 Plan 22-06: defensive cosmos gate — даже если каким-то путём modal
// открыт без unlock (legacy state, dev tool), показать lock screen.
import { useCosmosUnlocked } from '../../utils/cosmosGate'

const SESSION_KEY = 'cosmic_last_tab'

function getInitialTab(): CosmicTab {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (
      saved === 'scouts' ||
      saved === 'boxes' ||
      saved === 'bestiary' ||
      saved === 'carriers' ||
      saved === 'shop' ||
      saved === 'inventory' ||
      saved === 'contacts' ||
      // Phase 28 Plan 28-01: accept 'quests' literal for 8th tab persistence.
      saved === 'quests'
    ) {
      return saved
    }
  } catch {
    /* ignore */
  }
  return 'scouts'
}

interface Tab {
  id: CosmicTab
  label: string
  icon: string
  enabled: boolean
  lockReason?: string // i18n key для tooltip
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
  // Phase 22 Plan 22-06: defensive cosmos gate.
  const cosmosUnlocked = useCosmosUnlocked()

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
      label: t('cosmic_hub.tab_station'),
      icon: '🏭',
      enabled: isDev || hasFirstMission,
      lockReason: 'cosmic_hub.lock_first_mission',
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
    {
      id: 'shop',
      label: t('cosmic_hub.tab_shop'),
      icon: '🛒',
      // Phase 22 Plan 22-05: shop всегда виден (essence обнуляется в empty state UI).
      enabled: true,
    },
    {
      id: 'inventory',
      label: t('cosmic_hub.tab_inventory'),
      icon: '🎒',
      // Phase 26 Plan 26-04: всегда виден после cosmos unlock (modal lock'ит весь
      // tab strip если !cosmosUnlocked — enabled: true достаточно).
      enabled: true,
    },
    {
      id: 'contacts',
      label: t('cosmic_hub.tab_contacts'),
      icon: '📡',
      // Phase 27 Plan 27-04: contacts tab всегда visible после cosmos unlock —
      // modal-level cosmos lock gates entire tab strip (existing pattern from
      // Phase 22-06 + Phase 26-04).
      enabled: true,
    },
    {
      id: 'quests',
      label: t('cosmic_hub.tab_quests'),
      icon: '📜',
      // Phase 28 Plan 28-01: quests tab всегда visible after cosmos unlock —
      // modal-level cosmos lock gates entire tab strip (existing pattern from
      // Phase 22-06 / 26-04 / 27-04).
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
    try {
      sessionStorage.setItem(SESSION_KEY, activeTab)
    } catch {
      /* ignore */
    }
  }, [activeTab])

  const renderTab = () => {
    switch (activeTab) {
      // Phase 16: ShipTab заменил ScoutsTab. Pass onClose чтобы «Открыть карту» / «Изучить» закрывали Hub.
      case 'scouts':
        return <ShipTab onClose={onClose} />
      // Phase 15: BoxesTab закрывает Hub при tap на box / open-all чтобы
      // CascadeRevealModal / BulkOpenSummary показывались на full screen.
      case 'boxes':
        return <SerumInventoryTab onClose={onClose} />
      case 'bestiary':
        return <BestiaryTab />
      case 'carriers':
        return <CarriersTab />
      case 'shop':
        return <CosmicShopTab />
      // Phase 26 Plan 26-04: read-only inventory single-view (currencies + serums
      // + artifacts placeholder + race relationships placeholder).
      case 'inventory':
        return <InventoryTab />
      // Phase 27 Plan 27-04: contacts tab — 10 races list + race detail in-tab nav.
      case 'contacts':
        return <ContactsTab />
      // Phase 28 Plan 28-04: real QuestsTab replaces Plan 28-01 inline stub.
      // Foundation i18n key (cosmic_hub.quests for the stub copy) remains in
      // JSON for backward compat / fallback but is no longer rendered.
      case 'quests':
        return <QuestsTab />
    }
  }

  return createPortal(
    <>
      {/* Phase 25-01: CSS keyframe bobble для активного таба (mount один раз). */}
      <style>{`
        @keyframes cosmic-tab-bobble {
          0%, 100% { transform: scaleY(1.0); }
          50% { transform: scaleY(1.02); }
        }
      `}</style>
      {/* Phase 25-01: dark cosmic shell + pink-tinted close button. */}
      <div
        className="fixed z-50 flex flex-col"
        style={{
          top: 'calc(12% + 54px)',
          bottom: '13%',
          left: 0,
          right: 0,
          background: '#1a2e1a',
          color: '#fff',
          touchAction: 'manipulation',
          pointerEvents: 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: '#fff',
              textShadow: '0 1px 0 rgba(0,0,0,0.4)',
            }}
          >
            🧬 {t('cosmic_hub.title')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              color: 'rgba(236,72,153,0.7)',
              fontSize: 24,
              lineHeight: 1,
              padding: '0 8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ec4899'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(236,72,153,0.7)'
            }}
          >
            ×
          </button>
        </div>

        {/* Phase 22 Plan 22-06: defensive cosmos gate — если флаг false (legacy
          state или dev), показать lock screen вместо табов.
          Phase 25-01: WelcomeModal-style dark card + gold title. Текст
          оставлен hard-coded (i18n ключей cosmic_hub.locked.* нет в ru.json —
          не trogаем i18n per scope). */}
        {!cosmosUnlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div
              style={{
                borderRadius: 16,
                background: '#1a2e1a',
                border: '2px solid rgba(255,255,255,0.15)',
                padding: 24,
                maxWidth: 320,
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  fontSize: 64,
                  marginBottom: 16,
                  lineHeight: 1,
                }}
              >
                🔒
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#fde047',
                  marginBottom: 8,
                  textShadow: '0 1px 0 rgba(0,0,0,0.4)',
                }}
              >
                Космос закрыт
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#d4d4d8',
                  lineHeight: 1.4,
                }}
              >
                Соедините две L18 лягушки чтобы открыть космическую механику.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Phase 25-01: tab strip pink-active underline + bobble + dim inactive/disabled.
          Hover state опускаем (mobile-first demo) — pink-tint появится в Plan 25-04 polish. */}
            <div
              className="flex flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                const isDisabled = !tab.enabled
                const baseStyle = {
                  flex: 1,
                  padding: '12px 4px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: 12,
                  transition: 'color 150ms ease',
                  touchAction: 'manipulation' as const,
                }
                const stateStyle = isDisabled
                  ? {
                      color: 'rgba(255,255,255,0.2)',
                      fontWeight: 500,
                      opacity: 0.6,
                      cursor: 'not-allowed' as const,
                    }
                  : isActive
                    ? {
                        color: '#fff',
                        fontWeight: 700,
                        borderBottom: '3px solid #ec4899',
                        marginBottom: -1, // overlap parent 1px border, чтобы pink underline был «поверх»
                        cursor: 'pointer' as const,
                        animation:
                          'cosmic-tab-bobble 1.5s ease-in-out infinite',
                        transformOrigin: 'bottom center' as const,
                      }
                    : {
                        color: 'rgba(255,255,255,0.4)',
                        fontWeight: 500,
                        cursor: 'pointer' as const,
                      }
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => tab.enabled && setActiveTab(tab.id)}
                    disabled={isDisabled}
                    title={
                      isDisabled && tab.lockReason
                        ? t(tab.lockReason)
                        : undefined
                    }
                    style={{ ...baseStyle, ...stateStyle }}
                  >
                    <span style={{ display: 'block', fontSize: 16 }}>
                      {tab.enabled ? tab.icon : '🔒'}
                    </span>
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">{renderTab()}</div>

            {/* Phase 19-03 (UX-01): progressive pity counter footer */}
            <PityCounterDisplay />
          </>
        )}
      </div>
    </>,
    document.body,
  )
}
