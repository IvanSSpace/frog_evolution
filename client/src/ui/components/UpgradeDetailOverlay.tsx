// UpgradeDetailOverlay — крупный детальный экран прокачки (шаг 2 «повторного
// клика»). Показывает что качаешь в большом формате + единственная кнопка
// «Купить». Монтируется один раз в App; открывается через upgradeDetail-store.

import { createPortal } from 'react-dom'
import { useModalLock } from '../../utils/modalLock'
import { fmt } from '../../utils/formatting'
import { useDetail, closeDetail } from './upgradeDetail'

export function UpgradeDetailOverlay() {
  const d = useDetail()
  // useModalLock без аргумента всегда лочит — вызываем только когда есть деталь
  // через вложенный компонент, чтобы хук не висел постоянно.
  if (!d) return null
  return <DetailInner key={d.title} />
}

function DetailInner() {
  useModalLock()
  const d = useDetail()
  if (!d) return null

  const buy = () => {
    d.onBuy()
    closeDetail()
  }

  return createPortal(
    <div
      onClick={closeDetail}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'rgba(8, 20, 6, 0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        pointerEvents: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(94vw, 380px)',
          borderRadius: 24,
          border: '3px solid #6fae3e',
          background:
            'linear-gradient(160deg, #f3fbe6 0%, #e2f2cd 60%, #d4edba 100%)',
          boxShadow: '0 14px 40px rgba(20,40,10,0.5)',
          padding: '20px 18px 18px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* ✕ */}
        <button
          type="button"
          onClick={closeDetail}
          aria-label="Закрыть"
          style={{
            touchAction: 'manipulation',
            position: 'absolute',
            top: 10,
            right: 12,
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(80,120,40,0.18)',
            color: '#3a5a26',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ✕
        </button>

        {/* Большая иконка */}
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 64,
            background:
              'radial-gradient(circle at 40% 32%, #ffffff, #cfe9a8 75%)',
            border: '3px solid #6fae3e',
            boxShadow: 'inset 0 -4px 10px rgba(80,120,40,0.25)',
            marginBottom: 12,
          }}
        >
          <span style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.2))' }}>
            {d.icon}
          </span>
        </div>

        {/* Заголовок + уровень */}
        <div
          className="ff-display ff-stroke-white"
          style={{
            fontSize: 24,
            color: '#2f6b1f',
            lineHeight: 1.1,
            letterSpacing: 0.5,
          }}
        >
          {d.title}
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#5a7d3e',
            marginTop: 4,
          }}
        >
          Уровень {d.level} / {d.maxLevel}
        </div>

        {/* Пипсы уровня */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          {Array.from({ length: d.maxLevel }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 16,
                height: 6,
                borderRadius: 3,
                background: i < d.level ? '#4d8a26' : 'rgba(77,138,38,0.22)',
              }}
            />
          ))}
        </div>

        {/* Описание / эффект */}
        {d.desc && (
          <div
            style={{
              fontSize: 13,
              color: '#3a5a26',
              marginTop: 12,
              lineHeight: 1.4,
            }}
          >
            {d.desc}
          </div>
        )}
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#2f6b1f',
            marginTop: d.desc ? 6 : 12,
            lineHeight: 1.35,
          }}
        >
          {d.effect}
        </div>

        {/* Кнопка покупки — из дизайн-системы (ff-btn). */}
        <button
          type="button"
          onClick={buy}
          disabled={d.isMax || !d.canAfford}
          className={`ff-btn ${
            d.isMax ? 'ff-btn-grey' : d.canAfford ? 'ff-btn-green' : 'ff-btn-red'
          }`}
          style={{
            touchAction: 'manipulation',
            marginTop: 18,
            width: '100%',
            fontSize: 18,
            padding: '14px 16px',
            borderRadius: 18,
          }}
        >
          {d.isMax ? (
            'Максимум'
          ) : (
            <>
              Купить · {fmt(d.cost)} <CurrencyIcon currency={d.currency} />
            </>
          )}
        </button>
      </div>
    </div>,
    document.body,
  )
}

function CurrencyIcon({ currency }: { currency: 'gold' | 'ecto' }) {
  if (currency === 'ecto') {
    return (
      <span
        style={{
          width: '1em',
          height: '1em',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 35% 30%, #e0aaff, #9d4edd 70%)',
          boxShadow: '0 0 4px #9d4edd',
          display: 'inline-block',
        }}
      />
    )
  }
  return (
    <img
      src="/goo.svg"
      alt=""
      style={{ width: '1.1em', height: '1.1em', verticalAlign: 'middle' }}
    />
  )
}
