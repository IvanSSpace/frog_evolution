import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
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
import {
  getInstantBoxes,
  setInstantBoxes,
  subscribeInstantBoxes,
  getCalmFarmMode,
  setCalmFarmMode,
  subscribeCalmFarmMode,
  getReducedEffects,
  setReducedEffects,
  subscribeReducedEffects,
} from '../../utils/cosmicSettings'
import { useModalLock } from '../../utils/modalLock'

type Tab = 'bestiary' | 'settings' | 'player'
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
          className={closing ? 'ff-slide-up' : 'ff-slide-down'}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, #f5fbe9 0%, #d9eeb6 100%)',
            border: '4px solid #4d6b1f',
            borderRadius: 0,
            boxShadow: '0 0 0 3px #f7ffe0 inset',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-1.5 px-3 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
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
            {tab === 'player' && <PlayerPanel />}
            {tab === 'settings' && <SettingsTab />}
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
        className="ff-card p-5 flex items-center justify-center"
        style={{ minHeight: BESTIARY_CARD_MIN_HEIGHT }}
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
      className="ff-card p-5 flex flex-col items-center gap-2 relative"
      style={{ minHeight: BESTIARY_CARD_MIN_HEIGHT }}
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

      {/* Image container */}
      <div
        className="relative flex items-center justify-center rounded-2xl"
        style={{
          width: 130,
          height: 130,
          flexShrink: 0,
          background: 'linear-gradient(180deg, #ecfccb 0%, #bef264 100%)',
          border: '3px solid #4d7c0f',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
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
          color: '#15803d',
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
          color: '#166534',
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
            style={{ color: '#7e22ce', fontSize: 15 }}
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
          color: '#365314',
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
  const crew = useGameStore((s) => s.crew)
  const resetCrew = () =>
    useGameStore.setState((s) => ({ crew: { ...s.crew, missionsToday: 0 } }))

  // Phase 22: dev-кнопки делают local mutation + немедленный PUT на сервер
  // (минуя throttle), чтобы изменения сразу видны после reload.
  const devSync = (action: () => void) => async () => {
    action()
    await saveGameState(true)
  }
  const currentLang = i18n.language as Lang
  const sfxMuted = useSyncExternalStore(sfxSubscribe, getSfxMuted, getSfxMuted)
  // Phase 15 (UX-06): instant-boxes toggle reactive через cosmicSettings.
  const instantBoxes = useSyncExternalStore(
    subscribeInstantBoxes,
    getInstantBoxes,
    getInstantBoxes,
  )
  // Phase 19-04 (UX-04): calm farm mode toggle (disables aura/idle particles).
  const calmFarmMode = useSyncExternalStore(
    subscribeCalmFarmMode,
    getCalmFarmMode,
    getCalmFarmMode,
  )
  // Phase 19-04 (UX-05): reduced effects toggle — default OFF Locked Decision.
  const reducedEffects = useSyncExternalStore(
    subscribeReducedEffects,
    getReducedEffects,
    getReducedEffects,
  )

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
            color: '#365314',
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

      {/* Phase 15 (UX-06): Cosmic section header */}
      <div
        className="ff-body text-xs font-bold text-center py-1 rounded mt-2"
        style={{
          background: '#1e3a8a',
          color: '#dbeafe',
          letterSpacing: '0.05em',
        }}
      >
        {t('settings.cosmic')}
      </div>

      {/* Instant boxes toggle */}
      <SettingsRow label={t('settings.instant_boxes')}>
        <button
          onClick={() => setInstantBoxes(!instantBoxes)}
          className={`ff-btn text-xs px-3 py-1.5 ${instantBoxes ? 'ff-btn-green' : 'ff-btn-grey'}`}
          title={t('settings.instant_boxes_desc')}
        >
          {instantBoxes ? t('player.on') : t('player.off')}
        </button>
      </SettingsRow>

      {/* Phase 19-04 (UX-04): Calm farm mode toggle */}
      <SettingsRow label={t('settings.calm_farm')}>
        <button
          onClick={() => setCalmFarmMode(!calmFarmMode)}
          className={`ff-btn text-xs px-3 py-1.5 ${calmFarmMode ? 'ff-btn-green' : 'ff-btn-grey'}`}
          title={t('settings.calm_farm_desc')}
        >
          {calmFarmMode ? t('player.on') : t('player.off')}
        </button>
      </SettingsRow>

      {/* Phase 19-04 (UX-05): Reduced effects toggle (default OFF Locked Decision) */}
      <SettingsRow label={t('settings.reduced_effects')}>
        <button
          onClick={() => setReducedEffects(!reducedEffects)}
          className={`ff-btn text-xs px-3 py-1.5 ${reducedEffects ? 'ff-btn-green' : 'ff-btn-grey'}`}
          title={t('settings.reduced_effects_desc')}
        >
          {reducedEffects ? t('player.on') : t('player.off')}
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
            onClick={devSync(resetCrew)}
            className="ff-btn ff-btn-green text-sm w-full"
          >
            Сбросить усталость экипажа ({crew.missionsToday}/4)
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
