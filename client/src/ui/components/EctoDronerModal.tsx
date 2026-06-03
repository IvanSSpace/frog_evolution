import {
  useGameStore,
  LOC2_UPGRADE_META,
  loc2UpgradeCost,
  type EctoUpgradeKey,
} from '../../store/gameStore'
import { useModalLock } from '../../utils/modalLock'
import { fmt } from '../../utils/formatting'

type Props = { onClose: () => void }

// i18n: TODO — модалка целиком на хардкод-RU (включая прежний код). Нужен общий
// i18n-проход RU/EN/ES по EctoDronerModal, не только по этим строкам.

// Строка покупки апгрейда за эктоплазму. Уровень-пипсы + цена + кнопка.
function EctoBuyRow({
  upgradeKey,
  icon,
  title,
  desc,
}: {
  upgradeKey: EctoUpgradeKey
  icon: string
  title: string
  desc: string
}) {
  const level = useGameStore((s) => s.loc2Upgrades[upgradeKey])
  const ectoplasm = useGameStore((s) => s.ectoplasm)
  const buyEctoUpgrade = useGameStore((s) => s.buyEctoUpgrade)
  const meta = LOC2_UPGRADE_META[upgradeKey]
  const isMax = level >= meta.maxLevel
  const cost = loc2UpgradeCost(upgradeKey, level)
  const affordable = !isMax && ectoplasm >= cost

  return (
    <div className="ff-card flex items-center gap-3 p-3">
      <span style={{ fontSize: 26 }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div
          className="ff-display text-sm"
          style={{ color: 'var(--ff-text-light)' }}
        >
          {title}
        </div>
        <div
          className="ff-display"
          style={{ fontSize: 11, color: 'var(--ff-text-dim)' }}
        >
          {desc}
        </div>
        {/* Пипсы уровня */}
        <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
          {Array.from({ length: meta.maxLevel }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 14,
                height: 5,
                borderRadius: 3,
                background: i < level ? '#9d4edd' : 'rgba(157,78,221,0.22)',
              }}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => buyEctoUpgrade(upgradeKey)}
        disabled={!affordable}
        aria-label={isMax ? 'Максимум' : `Купить за ${cost} эктоплазмы`}
        className="ff-tile flex-shrink-0"
        style={{
          touchAction: 'manipulation',
          minWidth: 64,
          height: 40,
          padding: '0 8px',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          opacity: affordable ? 1 : 0.5,
          ['--ff-tile-from' as never]: '#c77dff',
          ['--ff-tile-to' as never]: '#7b2cbf',
          ['--ff-tile-border' as never]: '#5a189a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {isMax ? 'MAX' : `💜 ${fmt(cost)}`}
      </button>
    </div>
  )
}

export function EctoDronerModal({ onClose }: Props) {
  useModalLock()
  const ectoplasm = useGameStore((s) => s.ectoplasm)

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
        className="ff-panel ff-pop"
        style={{
          width: '100%',
          maxWidth: 380,
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '1px solid rgba(77,107,31,0.4)' }}
        >
          <h2
            className="ff-display ff-stroke-white text-3xl"
            style={{ color: '#7b2cbf', letterSpacing: 1.5 }}
          >
            Дроны-сборщики
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="ff-tile w-9 h-9 text-lg"
            style={{
              touchAction: 'manipulation',
              ['--ff-tile-from' as never]: '#fca5a5',
              ['--ff-tile-to' as never]: '#dc2626',
              ['--ff-tile-border' as never]: '#7f1d1d',
              color: '#fff',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto ff-no-scrollbar px-4 py-3 flex flex-col gap-3"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          {/* Дрон + баланс */}
          <div className="ff-card flex items-center gap-3 p-3">
            <img
              src="/drone_loc2.webp"
              alt=""
              style={{ height: 56, width: 'auto', objectFit: 'contain' }}
            />
            <div className="flex-1">
              <div
                className="ff-display text-sm"
                style={{ color: 'var(--ff-text-light)' }}
              >
                Дрон-сборщик
              </div>
              <div
                className="ff-display"
                style={{ fontSize: 11, color: 'var(--ff-text-dim)' }}
              >
                Летает по полю и собирает эктоплазму
              </div>
            </div>
            <div
              className="ff-display"
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#c77dff',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Эктоплазма"
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle at 35% 30%, #e0aaff, #9d4edd 70%)',
                  boxShadow: '0 0 4px #9d4edd',
                  display: 'inline-block',
                }}
              />
              {ectoplasm}
            </div>
          </div>

          {/* Будущая прокачка */}
          <div
            className="ff-display"
            style={{ fontSize: 12, color: 'var(--ff-text-dim)', marginTop: 4 }}
          >
            Прокачка
          </div>
          <EctoBuyRow
            upgradeKey="ectoDroneSpeed"
            icon="⚡"
            title="Скорость сбора"
            desc="Дрон летает быстрее"
          />
          <EctoBuyRow
            upgradeKey="ectoDroneCount"
            icon="🛸"
            title="Больше дронов"
            desc="+1 дрон-сборщик"
          />
          <EctoBuyRow
            upgradeKey="ectoDroneValue"
            icon="💜"
            title="Ценность слизи"
            desc="Больше эктоплазмы за сбор"
          />
          <EctoBuyRow
            upgradeKey="capsuleSpeed"
            icon="🧪"
            title="Скорость капсул"
            desc="Капсулы мерджат быстрее"
          />
          <EctoBuyRow
            upgradeKey="capsuleCooldown"
            icon="⏱️"
            title="Кулдаун капсул"
            desc="Меньше пауза между циклами"
          />
        </div>
      </div>
    </div>
  )
}
