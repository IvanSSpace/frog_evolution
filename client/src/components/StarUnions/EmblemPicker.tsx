import { BG_COLORS, FROG_COLORS, type ClanEmblem } from '../../utils/frogEmblem'
import { FrogEmblem } from './FrogEmblem'

interface Props {
  value: ClanEmblem
  onChange(next: ClanEmblem): void
  allowStripes: boolean
}

export function EmblemPicker({ value, onChange, allowStripes }: Props) {
  function update(patch: Partial<ClanEmblem>) {
    let next = { ...value, ...patch }
    if (next.style === 'stripes' && !allowStripes) {
      next = { ...next, style: 'pond' }
    }
    onChange(next)
  }

  function prevVariant() {
    update({ variant: (value.variant + 49) % 50 })
  }

  function nextVariant() {
    update({ variant: (value.variant + 1) % 50 })
  }

  function randomVariant() {
    update({ variant: Math.floor(Math.random() * 50) })
  }

  function setStyle(s: 'pond' | 'stripes') {
    if (s === 'stripes' && !allowStripes) return
    update({ style: s })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <FrogEmblem
          variant={value.variant}
          style={value.style}
          bg={value.bg}
          frog={value.frog}
          topColor={value.topColor}
          stripeColor={value.stripeColor}
          size={200}
        />
      </div>

      <div style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
        Вид № {value.variant + 1} / 50
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={prevVariant}
          style={{ flex: 1, padding: '6px 0', borderRadius: 8, background: 'rgba(0,0,0,0.08)', border: 'none', cursor: 'pointer', color: '#374151', fontSize: 16 }}
        >
          ‹
        </button>
        <button
          onClick={randomVariant}
          style={{ flex: 2, padding: '6px 0', borderRadius: 8, background: 'rgba(0,0,0,0.08)', border: 'none', cursor: 'pointer', color: '#374151', fontSize: 13, fontWeight: 600 }}
        >
          Случайная
        </button>
        <button
          onClick={nextVariant}
          style={{ flex: 1, padding: '6px 0', borderRadius: 8, background: 'rgba(0,0,0,0.08)', border: 'none', cursor: 'pointer', color: '#374151', fontSize: 16 }}
        >
          ›
        </button>
      </div>

      <div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Стиль щита</div>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: 3 }}>
          <button
            onClick={() => setStyle('pond')}
            style={{
              flex: 1,
              padding: '7px 6px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              background: value.style === 'pond' ? '#16a34a' : 'transparent',
              color: value.style === 'pond' ? '#fff' : '#374151',
            }}
          >
            Пруд
          </button>
          <button
            onClick={() => setStyle('stripes')}
            disabled={!allowStripes}
            title={!allowStripes ? 'Доступно только администратору' : undefined}
            style={{
              flex: 1,
              padding: '7px 6px',
              borderRadius: 8,
              border: 'none',
              cursor: allowStripes ? 'pointer' : 'not-allowed',
              fontSize: 13,
              fontWeight: 600,
              background: value.style === 'stripes' ? '#16a34a' : 'transparent',
              color: value.style === 'stripes' ? '#fff' : allowStripes ? '#374151' : '#9ca3af',
              opacity: allowStripes ? 1 : 0.6,
            }}
          >
            Купол + полосы
          </button>
        </div>
      </div>

      {value.style === 'pond' && (
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Цвет эмблемы</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {BG_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => update({ bg: c })}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: c,
                  border: value.bg === c ? '2px solid #1f2937' : '2px solid transparent',
                  cursor: 'pointer',
                  transform: value.bg === c ? 'scale(1.12)' : 'scale(1)',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input
              type="color"
              value={value.bg}
              onChange={(e) => update({ bg: e.target.value })}
              style={{ width: 40, height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0, background: 'none' }}
            />
            <span style={{ fontSize: 12, color: '#6b7280' }}>свой цвет фона</span>
          </div>
        </div>
      )}

      {value.style === 'stripes' && (
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Цвета полос</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input
              type="color"
              value={value.topColor ?? '#e8b923'}
              onChange={(e) => update({ topColor: e.target.value })}
              style={{ width: 40, height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0, background: 'none' }}
            />
            <span style={{ fontSize: 12, color: '#6b7280' }}>верх (купол)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={value.stripeColor ?? '#1f5fc4'}
              onChange={(e) => update({ stripeColor: e.target.value })}
              style={{ width: 40, height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0, background: 'none' }}
            />
            <span style={{ fontSize: 12, color: '#6b7280' }}>цвет полос</span>
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Цвет лягушки</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {FROG_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => update({ frog: c })}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: c,
                border: value.frog === c ? '2px solid #1f2937' : '2px solid transparent',
                cursor: 'pointer',
                transform: value.frog === c ? 'scale(1.12)' : 'scale(1)',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <input
            type="color"
            value={value.frog}
            onChange={(e) => update({ frog: e.target.value })}
            style={{ width: 40, height: 34, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0, background: 'none' }}
          />
          <span style={{ fontSize: 12, color: '#6b7280' }}>свой цвет лягушки</span>
        </div>
      </div>
    </div>
  )
}
