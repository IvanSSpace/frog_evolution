import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { TintedFrog } from './TintedFrog'
import { setLang, type Lang } from '../../i18n/index'
import { useGameStore } from '../../store/gameStore'
import { FROG_LEVELS, getTargetIncomePerSec } from '../../game/config/frogs'
import { getTelegramWebApp, isDevMode } from '../../utils/telegram'
import { fmtRate } from '../../utils/formatting'

type Tab = 'bestiary' | 'settings'
type Props = { onClose: () => void }

export function SettingsModal({ onClose }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('settings')

  return (
    <div
      className="ff-fade"
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        display: 'flex', flexDirection: 'column',
        background: '#1a2e1a',
        pointerEvents: 'auto',
      }}
    >
      {/* Tab header */}
      <div
        className="ff-bar flex items-center gap-2 px-3 w-full"
        style={{ height: '13%', flexShrink: 0 }}
      >
        <button
          onClick={() => setTab('bestiary')}
          className={`ff-btn flex-1 text-sm py-2 ${tab === 'bestiary' ? 'ff-btn-green' : 'ff-btn-grey'}`}
        >
          {t('settings_modal.tab_bestiary')}
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`ff-btn flex-1 text-sm py-2 ${tab === 'settings' ? 'ff-btn-green' : 'ff-btn-grey'}`}
        >
          {t('settings_modal.tab_settings')}
        </button>
        <button
          onClick={onClose}
          className="ff-tile w-12 h-12 text-xl flex-shrink-0"
          style={{
            ['--ff-tile-from' as never]: '#fca5a5',
            ['--ff-tile-to' as never]: '#dc2626',
            ['--ff-tile-border' as never]: '#7f1d1d',
            color: '#fff',
          }}
        >
          {t('settings_modal.close')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'bestiary' ? <BestiaryTab /> : <SettingsTab />}
      </div>
    </div>
  )
}

// ────────────────────────── BESTIARY TAB ──────────────────────────

function BestiaryTab() {
  const discoveredLevels = useGameStore((s) => s.discoveredLevels)

  return (
    <div className="grid grid-cols-2 gap-2">
      {FROG_LEVELS.map((_, idx) => {
        const level = idx + 1
        const isUnlocked = discoveredLevels.includes(level)
        return <BestiaryCard key={level} level={level} isUnlocked={isUnlocked} />
      })}
    </div>
  )
}

