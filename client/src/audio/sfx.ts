import type * as ToneNS from 'tone'
import type { ToneLib } from './types'
import { devWarn } from '../utils/devLog'

const KEY_MUTED = 'audio.sfxMuted'
const KEY_VOLUME = 'audio.sfxVolume'

export type SfxName =
  | 'pickup'
  | 'drop'
  | 'merge'
  | 'evolve'
  | 'boxOpen'
  | 'boxPop'

function loadMuted(): boolean {
  return localStorage.getItem(KEY_MUTED) === '1'
}

function saveMuted(v: boolean): void {
  localStorage.setItem(KEY_MUTED, v ? '1' : '0')
}

function loadVolume(): number {
  const raw = localStorage.getItem(KEY_VOLUME)
  if (!raw) return -8
  const n = Number(raw)
  if (!Number.isFinite(n)) return -8
  return Math.max(-40, Math.min(0, n))
}

function saveVolume(db: number): void {
  localStorage.setItem(KEY_VOLUME, String(db))
}

interface SfxKit {
  pluck: ToneNS.Synth
  membrane: ToneNS.MembraneSynth
  bell: ToneNS.PolySynth
  shimmer: ToneNS.PolySynth
  tapPlayer: ToneNS.Player
  mergePlayer: ToneNS.Player
  bus: ToneNS.Volume
}

class SfxEngine {
  private Tone: ToneLib | null = null
  private kit: SfxKit | null = null
  private loadingPromise: Promise<void> | null = null
  private muted = loadMuted()
  private volume = loadVolume()
  private listeners = new Set<() => void>()

