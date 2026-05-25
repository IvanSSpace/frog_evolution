import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { CosmicTab } from '../../store/cosmic/types'
import { CarriersTab } from './CarriersTab'
import { ContactsTab } from './ContactsTab'
import { QuestsTab } from './QuestsTab'
import { SerumInventoryTab } from './SerumInventoryTab'
import { PityCounterDisplay } from './PityCounterDisplay'
import { useCosmosUnlocked } from '../../utils/cosmosGate'
import { useModalLock } from '../../utils/modalLock'

type AllowedTab = Extract<
  CosmicTab,
  'carriers' | 'contacts' | 'quests' | 'serum'
>

const SESSION_KEY = 'cosmic_last_tab'

function getInitialTab(): AllowedTab {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (
      saved === 'carriers' ||
      saved === 'contacts' ||
      saved === 'quests' ||
      saved === 'serum'
    ) {
      return saved
    }
  } catch {
    /* ignore */
  }
  return 'carriers'
}

interface Tab {
  id: AllowedTab
  label: string
  icon: string
}

interface Props {
  onClose: () => void
}

export default function CosmicHubModal({ onClose }: Props) {
  useModalLock()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<AllowedTab>(getInitialTab)
  const cosmosUnlocked = useCosmosUnlocked()

  const TABS: Tab[] = [
    { id: 'carriers', label: t('cosmic_hub.tab_carriers'), icon: '🐸' },
    { id: 'serum', label: 'Серумы', icon: '🧪' },
    { id: 'contacts', label: t('cosmic_hub.tab_contacts'), icon: '📡' },
    { id: 'quests', label: t('cosmic_hub.tab_quests'), icon: '📜' },
  ]

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, activeTab)
    } catch {
      /* ignore */
    }
  }, [activeTab])

  const renderTab = () => {
    switch (activeTab) {
      case 'carriers':
        return <CarriersTab />
      case 'contacts':
        return <ContactsTab />
      case 'quests':
        return <QuestsTab />
      case 'serum':
        return <SerumInventoryTab onClose={onClose} />
    }
  }

  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'auto',
        padding: '0 16px 4px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop relative"
        style={{
          width: '100%',
          maxWidth: 380,
          height: '75vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0"
          style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-3xl"
            style={{ color: '#15803d', letterSpacing: 1.5 }}
          >
            {t('cosmic_hub.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('settings_modal.close')}
            className="ff-tile w-9 h-9 text-lg flex-shrink-0"
            style={{
              ['--ff-tile-from' as never]: '#fca5a5',
              ['--ff-tile-to' as never]: '#dc2626',
              ['--ff-tile-border' as never]: '#7f1d1d',
              color: '#fff',
            }}
          >
            ✕
          </button>
        </div>

        {!cosmosUnlocked ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="text-6xl mb-3">🔒</div>
            <div
              className="ff-display text-2xl mb-2"
              style={{ color: '#15803d' }}
            >
              Космос закрыт
            </div>
            <div
              className="ff-body text-sm font-bold"
              style={{ color: '#365314' }}
            >
              Соедините две L18 лягушки чтобы открыть космическую механику.
            </div>
          </div>
        ) : (
          <>
            <div
              className="flex gap-2 px-3 pt-2 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(77,107,31,0.2)' }}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className="ff-btn text-xs flex-1"
                    style={{
                      paddingLeft: 6,
                      paddingRight: 6,
                      paddingTop: 4,
                      paddingBottom: 4,
                      opacity: isActive ? 1 : 0.55,
                      ['--ff-btn-from' as never]: isActive
                        ? '#4ade80'
                        : '#cbd5e1',
                      ['--ff-btn-to' as never]: isActive
                        ? '#16a34a'
                        : '#64748b',
                      ['--ff-btn-border' as never]: isActive
                        ? '#14532d'
                        : '#334155',
                    }}
                  >
                    <span style={{ marginRight: 4 }}>{tab.icon}</span>
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 overflow-y-auto">{renderTab()}</div>
            <PityCounterDisplay />
          </>
        )}
      </div>
    </div>
  )
}