function BestiaryCard({ level, isUnlocked }: { level: number; isUnlocked: boolean }) {
  const { t } = useTranslation()
  const cfg = FROG_LEVELS[level - 1]
  const frogName = isUnlocked ? t(`frogs.${level}`) : t('bestiary.locked')
  const locName = t(`locations.${cfg.location}`)
  const income = fmtRate(getTargetIncomePerSec(level))

  return (
    <div className="ff-card p-2.5 flex flex-col items-center gap-1.5">
      {/* Image container */}
      <div
        className="relative flex items-center justify-center rounded-xl"
        style={{
          width: 64, height: 64, flexShrink: 0,
          background: 'linear-gradient(180deg, #ecfccb 0%, #bef264 100%)',
          border: '2px solid #4d7c0f',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        {isUnlocked ? (
          <TintedFrog
            path={cfg.path}
            tint={cfg.tint}
            alt={frogName}
            className="object-contain"
            style={{ width: 52, height: 52 }}
          />
        ) : (
          <img
            src={cfg.path}
            alt={frogName}
            className="object-contain"
            style={{ width: 52, height: 52, filter: 'grayscale(1) blur(2px)' }}
          />
        )}
        {!isUnlocked && (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 900, color: '#444',
              textShadow: '0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            {t('bestiary.locked')}
          </div>
        )}
      </div>

      {/* Name */}
      <div
        className="ff-display text-center leading-tight"
        style={{ fontSize: 11, color: '#15803d', maxWidth: '100%', wordBreak: 'break-word' }}
      >
        {frogName}
      </div>

      {/* Stats (unlocked only) */}
      {isUnlocked && (
        <div className="w-full ff-body font-bold leading-snug" style={{ fontSize: 9, color: '#166534' }}>
          <div className="flex justify-between">
            <span>{t('bestiary.income_label')}</span>
            <span className="tabular-nums">{income}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('bestiary.size_label')}</span>
            <span>{cfg.size}×</span>
          </div>
          <div className="flex justify-between">
            <span>{t('bestiary.location_label')}</span>
            <span>{locName}</span>
          </div>
          {!cfg.availableInShop && (
            <div
              className="text-center mt-0.5"
              style={{ color: '#7e22ce', fontSize: 8 }}
            >
              {t('bestiary.merge_only')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ────────────────────────── SETTINGS TAB ──────────────────────────

function SettingsTab() {
  const { t, i18n } = useTranslation()
  const numberFormat = useGameStore((s) => s.numberFormat)
  const setNumberFormat = useGameStore((s) => s.setNumberFormat)
  const addGold = useGameStore((s) => s.addGold)
  const devResetUpgrades = useGameStore((s) => s.devResetUpgrades)
  const currentLang = i18n.language as Lang

  const handleBugReport = () => {
    // TODO: replace with actual Telegram username
    const url = 'https://t.me/your_telegram_username'
    const tg = getTelegramWebApp()
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Language */}
      <SettingsRow label={t('settings.language')}>
        <div className="flex gap-1.5">
          {(['ru', 'en', 'es'] as Lang[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLang(lang)}
              className={`ff-btn text-xs px-3 py-1.5 ${currentLang === lang ? 'ff-btn-green' : 'ff-btn-grey'}`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </SettingsRow>

      {/* Number format */}
      <SettingsRow label={t('settings.number_format')}>
        <div className="flex gap-1.5">
          <button
            onClick={() => setNumberFormat('full')}
            className={`ff-btn text-xs py-1.5 ${numberFormat === 'full' ? 'ff-btn-green' : 'ff-btn-grey'}`}
            style={{ paddingLeft: 8, paddingRight: 8 }}
          >
            {t('settings.format_full')}
          </button>
          <button
            onClick={() => setNumberFormat('short')}
            className={`ff-btn text-xs py-1.5 ${numberFormat === 'short' ? 'ff-btn-green' : 'ff-btn-grey'}`}
            style={{ paddingLeft: 8, paddingRight: 8 }}
          >
            {t('settings.format_short')}
          </button>
        </div>
      </SettingsRow>

      {/* Music (stub) */}
      <SettingsRow label={t('settings.music')}>
        <span className="ff-body text-xs font-bold" style={{ color: '#6b7280' }}>
          {t('settings.music_stub')}
        </span>
      </SettingsRow>

      {/* Sound effects (stub) */}
      <SettingsRow label={t('settings.sounds')}>
        <span className="ff-body text-xs font-bold" style={{ color: '#6b7280' }}>
          {t('settings.sounds_stub')}
        </span>
      </SettingsRow>

      {/* Bug report */}
      <button
        onClick={handleBugReport}
        className="ff-btn ff-btn-red text-sm w-full mt-2"
      >
        {t('settings.bug_report')}
      </button>

      {/* DEV TOOLS */}
      {isDevMode() && (
        <div className="flex flex-col gap-2 mt-2">
          <div
            className="ff-body text-xs font-bold text-center py-1 rounded"
            style={{ background: '#7f1d1d', color: '#fca5a5', letterSpacing: '0.05em' }}
          >
            DEV TOOLS
          </div>
          <button
            onClick={devResetUpgrades}
            className="ff-btn ff-btn-red text-sm w-full"
          >
            Сбросить апгрейды
          </button>
          <button
            onClick={() => addGold(500_000_000)}
            className="ff-btn ff-btn-green text-sm w-full"
          >
            +500 000 000
          </button>
        </div>
      )}
    </div>
  )
}

function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ff-card p-3 flex items-center justify-between gap-3">
      <span className="ff-body font-bold text-emerald-900 text-sm flex-shrink-0">{label}</span>
      {children}
    </div>
  )
}
