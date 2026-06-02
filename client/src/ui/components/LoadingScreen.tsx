import { useEffect, useState } from 'react'

// Hearthstone-style фразы — рандомизированы, меняются каждые ~1.7 сек.
// Стиль: самокритичные, лягушачьи, с лёгким four-wall breaking.
const LOADING_PHRASES = [
  'разминаем кости лягушкам (стоп, их же у них нет)...',
  'квакаем по слогам: ква-куль...',
  'ищем самую толстую лягушку в коллекции...',
  'натираем сыворотками — пахнет космосом...',
  'запускаем корабль (пилот опять заснул)...',
  'складываем планеты в стопочку...',
  'тренируем мух для прокачанных лягушек...',
  'пробуждаем спящих в архетипах (тихо!)...',
  'учим лягушек квакать на двенадцати языках...',
  'заряжаем сыворотку молнией...',
  'договариваемся с чёрной дырой о скидке...',
  'ловим лягушек в коробку (одна сбежала)...',
  'кладём сыворотку в холодильник до приезда...',
  'квантуем лягушек на эпические тиры...',
  'успокаиваем взбесившуюся бестию...',
  'выводим планеты на орбиту вокруг лужи...',
  'регулируем гравитацию (опять упала)...',
  'перевариваем сегодняшних мух...',
  'плетём лягушачьи сети для скаутов...',
  'ищем философский камень для уровня L18...',
  'считаем редкие пятна на спинках...',
  'согреваем чай для администраторов сервера...',
  'отлавливаем баги (они квакают)...',
  'рисуем созвездия лягушачьей лапкой...',
  'настраиваем космическое радио на квак-волну...',
]

interface LoadingScreenProps {
  /** Подзаголовок снизу. По умолчанию пуст — не показывается. */
  subtitle?: string
  /** Загрузка завершена → бар добегает до 100%. */
  done?: boolean
}

// Прогресс полосы — module-level, чтобы он БЫЛ НЕПРЕРЫВНЫМ между двумя инстансами
// LoadingScreen в App (boot-loading → overlay до gameReady), а не сбрасывался в 0.
let barProgress = 0

export function LoadingScreen({
  subtitle,
  done = false,
}: LoadingScreenProps = {}) {
  // Стартовая фраза рандомная, потом ротируем по индексу — детерминированный
  // порядок чтобы не было повторов подряд.
  const [phraseIdx, setPhraseIdx] = useState(() =>
    Math.floor(Math.random() * LOADING_PHRASES.length),
  )
  const [barWidth, setBarWidth] = useState(barProgress)

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhraseIdx(
        (i) => (i + 1 + Math.floor(Math.random() * 3)) % LOADING_PHRASES.length,
      )
    }, 3000)
    return () => window.clearInterval(id)
  }, [])

  // Двухфазная полоса (JS, непрерывная):
  //   loading → быстро до 60% (~0.8с), затем медленный creep до 92% (ждём загрузку);
  //   done    → рывок до 100%.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (done) {
        barProgress = Math.min(100, barProgress + 240 * dt)
      } else if (barProgress < 60) {
        barProgress = Math.min(60, barProgress + 75 * dt)
      } else if (barProgress < 92) {
        barProgress = Math.min(92, barProgress + 4 * dt)
      }
      setBarWidth(barProgress)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [done])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // Фон — арт загрузочного экрана (public/setupScreen.webp), cover.
        // Лёгкий тёмный scrim поверх — чтобы фразы/лягушка/точки читались.
        background:
          "linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.42)), url('/setupScreen.webp') center / cover no-repeat",
        backgroundColor: '#0a1a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '28px',
        color: '#e5f5e5',
        fontFamily: "'Nunito', system-ui, sans-serif",
        padding: '32px',
        paddingBottom: '14vh',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Динамическая фраза */}
      <div
        key={phraseIdx}
        style={{
          fontSize: '22px',
          fontWeight: 700,
          opacity: 0.95,
          maxWidth: '420px',
          minHeight: '70px',
          lineHeight: 1.45,
          fontStyle: 'italic',
          textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          animation: 'phrase-in 0.4s ease-out',
        }}
      >
        {LOADING_PHRASES[phraseIdx]}
      </div>

      {/* Неоновая полоса загрузки (indeterminate) */}
      <div
        style={{
          width: 'min(72%, 420px)',
          height: '18px',
          borderRadius: '999px',
          background: 'rgba(15, 20, 35, 0.6)',
          border: '2px solid rgba(170, 195, 255, 0.55)',
          boxShadow:
            '0 0 10px rgba(120, 150, 255, 0.35), inset 0 1px 2px rgba(0, 0, 0, 0.5)',
          padding: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${barWidth}%`,
            height: '100%',
            borderRadius: '999px',
            background:
              'linear-gradient(90deg, #5fe3d0 0%, #6fd0e0 40%, #a78bfa 100%)',
            boxShadow:
              '0 0 12px rgba(110, 220, 210, 0.7), 0 0 12px rgba(167, 139, 250, 0.6)',
            transition: 'width 0.12s linear',
          }}
        />
      </div>

      {/* Подзаголовок — показываем только если явно передан */}
      {subtitle && (
        <div
          style={{
            fontSize: '11px',
            opacity: 0.5,
            letterSpacing: '0.05em',
            marginTop: '16px',
          }}
        >
          {subtitle}
        </div>
      )}

      <style>{`
        @keyframes phrase-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 0.95; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