  isMuted(): boolean {
    return this.muted
  }
  getVolume(): number {
    return this.volume
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notify(): void {
    this.listeners.forEach((l) => l())
  }

  setMuted(v: boolean): void {
    this.muted = v
    saveMuted(v)
    this.notify()
    // Phase 22: sync preferences with server.
    void import('../api/gameSync').then((m) => m.saveGameState(true))
  }

  setVolume(db: number): void {
    const clamped = Math.max(-40, Math.min(0, db))
    this.volume = clamped
    saveVolume(clamped)
    if (this.kit) this.kit.bus.volume.rampTo(clamped, 0.05)
    this.notify()
  }

  /** Готовит Tone и синты. Безопасно вызывать многократно. */
  async ensureReady(): Promise<void> {
    if (this.kit) return
    if (this.loadingPromise) return this.loadingPromise
    this.loadingPromise = (async () => {
      const Tone = await import('tone')
      this.Tone = Tone
      if (Tone.context.state !== 'running') {
        try {
          await Tone.start()
        } catch {
          /* noop */
        }
      }
      // Bus с soft-shelf filter — режет резкие высокие частоты выше 4 kHz,
      // снимает "ухорезный" эффект bell/shimmer.
      const bus = new Tone.Volume(this.volume).toDestination()
      const masterFilter = new Tone.Filter({
        frequency: 4200,
        type: 'lowpass',
        rolloff: -12,
      }).connect(bus)

      const pluckRev = new Tone.Reverb({ decay: 1.0, wet: 0.18 }).connect(
        masterFilter,
      )
      await pluckRev.generate()
      const pluck = new Tone.Synth({
        oscillator: { type: 'triangle' },
        // Softer attack — было 0.005 (clicky), теперь 0.02
        envelope: { attack: 0.02, decay: 0.12, sustain: 0, release: 0.15 },
      }).connect(pluckRev)
      pluck.volume.value = -12 // было -8

      const membrane = new Tone.MembraneSynth({
        pitchDecay: 0.06,
        octaves: 4,
        envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.08 },
      }).connect(new Tone.Filter(500, 'lowpass').connect(masterFilter))
      membrane.volume.value = -12 // было -10

      const bellRev = new Tone.Reverb({ decay: 2.0, wet: 0.32 }).connect(
        masterFilter,
      )
      await bellRev.generate()
      const bellEcho = new Tone.FeedbackDelay('16n', 0.2).connect(bellRev)
      const bell = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        // Softer attack (было 0.005)
        envelope: { attack: 0.03, decay: 0.4, sustain: 0.15, release: 0.7 },
      }).connect(bellEcho)
      bell.volume.value = -12 // было -6 (на 6 dB тише)

      const shimmerRev = new Tone.Reverb({ decay: 3.5, wet: 0.5 }).connect(
        masterFilter,
      )
      await shimmerRev.generate()
      const shimmerEcho = new Tone.FeedbackDelay('8n', 0.3).connect(shimmerRev)
      const shimmer = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.05, decay: 0.6, sustain: 0.3, release: 1.4 },
      }).connect(shimmerEcho)
      shimmer.volume.value = -14 // было -10

      const tapPlayer = new Tone.Player('/frogTap.mp3').connect(masterFilter)
      tapPlayer.volume.value = -14 // было -10
      const mergePlayer = new Tone.Player('/frogMerge.mp3').connect(
        masterFilter,
      )
      mergePlayer.volume.value = -14 // было -10
      await Tone.loaded()

      this.kit = { pluck, membrane, bell, shimmer, tapPlayer, mergePlayer, bus }
    })()
    return this.loadingPromise
  }

  play(name: SfxName, opts: { level?: number } = {}): void {
    if (this.muted) return
    if (!this.kit) {
      const t0 = Date.now()
      void this.ensureReady()
        .then(() => {
          // Воспроизводим после загрузки если она заняла < 1с (короткие тапы)
          if (Date.now() - t0 < 1000) this.play(name, opts)
        })
        .catch(() => {
          /* noop */
        })
      return
    }
    const Tone = this.Tone!
    const now = Tone.now()
    const k = this.kit
    const level = opts.level ?? 1

    try {
      switch (name) {
        case 'pickup': {
          // Рандомный 300мс кусок из frogTap.mp3
          const CLIP = 0.3
          const totalDur = k.tapPlayer.buffer.duration
          const maxOffset = Math.max(0, totalDur - CLIP)
          const offset = Math.random() * maxOffset
          k.tapPlayer.start(now, offset, CLIP)
          break
        }
        case 'drop': {
          // Мягкий "тук"
          k.membrane.triggerAttackRelease('A1', '16n', now, 0.1)
          break
        }
        case 'merge': {
          // Рандомный 300мс кусок из frogMerge.mp3
          const CLIP = 0.3
          const totalDur = k.mergePlayer.buffer.duration
          const maxOffset = Math.max(0, totalDur - CLIP)
          const offset = Math.random() * maxOffset
          k.mergePlayer.start(now, offset, CLIP)
          break
        }
        case 'evolve': {
          // Триумфальный major. Убрали лишние октавные bell-stabs — было слишком ярко.
          const root = 58 + Math.min(level, 12) // на 2 полутона ниже
          const triad = [root, root + 4, root + 7, root + 12].map((n) =>
            Tone.Frequency(n, 'midi').toFrequency(),
          )
          k.shimmer.triggerAttackRelease(triad, 1.4, now, 0.5)
          // Один мягкий "ping" сверху вместо двух
          k.bell.triggerAttackRelease(
            Tone.Frequency(root + 19, 'midi').toFrequency(),
            0.7,
            now + 0.2,
            0.35,
          )
          break
        }
        case 'boxPop': {
          // Лёгкий "плюх" на тап по боксу. Играет часто, поэтому максимально
          // мягко: одна нота из C-пентатоники (рандом → повтор не монотонен,
          // пентатоника → любые соседние тапы не диссонируют), тихо и коротко.
          const PENTA = [72, 74, 76, 79, 81] // C5 D5 E5 G5 A5
          const midi = PENTA[Math.floor(Math.random() * PENTA.length)]
          const freq = Tone.Frequency(midi, 'midi').toFrequency()
          k.pluck.triggerAttackRelease(freq, '16n', now, 0.12)
          break
        }
        case 'boxOpen': {
          // Удар + 3-нотный каскад (было 4 + shimmer). Меньше резких bell stabs.
          k.membrane.triggerAttackRelease('C2', '8n', now, 0.45)
          const cascade = [60, 64, 67] // C4 E4 G4 (убрана C5 — была пиковая)
          cascade.forEach((midi, i) => {
            const freq = Tone.Frequency(midi, 'midi').toFrequency()
            k.bell.triggerAttackRelease(
              freq,
              0.45,
              now + 0.08 + i * 0.1,
              0.4,
            )
          })
          // Мягкий shimmer tail
          k.shimmer.triggerAttackRelease(
            Tone.Frequency(67, 'midi').toFrequency(),
            1.0,
            now + 0.35,
            0.3,
          )
          break
        }
      }
    } catch (e) {
      devWarn('[sfx] audio scheduling error (ignored):', e)
    }
  }
}

export const sfx = new SfxEngine()
