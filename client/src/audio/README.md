# Audio Player

Генеративный музыкальный плеер на Tone.js. Музыка создаётся в реальном времени, mp3/wav файлов нет.

## Структура

```
audio/
  audioPlayer.ts         — синглтон-менеджер: загрузка, lifecycle, crossfade
  useAudioPlayer.ts      — React hook для подписки на состояние плеера
  storage.ts             — localStorage: громкость, трек, viz, autoResume
  types.ts               — TrackInstance, PlayerSnapshot, RuntimeContext
  tracks/
    index.ts             — TRACK_META: метаданные всех треков
    _helpers.ts          — transpose, NodeBag, TimerBag
    beyondHorizon.ts     — 7 минут, 7 секций (cinematic epic)
    stellarTide.ts       — 4 минуты, 4 секции (gentle pulses)
    phylogenesis.ts      — 4 минуты, 4 секции (minimalism)
    leviathanLullaby.ts  — 4 минуты, 4 движения (slow scenes)
    frogTomorrow.ts      — 1 минута (dark scenes)
    cosmicBattle.ts      — 1 минута, 4 акта (action)
  components/
    PlayerPanel.tsx      — UI плеера (вкладка в Settings)
    Visualizer.tsx       — опциональный canvas-визуализатор
```

## Использование

Плеер живёт как синглтон. UI открывается через `Settings → Музыка`.

Программно из любой страницы:

```ts
import { audioPlayer } from '@/audio/audioPlayer'

await audioPlayer.playTrack('beyondHorizon')
await audioPlayer.pause()
await audioPlayer.resume()
audioPlayer.seekTo(60)
audioPlayer.setVolume(-12)
audioPlayer.getCurrentTime()
await audioPlayer.stopTrack()
```

Подписка на события:

```ts
const off = audioPlayer.on('section', () => {
  const { sectionIdx } = audioPlayer.snapshot()
  // ...
})
off() // unsubscribe
```

В React:

```tsx
import { useAudioPlayer } from '@/audio/useAudioPlayer'

function MyComponent() {
  const snap = useAudioPlayer()
  return (
    <span>
      {snap.elapsed}s · status={snap.status}
    </span>
  )
}
```

## API

### `audioPlayer`

| Метод            | Сигнатура                                           | Описание                                               |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `loadTrack`      | `(id: TrackId) => Promise<void>`                    | Build без play                                         |
| `playTrack`      | `(id?: TrackId, fromSec?: number) => Promise<void>` | Play текущего или нового трека (с crossfade при смене) |
| `pause`          | `() => Promise<void>`                               | Ramp down 0.5s, остановить scheduler                   |
| `resume`         | `() => Promise<void>`                               | Ramp up 0.5s, перезапустить scheduler                  |
| `stopTrack`      | `() => Promise<void>`                               | Полная остановка + dispose                             |
| `seekTo`         | `(sec: number) => void`                             | Перемотка                                              |
| `getCurrentTime` | `() => number`                                      | Текущая позиция в секундах                             |
| `setVolume`      | `(db: number) => void`                              | Громкость в dB (−60..0)                                |
| `setVizEnabled`  | `(v: boolean) => void`                              | Вкл/выкл визуализатор                                  |
| `setAutoResume`  | `(v: boolean) => void`                              | Resume после `visibilitychange`                        |
| `getAnalyser`    | `() => Analyser \| null`                            | Tone.Analyser для viz                                  |
| `snapshot`       | `() => PlayerSnapshot`                              | Снимок состояния                                       |
| `on`             | `(event, cb) => unsubscribe`                        | События: `'state' \| 'tick' \| 'section'`              |

### `PlayerSnapshot`

```ts
{
  status: 'idle' | 'loading' | 'playing' | 'paused'
  trackId: TrackId | null
  elapsed: number
  totalSec: number
  sectionIdx: number
  volume: number
  vizEnabled: boolean
  autoResume: boolean
}
```

## Lifecycle

1. Tone.js подгружается лениво при первом `playTrack()` через `await import('tone')`.
2. `Tone.start()` вызывается только внутри user gesture (требование браузеров).
3. Lifecycle одного трека: `build → startScheduler → stopScheduler → dispose`.
4. `dispose()`: ramp гейна до −60dB за 0.5s → ждём 4s → `node.dispose()`. Это убирает щелчки.
5. Crossfade при смене треков: 2s ramp нового вверх + старого вниз параллельно.
6. `visibilitychange` → пауза. При возврате — resume только если `autoResume` включено.

