import type * as ToneNS from 'tone'
import type { ToneLib } from './types'

const KEY_MUTED = 'audio.sfxMuted'
const KEY_VOLUME = 'audio.sfxVolume'

export type SfxName = 'pickup' | 'drop' | 'merge' | 'evolve' | 'boxOpen'

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
      const bus = new Tone.Volume(this.volume).toDestination()

      const pluckRev = new Tone.Reverb({ decay: 1.2, wet: 0.25 }).connect(bus)
      await pluckRev.generate()
      const pluck = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.12 },
      }).connect(pluckRev)
      pluck.volume.value = -8

      const membrane = new Tone.MembraneSynth({
        pitchDecay: 0.06,
        octaves: 4,
        envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.08 },
      }).connect(new Tone.Filter(600, 'lowpass').connect(bus))
      membrane.volume.value = -10

      const bellRev = new Tone.Reverb({ decay: 2.5, wet: 0.45 }).connect(bus)
      await bellRev.generate()
      const bellEcho = new Tone.FeedbackDelay('16n', 0.25).connect(bellRev)
      const bell = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.4, sustain: 0.15, release: 0.6 },
      }).connect(bellEcho)
      bell.volume.value = -6

      const shimmerRev = new Tone.Reverb({ decay: 4, wet: 0.65 }).connect(bus)
      await shimmerRev.generate()
      const shimmerEcho = new Tone.FeedbackDelay('8n', 0.35).connect(shimmerRev)
      const shimmer = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.6, sustain: 0.3, release: 1.4 },
      }).connect(shimmerEcho)
      shimmer.volume.value = -10

      const tapPlayer = new Tone.Player('/frogTap.mp3').connect(bus)
      tapPlayer.volume.value = -10
      const mergePlayer = new Tone.Player('/frogMerge.mp3').connect(bus)
      mergePlayer.volume.value = -10
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
          // Триумфальный major + октавный шиммер сверху
          const root = 60 + Math.min(level, 14)
          const triad = [root, root + 4, root + 7, root + 12].map((n) =>
            Tone.Frequency(n, 'midi').toFrequency(),
          )
          k.shimmer.triggerAttackRelease(triad, 1.4, now, 0.6)
          // Сверху — звезда: октавная нота через 0.15s
          k.bell.triggerAttackRelease(
            Tone.Frequency(root + 24, 'midi').toFrequency(),
            0.6,
            now + 0.15,
            0.5,
          )
          k.bell.triggerAttackRelease(
            Tone.Frequency(root + 19, 'midi').toFrequency(),
            0.5,
            now + 0.3,
            0.4,
          )
          break
        }
        case 'boxOpen': {
          // Удар + восходящий каскад колоколов для открытия бокса
          k.membrane.triggerAttackRelease('C2', '8n', now, 0.5)
          const cascade = [60, 64, 67, 72] // C4 E4 G4 C5
          cascade.forEach((midi, i) => {
            const freq = Tone.Frequency(midi, 'midi').toFrequency()
            k.bell.triggerAttackRelease(
              freq,
              0.5,
              now + 0.08 + i * 0.1,
              0.55 + i * 0.05,
            )
          })
          k.shimmer.triggerAttackRelease(
            Tone.Frequency(72, 'midi').toFrequency(),
            1.2,
            now + 0.45,
            0.45,
          )
          break
        }
      }
    } catch (e) {
      console.warn('[sfx] audio scheduling error (ignored):', e)
    }
  }
}

export const sfx = new SfxEngine()
