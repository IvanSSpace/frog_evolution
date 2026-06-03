import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { TintedFrog } from './TintedFrog'
import { setLang, type Lang } from '../../i18n/index'
import { useGameStore } from '../../store/gameStore'
import {
  FROG_LEVELS,
  getFrogPath,
  getTargetIncomePerSec,
  getDisplaySize,
} from '../../game/config/frogs'
import { getTelegramWebApp, isDevMode } from '../../utils/telegram'
import { ELEMENTS } from '../../store/cosmic/types'
import { fmtRate } from '../../utils/formatting'
import { PlayerPanel } from '../../audio/components/PlayerPanel'
import { sfx } from '../../audio/sfx'
import { saveGameState } from '../../api/gameSync'
import { useModalLock } from '../../utils/modalLock'
import { useAchievementsStore } from '../../store/achievementsStore'
import { usePremiumStore } from '../../store/premiumStore'
import { ACHIEVEMENTS } from '../../game/achievements/config'
import { metricValue } from '../../game/achievements/evaluator'

type Tab = 'bestiary' | 'achievements' | 'settings' | 'player' | 'mechanics'
type Props = { onClose: () => void }

export function SettingsModal({ onClose }: Props) {
  useModalLock()
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('settings')
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 280)
  }, [closing, onClose])

  const markBestiarySeen = useGameStore((s) => s.markBestiarySeen)
  // Кол-во достигнутых, но не забранных ачивок → бейдж на вкладке.
  const achPending = useAchievementsStore((s) => s.pendingIds().length)

  // Mark discoveredLevels как «виденные» в бестиарии когда юзер переключается
  // на bestiary tab. Реагирует на смену tab — multi-open / tab-switch покрыты.
  useEffect(() => {
    if (tab === 'bestiary') {
      markBestiarySeen()
    }
  }, [tab, markBestiarySeen])

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        pointerEvents: 'auto',
        background: 'transparent',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad))',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 151,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div
          className={`ff-panel ${closing ? 'ff-slide-up' : 'ff-slide-down'}`}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-1.5 px-3 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(77,107,31,0.4)' }}
          >
            <button
              onClick={() => setTab('bestiary')}
              className={`ff-btn flex-1 text-xs py-2 ${tab === 'bestiary' ? 'ff-btn-green' : 'ff-btn-grey'}`}
            >
              {t('settings_modal.tab_bestiary')}
            </button>
            <button
              onClick={() => setTab('player')}
              className={`ff-btn flex-1 text-xs py-2 ${tab === 'player' ? 'ff-btn-green' : 'ff-btn-grey'}`}
            >
              {t('settings_modal.tab_player')}
            </button>
            <button
              onClick={() => setTab('settings')}
              className={`ff-btn flex-1 text-xs py-2 ${tab === 'settings' ? 'ff-btn-green' : 'ff-btn-grey'}`}
            >
              {t('settings_modal.tab_settings')}
            </button>
            <button
              type="button"
              onClick={() => setTab('achievements')}
              aria-label="Ачивки"
              style={{ touchAction: 'manipulation', position: 'relative' }}
              className={`ff-btn flex-shrink-0 text-xs py-2 px-3 ${tab === 'achievements' ? 'ff-btn-green' : 'ff-btn-grey'}`}
            >
              🏆
              {achPending > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 999,
                    background: '#dc2626',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: '16px',
                    textAlign: 'center',
                    padding: '0 4px',
                  }}
                >
                  {achPending}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('mechanics')}
              aria-label="Механики"
              className={`ff-btn flex-shrink-0 text-xs py-2 px-3 ${tab === 'mechanics' ? 'ff-btn-green' : 'ff-btn-grey'}`}
            >
              ?
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-label={t('settings_modal.close')}
              className="ff-tile w-10 h-10 text-xl flex-shrink-0"
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

          {/* Content */}
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden ff-no-scrollbar px-4 py-3"
            style={{
              paddingBottom: 16,
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
            }}
          >
            {tab === 'bestiary' && <BestiaryTab />}
            {tab === 'achievements' && <AchievementsTab />}
            {tab === 'player' && <PlayerPanel />}
            {tab === 'settings' && <SettingsTab />}
            {tab === 'mechanics' && <MechanicsTab />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ────────────────────────── BESTIARY TAB ──────────────────────────

function BestiaryTab() {
  const discoveredLevels = useGameStore((s) => s.discoveredLevels)
  const total = FROG_LEVELS.length
  const [idx, setIdx] = useState(0)
  const [dragDx, setDragDx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const lockedAxis = useRef<'x' | 'y' | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  const prev = () => setIdx((i) => Math.max(0, i - 1))
  const next = () => setIdx((i) => Math.min(total - 1, i + 1))

  const beginDrag = (x: number, y: number) => {
    startX.current = x
    startY.current = y
    lockedAxis.current = null
    setDragDx(0)
    setIsDragging(true)
  }

  const updateDrag = (x: number, y: number): boolean => {
    if (startX.current === null || startY.current === null) return false
    const dx = x - startX.current
    const dy = y - startY.current
    if (lockedAxis.current === null) {
      // Lock axis only после небольшого movement, чтобы случайно не сразу
      // зафиксировать вертикаль на быстром свайпе по диагонали.
      const totalMove = Math.abs(dx) + Math.abs(dy)
      if (totalMove < 6) return false
      lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (lockedAxis.current === 'y') return false
    setDragDx(dx)
    return true
  }

  const endDrag = () => {
    const dx = dragDx
    setIsDragging(false)
    setDragDx(0)
    startX.current = null
    startY.current = null
    const wasHorizontal = lockedAxis.current === 'x'
    lockedAxis.current = null
    if (!wasHorizontal) return
    const w = viewportRef.current?.clientWidth ?? 0
    const threshold = Math.max(40, w * 0.18)
    if (dx > threshold) prev()
    else if (dx < -threshold) next()
  }

  const onTouchStart = (e: React.TouchEvent) => {
    const tch = e.touches[0]
    if (!tch) return
    beginDrag(tch.clientX, tch.clientY)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const tch = e.touches[0]
    if (!tch) return
    updateDrag(tch.clientX, tch.clientY)
  }
  const onTouchEnd = () => {
    endDrag()
  }

  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    width: 40,
    height: 40,
    ['--ff-tile-from' as never]: '#a7f3d0',
    ['--ff-tile-to' as never]: '#34d399',
    ['--ff-tile-border' as never]: '#065f46',
    color: '#fff',
    fontSize: 22,
    lineHeight: 1,
  }

  return (
    <div
      className="flex flex-col items-stretch gap-3"
      style={{
        minHeight: '100%',
        justifyContent: 'center',
        // Уходим за пределы px-4 модального content scroll, чтобы карусель
        // была шириной во весь модальный панель — слайды выезжают из самых
        // краёв при свайпе.
        marginLeft: -16,
        marginRight: -16,
      }}
    >
      <div
        ref={viewportRef}
        className="relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          beginDrag(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse') return
          if (!isDragging) return
          updateDrag(e.clientX, e.clientY)
        }}
        onPointerUp={(e) => {
          if (e.pointerType === 'mouse') return
          endDrag()
        }}
        onPointerCancel={(e) => {
          if (e.pointerType === 'mouse') return
          endDrag()
        }}
        style={{ overflow: 'hidden', touchAction: 'pan-y' }}
      >
        {/* Slide track — все карточки в ряд, translateX переключает текущую.
            При drag (isDragging=true) добавляется dragDx и отключается transition,
            чтобы трек шёл за пальцем 1:1. */}
        <div
          style={{
            display: 'flex',
            transform: `translate3d(calc(-${idx * 100}% + ${dragDx}px), 0, 0)`,
            transition: isDragging
              ? 'none'
              : 'transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)',
            willChange: 'transform',
            touchAction: 'pan-y',
          }}
        >
          {FROG_LEVELS.map((_, i) => {
            const level = i + 1
            const isUnlocked = discoveredLevels.includes(level)
            return (
              <div
                key={level}
                style={{
                  flex: '0 0 100%',
                  minWidth: 0,
                  paddingLeft: 16,
                  paddingRight: 16,
                  paddingBottom: 12,
                  boxSizing: 'border-box',
                }}
              >
                <BestiaryCard level={level} isUnlocked={isUnlocked} />
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={prev}
          aria-label="prev"
          disabled={idx === 0}
          className="ff-tile"
          style={{
            ...arrowStyle,
            left: 24,
            opacity: idx === 0 ? 0.4 : 1,
            pointerEvents: idx === 0 ? 'none' : 'auto',
          }}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="next"
          disabled={idx === total - 1}
          className="ff-tile"
          style={{
            ...arrowStyle,
            right: 24,
            opacity: idx === total - 1 ? 0.4 : 1,
            pointerEvents: idx === total - 1 ? 'none' : 'auto',
          }}
        >
          ›
        </button>
      </div>
    </div>
  )
}

// Высота карточки должна совпадать unlocked/locked — фиксируем через minHeight.
// Подобрано так чтобы помещаться в viewport модалки без скролла на mobile.
const BESTIARY_CARD_MIN_HEIGHT = 560

function BestiaryCard({
  level,
  isUnlocked,
}: {
  level: number
  isUnlocked: boolean
}) {
  const { t } = useTranslation()
  const cfg = FROG_LEVELS[level - 1]
  const frogName = t(`frogs.${level}`)
  const locName = t(`locations.${cfg.location}`)
  const income = fmtRate(getTargetIncomePerSec(level))
  const [previewTier, setPreviewTier] = useState<0 | 1 | 2>(0)
  const cycleTier = () => setPreviewTier((t) => ((t + 1) % 3) as 0 | 1 | 2)

  if (!isUnlocked) {
    return (
      <div
        className="ff-card ff-crt p-5 flex items-center justify-center"
        style={{
          minHeight: BESTIARY_CARD_MIN_HEIGHT,
          border: 'none',
          overflow: 'hidden',
        }}
      >
        <span
          className="ff-display"
          style={{
            fontSize: 130,
            lineHeight: 1,
            color: '#9ca3af',
            textShadow: '0 4px 0 rgba(0,0,0,0.2)',
            userSelect: 'none',
          }}
        >
          ?
        </span>
      </div>
    )
  }

  return (
    <div
      className="ff-card ff-crt p-5 flex flex-col items-center gap-2 relative"
      style={{
        minHeight: BESTIARY_CARD_MIN_HEIGHT,
        border: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Tier preview toggle — cycles 1 → 2 → 3 → 1 */}
      <button
        type="button"
        onClick={cycleTier}
        className="ff-btn ff-btn-green"
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 40,
          height: 40,
          padding: 0,
          fontSize: 18,
          zIndex: 2,
        }}
        aria-label="cycle evolution tier"
      >
        {previewTier + 1}
      </button>

      {/* Image container — без фона и рамки, лягушка на полосатом фоне карточки */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 130,
          height: 130,
          flexShrink: 0,
        }}
      >
        <TintedFrog
          path={getFrogPath(level, previewTier)}
          tint={cfg.tint}
          alt={frogName}
          className="object-contain"
          style={{ width: 104, height: 104 }}
        />
      </div>

      {/* Name */}
      <div
        className="ff-display text-center leading-tight"
        style={{
          fontSize: 26,
          color: '#a8e088',
          maxWidth: '100%',
          wordBreak: 'break-word',
          marginTop: -4,
        }}
      >
        {frogName}
      </div>

      {/* Stats */}
      <div
        className="w-full ff-body font-bold leading-relaxed"
        style={{
          fontSize: 18,
          color: '#7adb9f',
          marginTop: -8,
          paddingLeft: 36,
          paddingRight: 36,
        }}
      >
        <div className="flex justify-between">
          <span>{t('bestiary.income_label')}</span>
          <span className="tabular-nums">{income}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('bestiary.size_label')}</span>
          <span>{getDisplaySize(level)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('bestiary.location_label')}</span>
          <span>{locName}</span>
        </div>
        {!cfg.availableInShop && (
          <div
            className="text-center mt-2"
            style={{ color: '#d8b4fe', fontSize: 15 }}
          >
            {t('bestiary.merge_only')}
          </div>
        )}
      </div>

      {/* Лор из i18n (bestiary_lore.<level>). */}
      <div
        className="w-full ff-body leading-relaxed"
        style={{
          fontSize: 15,
          color: '#b8d496',
          marginTop: 32,
          paddingBottom: 8,
          minHeight: 150,
        }}
      >
        {t(`bestiary_lore.${level}`)}
      </div>
    </div>
  )
}

// ────────────────────────── SETTINGS TAB ──────────────────────────

const sfxSubscribe = (cb: () => void): (() => void) => sfx.subscribe(cb)
const getSfxMuted = (): boolean => sfx.isMuted()

function SettingsTab() {
  const { t, i18n } = useTranslation()
  const devFlags = useGameStore((s) => s.devFlags)
  const addGold = useGameStore((s) => s.addGold)
  const devResetUpgrades = useGameStore((s) => s.devResetUpgrades)
  const devClearAllFrogs = useGameStore((s) => s.devClearAllFrogs)
  const devResetFrogTiers = () => {
    const fresh = new Array(18).fill(0)
    const freshCooldowns = new Array(18).fill(0)
    useGameStore.setState({
      frogTiers: fresh,
      frogTierCooldowns: freshCooldowns,
    })
    void import('../../store/persistence').then((m) => {
      m.saveFrogTiers(fresh)
      m.saveFrogTierCooldowns(freshCooldowns)
    })
  }
  const addSerum = useGameStore((s) => s.addSerum)

  // Phase 22: dev-кнопки делают local mutation + немедленный PUT на сервер
  // (минуя throttle), чтобы изменения сразу видны после reload.
  const devSync = (action: () => void) => async () => {
    action()
    await saveGameState(true)
  }
  const currentLang = i18n.language as Lang
  const [sfxMuted, setSfxMuted] = useState(getSfxMuted)
  useEffect(() => sfxSubscribe(() => setSfxMuted(getSfxMuted())), [])

  const handleBugReport = () => {
    const url = 'https://t.me/frog_evolution_support'
    const tg = getTelegramWebApp()
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const username = useGameStore((s) => s.username)
  const telegramId = useGameStore((s) => s.telegramId)

  return (
    <div className="flex flex-col gap-3">
      {/* Account info — useful for testing/identifying current user. */}
      <SettingsRow label="Аккаунт">
        <div
          style={{
            fontSize: 13,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            color: '#b8d496',
            userSelect: 'text',
          }}
        >
          {username ?? telegramId ?? '(loading…)'}
        </div>
      </SettingsRow>

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

      {/* Sound effects */}
      <SettingsRow label={t('settings.sounds')}>
        <button
          onClick={() => sfx.setMuted(!sfxMuted)}
          className={`ff-btn text-xs px-3 py-1.5 ${!sfxMuted ? 'ff-btn-green' : 'ff-btn-grey'}`}
        >
          {!sfxMuted ? t('player.on') : t('player.off')}
        </button>
      </SettingsRow>

      {/* Bug report */}
      <button
        onClick={handleBugReport}
        className="ff-btn ff-btn-red text-sm w-full mt-2"
      >
        {t('settings.bug_report')}
      </button>

      {/* DEV TOOLS (visible: local dev OR user has 'dev_settings_tools' flag from admin) */}
      {(isDevMode() || devFlags.includes('dev_settings_tools')) && (
        <div className="flex flex-col gap-2 mt-2">
          <div
            className="ff-body text-xs font-bold text-center py-1 rounded"
            style={{
              background: '#7f1d1d',
              color: '#fca5a5',
              letterSpacing: '0.05em',
            }}
          >
            DEV TOOLS
          </div>
          <button
            onClick={devSync(devResetUpgrades)}
            className="ff-btn ff-btn-red text-sm w-full"
          >
            Сбросить апгрейды
          </button>
          <button
            onClick={devSync(devResetFrogTiers)}
            className="ff-btn ff-btn-red text-sm w-full"
          >
            Сбросить эволюцию лягушек
          </button>
          <button
            onClick={devSync(devClearAllFrogs)}
            className="ff-btn ff-btn-red text-sm w-full"
          >
            Удалить всех лягушат
          </button>
          <button
            onClick={devSync(() => addGold(500_000_000))}
            className="ff-btn ff-btn-green text-sm w-full"
          >
            +500 000 000
          </button>
          <button
            onClick={devSync(() => {
              for (const el of ELEMENTS) {
                addSerum(el, 1)
              }
            })}
            className="ff-btn ff-btn-green text-sm w-full"
          >
            Выдать по 1 сыворотке каждого типа
          </button>
        </div>
      )}
    </div>
  )
}

function SettingsRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="ff-card p-3 flex items-center justify-between gap-3 min-w-0">
      <span className="ff-body font-bold text-emerald-900 text-sm min-w-0 break-words">
        {label}
      </span>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

// ────────────────────────── ACHIEVEMENTS TAB ──────────────────────────

function AchievementsTab() {
  // Подписка на поля, двигающие метрики — чтобы бары обновлялись вживую.
  useGameStore((s) => s.gold)
  useGameStore((s) => s.discoveredLevels)
  useGameStore((s) => s.locationFrogs)
  useGameStore((s) => s.l18MergesCount)
  const claimed = useAchievementsStore((s) => s.claimed)
  const claim = useAchievementsStore((s) => s.claim)
  const stars = usePremiumStore((s) => s.stars)

  return (
    <div className="flex flex-col gap-3">
      {/* Баланс премиум-валюты */}
      <div
        className="ff-card p-3 flex items-center justify-between"
        style={{ border: 'none' }}
      >
        <span className="ff-body font-bold" style={{ color: '#a8e088' }}>
          Премиум-валюта
        </span>
        <span className="ff-display" style={{ fontSize: 20, color: '#ffd86b' }}>
          ⭐ {stars}
        </span>
      </div>

      {ACHIEVEMENTS.map((a) => {
        const value = metricValue(a.metric)
        const isClaimed = !!claimed[a.id]
        const done = value >= a.target
        const claimable = done && !isClaimed
        const pct = Math.min(1, value / a.target)
        return (
          <div
            key={a.id}
            className="ff-card p-3 flex flex-col gap-2"
            style={{ border: 'none', opacity: isClaimed ? 0.6 : 1 }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 26, lineHeight: 1 }}>{a.icon}</span>
              <div className="flex-1 min-w-0">
                <div
                  className="ff-body font-bold"
                  style={{ fontSize: 15, color: '#a8e088' }}
                >
                  {a.title}
                </div>
                <div style={{ fontSize: 12, color: '#b8d496' }}>{a.desc}</div>
              </div>
              <span
                className="ff-display flex-shrink-0"
                style={{ fontSize: 15, color: '#ffd86b' }}
              >
                +{a.reward} ⭐
              </span>
            </div>

            {/* Прогресс-бар */}
            <div
              style={{
                height: 12,
                borderRadius: 999,
                background: 'rgba(0,0,0,0.4)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct * 100}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: done
                    ? 'linear-gradient(90deg, #5fe3d0, #a8e088)'
                    : 'linear-gradient(90deg, #4d7c0f, #7adb9f)',
                  transition: 'width 0.3s ease-out',
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: '#b8d496' }}>
                {Math.min(value, a.target)} / {a.target}
              </span>
              {isClaimed ? (
                <span
                  style={{ fontSize: 13, color: '#7adb9f', fontWeight: 700 }}
                >
                  ✓ Получено
                </span>
              ) : claimable ? (
                <button
                  type="button"
                  onClick={() => claim(a.id)}
                  style={{ touchAction: 'manipulation' }}
                  className="ff-btn ff-btn-green text-xs px-3 py-1.5"
                >
                  Забрать +{a.reward} ⭐
                </button>
              ) : (
                <span style={{ fontSize: 12, color: '#6b7d5c' }}>
                  {Math.round(pct * 100)}%
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ────────────────────────── MECHANICS TAB ──────────────────────────

function MechanicsTab() {
  return (
    <div className="flex flex-col gap-4">
      <div
        className="ff-display text-center"
        style={{ fontSize: 22, color: '#a8e088' }}
      >
        Как всё работает
      </div>

      <MechanicsSection title="🪙 Доход">
        <MechanicsItem
          name="Мерджи"
          desc="соединяй одинаковых лягушек → уровень выше → больше дохода. Основа игры."
        />
        <MechanicsItem
          name="Эволюция"
          desc="прокачка лягушки за слизь + эссенцию + мутаген. Даёт % бонус к доходу."
        />
        <MechanicsItem
          name="Магнит / Дрон сборщик"
          desc="авто-сбор слизи с поля."
        />
        <MechanicsItem
          name="Оффлайн-доход"
          desc="копится слизь пока тебя нет, начисляется при возврате."
        />
      </MechanicsSection>

      <MechanicsSection title="🛒 Магазины">
        <MechanicsItem
          name="Магазин прокачки"
          desc="апгрейды за слизь (пассив/тап)."
        />
        <MechanicsItem
          name="Магазин лягушек"
          desc="покупка и эволюция лягушек за слизь."
        />
        <MechanicsItem
          name="Космический магазин"
          desc="перма-апгрейды за эссенцию (слоты, скорость корабля, шанс сыворотки и др.)."
        />
      </MechanicsSection>

      <MechanicsSection title="📦 Боксы">
        <MechanicsItem
          name="Боксы"
          desc="дропают лягушек. Бывают обычные, мега, супер, редкий крейт."
        />
        <MechanicsItem
          name="Качество / скорость дропа"
          desc="влияют на то что и как часто падает."
        />
      </MechanicsSection>

      <MechanicsSection title="🗺️ Локации">
        <MechanicsItem
          name="Локации"
          desc="Болото → Лес → Континент. Открываются по прогрессу, дают новых лягушек и доступ к системам."
        />
      </MechanicsSection>

      <MechanicsSection title="🚀 Космос">
        <MechanicsItem
          name="Открытие космоса"
          desc="гейт всего космо-контента (после двойного соединения L18+L18)."
        />
        <MechanicsItem
          name="Космический корабль"
          desc="летает по звёздной карте."
        />
        <MechanicsItem name="Звёздная карта" desc="карта планет и маршрутов." />
        <MechanicsItem
          name="Экспедиции"
          desc="отправь корабль с экипажем исследовать космос. Возвращается с лутом и бортовым журналом (рапортами)."
        />
        <MechanicsItem
          name="Вознесение"
          desc="лягушка-носитель, доведённая до L18, возносится → даёт эссенцию."
        />
      </MechanicsSection>

      <MechanicsSection title="🧪 Сыворотки и архетипы">
        <MechanicsItem
          name="Сыворотки"
          desc="применяются на лягушку 1 уровня (с панели или из инвентаря) → она становится носителем стихии (carrier). 11 элементов."
        />
        <MechanicsItem
          name="Архетип"
          desc="стихия носителя. Сейчас даёт бонусы по категориям (показаны в Cosmic Hub), механический эффект в доработке."
        />
        <MechanicsItem
          name="Первый контакт / расы"
          desc="встреча инопланетных рас на планетах, отношения с ними."
        />
        <MechanicsItem
          name="Квесты"
          desc="задания от рас, дают лут и сыворотки."
        />
      </MechanicsSection>

      <MechanicsSection title="👑 Капитан">
        <MechanicsItem
          name="Капитан"
          desc="особый этап после доведения лягушки через двойное соединение L18+L18."
        />
      </MechanicsSection>

      <MechanicsSection title="💎 Ресурсы">
        <MechanicsItem name="Слизь" desc="основная валюта (золото)." />
        <MechanicsItem
          name="Эссенция"
          desc="космо-валюта (вознесение, квесты, L18+L18). Тратится на эволюцию и космо-магазин."
        />
        <MechanicsItem
          name="Мутаген 🧬"
          desc="редкий космо-лут, нужен для эволюции."
        />
        <MechanicsItem
          name="Сыворотки 🧪"
          desc="расходник, применяется на лягушку."
        />
      </MechanicsSection>
    </div>
  )
}

function MechanicsSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="ff-card p-3 flex flex-col gap-1.5">
      <div
        className="ff-body font-bold"
        style={{ fontSize: 15, color: '#a8e088', marginBottom: 4 }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function MechanicsItem({ name, desc }: { name: string; desc: string }) {
  return (
    <div
      className="ff-body"
      style={{ fontSize: 13, color: '#b8d496', lineHeight: 1.5 }}
    >
      <span style={{ fontWeight: 700 }}>{name}</span>
      {' — '}
      {desc}
    </div>
  )
}