## Громкость

Master volume — узел `Tone.Volume` между всеми треками и `Tone.Destination`. Каждый трек роутится через свой `trackOut: Tone.Volume` для управления fade-in/out независимо от мастера.

## Persistence (localStorage)

Только настройки, никаких аудио-данных:

- `audio.volume` — dB (число)
- `audio.selectedTrack` — TrackId
- `audio.vizEnabled` — `'1'` | `'0'`
- `audio.autoResume` — `'1'` | `'0'`

## Производительность

- Tone.js — отдельный chunk (~81KB gzipped), грузится лениво.
- Каждый трек — отдельный chunk (~1.5-2.5KB gzipped), грузится через `import()`.
- UI tick событий: throttle 30fps (33ms между `tick` event'ами).
- Visualizer отключён по умолчанию для мобильных (Telegram Mini App).
- WebAudio работает в отдельном потоке — основная работа уходит из main thread.

## Как добавить новый трек

1. Создай `tracks/myTrack.ts` экспортирующий `default: CreateTrack`:

   ```ts
   import type * as ToneNS from 'tone'
   import type { CreateTrack, TrackInstance } from '../types'
   import { TRACK_META } from './index'
   import { NodeBag, TimerBag } from './_helpers'

   const create: CreateTrack = (Tone): TrackInstance => {
     const nodes = new NodeBag()
     const timers = new TimerBag()
     let analyser: ToneNS.Analyser | null = null
     // ... voices

     return {
       meta: TRACK_META.myTrack,
       async build(Tone, outNode) {
         // создать синты, всё .connect(outNode)
         // analyser = new Tone.Analyser('waveform', 1024)
       },
       startScheduler(fromSec, ctx) {
         // расписание событий, читать ctx.getElapsed() / ctx.isPlaying()
         // вызывать ctx.onSectionChange(idx) на смене секций
       },
       stopScheduler() {
         timers.clearAll()
       },
       async dispose() {
         timers.clearAll()
         nodes.stopAll()
         await new Promise((r) => setTimeout(r, 100))
         nodes.disposeAll()
       },
       getAnalyser: () => analyser,
     }
   }

   export default create
   ```

2. Добавь `id` в `TrackId` (`types.ts`).
3. Добавь метаданные в `TRACK_META` (`tracks/index.ts`) и таймер в `TRACK_TOTALS` (`audioPlayer.ts`).
4. Зарегистрируй динамический импорт в `TRACK_LOADERS` (`audioPlayer.ts`).
5. Добавь i18n ключи в `player.tracks.myTrack.{name,desc}` в `ru.json`/`en.json`/`es.json`.

## Текущие треки

| ID                 | Длительность | Секций | Описание                                                      |
| ------------------ | ------------ | ------ | ------------------------------------------------------------- |
| `beyondHorizon`    | 7:00         | 7      | C major → F → D minor → Bb → A minor → F → C. Cinematic epic. |
| `stellarTide`      | 4:00         | 4      | F# minor → C# minor → A major → F# minor. Gentle pulses.      |
| `phylogenesis`     | 4:00         | 4      | A minor → D minor → C major → A minor. Reich-style canon.     |
| `leviathanLullaby` | 4:00         | 4      | Descent → Awakening → The Song → Drifting. Whale calls.       |
| `frogTomorrow`     | 1:00         | 6      | Drone → Pulse → Cries → Memory → Choir → Void. Dark ambience. |
| `cosmicBattle`     | 1:00         | 4      | Approach → Clash → Chaos → Silence. 4 акта по 15 секунд.      |

## Заметки по платформам

- **iOS Safari (Telegram Mini App)**: WebAudio работает после `Tone.start()` внутри click handler. Это уже соблюдено — `playTrack()` вызывается только из onClick.
- **Visualizer**: на слабых телефонах canvas + analyser создаёт нагрузку. Поэтому `vizEnabled` по умолчанию `false`.
- **Pause при потере фокуса**: всегда. Resume — опционально через `autoResume`.
