import { useState } from 'react'
import { useGameStore, ENTITY_CAP } from '../../store/gameStore'
import { FROG_LEVELS, getFrogPrice, getTargetIncomePerSec } from '../../game/config/frogs'

type Props = { onClose: () => void }

const fmt = (n: number) => n.toLocaleString('ru-RU')

export function FrogShopModal({ onClose }: Props) {
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  return (
    <div
      onClick={onClose}
      className="ff-backdrop ff-fade"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'auto', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ff-panel ff-pop relative"
        style={{ width: '100%', maxWidth: 380, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3"
             style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}>
          <h2 className="ff-display ff-stroke-white text-3xl"
              style={{ color: '#15803d', letterSpacing: 1.5 }}>
            ЛЯГУШКИ
          </h2>
          <button
            onClick={onClose}
            aria-label="закрыть"
            className="ff-tile w-9 h-9 text-lg"
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

        <div className="flex flex-col gap-3 p-4 overflow-y-auto">
          {FROG_LEVELS.map((_cfg, idx) => (
            <FrogCard key={idx} level={idx + 1} onResult={showToast} />
          ))}
        </div>

        {toast && (
          <div
            className="ff-display absolute left-1/2 -translate-x-1/2 px-4 py-2 text-white text-sm whitespace-nowrap pointer-events-none"
            style={{
              bottom: 12,
              background: 'linear-gradient(180deg, #f87171 0%, #b91c1c 100%)',
              border: '3px solid #7f1d1d',
              borderBottomWidth: 5,
              borderRadius: 14,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 0 rgba(0,0,0,0.3)',
              textShadow: '0 2px 0 rgba(0,0,0,0.45)',
              animation: 'ffPop 220ms cubic-bezier(0.34,1.56,0.64,1) both',
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

function FrogCard({ level, onResult }: { level: number; onResult: (msg: string) => void }) {
  const purchases = useGameStore((s) => s.frogPurchases[level - 1] ?? 0)
  const gold = useGameStore((s) => s.gold)
  const entityCount = useGameStore((s) => s.entityCount)
  const buyFrog = useGameStore((s) => s.buyFrog)

  const cfg = FROG_LEVELS[level - 1]
  const cost = getFrogPrice(level, purchases)
  const canAfford = gold >= cost
  const capFull = entityCount >= ENTITY_CAP

  const handleBuy = () => {
    const r = buyFrog(level)
    if (!r.ok) {
      if (r.reason === 'capFull') onResult(`Поле занято (${ENTITY_CAP}/${ENTITY_CAP})`)
      else if (r.reason === 'noGold') onResult('Не хватает 💩')
    }
  }

  return (
    <div className="ff-card p-3 flex items-center gap-3">
      {/* Слева — инфо + кнопка */}
      <div className="flex-1 min-w-0">
        <div className="ff-display text-base text-emerald-900 leading-tight">{cfg.name}</div>
        <div className="ff-body text-[11px] text-emerald-800 font-bold mt-1 leading-tight">
          Куплено: <span className="tabular-nums">{purchases}</span>
        </div>
        <div className="ff-body text-[11px] text-emerald-800 font-bold leading-tight">
          Доход: <span className="tabular-nums">{getTargetIncomePerSec(level)}</span> 💩 / сек
        </div>
        <button
          onClick={handleBuy}
          disabled={!canAfford || capFull}
          className={`ff-btn text-sm mt-2 ${
            capFull ? 'ff-btn-grey' : canAfford ? 'ff-btn-yellow' : 'ff-btn-red'
          }`}
        >
          {fmt(cost)} 💩
        </button>
      </div>

      {/* Справа — миниатюра в светло-зелёном квадрате */}
      <div
        className="w-20 h-20 flex-shrink-0 flex items-center justify-center p-2 rounded-2xl"
        style={{
          background: 'linear-gradient(180deg, #ecfccb 0%, #bef264 100%)',
          border: '3px solid #4d7c0f',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6)',
        }}
      >
        <img
          src={cfg.path}
          alt={cfg.name}
          className="max-w-full max-h-full object-contain"
          style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.2))' }}
        />
      </div>
    </div>
  )
}
