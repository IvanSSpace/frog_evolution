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
  /** Подзаголовок снизу — обычно "Подключение к серверу" или "Offline режим". */
  subtitle?: string
}

export function LoadingScreen({
  subtitle = 'Подключение к серверу',
}: LoadingScreenProps) {
  // Стартовая фраза рандомная, потом ротируем по индексу — детерминированный
  // порядок чтобы не было повторов подряд.
  const [phraseIdx, setPhraseIdx] = useState(() =>
    Math.floor(Math.random() * LOADING_PHRASES.length),
  )

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhraseIdx((i) => (i + 1 + Math.floor(Math.random() * 3)) % LOADING_PHRASES.length)
    }, 1700)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background:
          'radial-gradient(ellipse at center, #1a2e1a 0%, #0a1a0a 60%, #000000 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '32px',
        color: '#e5f5e5',
        fontFamily: "'Nunito', system-ui, sans-serif",
        padding: '32px',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Прыгающая лягушка */}
      <div
        style={{
          fontSize: '88px',
          lineHeight: 1,
          animation: 'frog-bounce 1.2s ease-in-out infinite',
          transformOrigin: '50% 100%',
          filter: 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.4))',
        }}
      >
        🐸
      </div>

      {/* Динамическая фраза */}
      <div
        key={phraseIdx}
        style={{
          fontSize: '15px',
          opacity: 0.85,
          maxWidth: '320px',
          minHeight: '60px',
          lineHeight: 1.5,
          fontStyle: 'italic',
          animation: 'phrase-in 0.4s ease-out',
        }}
      >
        {LOADING_PHRASES[phraseIdx]}
      </div>

      {/* Анимированные точки прогресса */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: '8px',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '999px',
              background: '#7ed957',
              animation: 'dot-pulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Подзаголовок */}
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

      <style>{`
        @keyframes frog-bounce {
          0%, 100% { transform: translateY(0) scaleY(1) scaleX(1); }
          45% { transform: translateY(-22px) scaleY(1.1) scaleX(0.95); }
          70% { transform: translateY(0) scaleY(0.85) scaleX(1.15); }
          85% { transform: translateY(-4px) scaleY(1.02) scaleX(0.99); }
        }
        @keyframes phrase-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 0.85; transform: translateY(0); }
        }
        @keyframes dot-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  )
}
