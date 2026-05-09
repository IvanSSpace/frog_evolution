import type * as ToneNS from 'tone'
import type { ToneLib } from './types'
import { eventBus } from '../store/eventBus'

/**
 * Голос планеты: при тапе по планете играет уникальный по типу звук,
 * длиной = длительности анимации (получаем через event payload).
 *
 * Архитектура:
 * - Один общий шина (Volume) → Destination
 * - Несколько универсальных синтов: bell, drone, pluck, noise, fm
 * - Per-type "voice profile": какие синты играют, в каких октавах/нотах
 * - ADSR envelope растягивается под durationMs (attack=fixed, sustain=stretch, release=fixed)
 */

const KEY_MUTED = 'audio.planetVoiceMuted'
const KEY_VOLUME = 'audio.planetVoiceVolume'

// Phase 8: детерминированный PRNG (копия StarMapScene.ts:71-80) для derivation
// per-planet sound modulations из seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Phase 8: per-archetype 7-нотные scale (MIDI-ноты) для D-13.
// Каждая запись — 7 элементов, чтобы deriveModulations.pitchStep%7 безопасно
// индексировал. Plasma (whole-tone, 6 нот) обёрнута wraparound +12.
// Binary (C major triad) растянут на 2 октавы для 7 степеней.
export const THEME_SCALES: Record<string, number[]> = {
  // ── Main race types ──
  home: [60, 62, 64, 65, 67, 69, 71], // C major (bright, neutral)
  crystal: [64, 67, 69, 71, 74, 76, 79], // E minor pentatonic (sparkly, hopeful)
  rocky: [60, 62, 63, 65, 67, 68, 70], // C natural minor (heavy, grounded)
  ancient: [69, 71, 72, 74, 76, 77, 79], // A Aeolian (mournful, deep)
  mystic: [62, 63, 65, 67, 69, 70, 72], // D Phrygian (mystical, eastern)
  organic: [65, 67, 69, 71, 72, 74, 76], // F Lydian (fresh, growing)
  forge: [67, 69, 70, 72, 74, 75, 77], // G minor (mechanical, fiery)
  military: [62, 64, 65, 67, 69, 71, 72], // D Dorian (martial)
  destroyed: [71, 72, 74, 76, 77, 79, 81], // B Locrian (broken, unstable)
  crystal_bio: [69, 71, 73, 76, 78, 81, 83], // A major pentatonic (bright bio)
  mechano: [60, 62, 64, 65, 67, 69, 70], // C Mixolydian (industrial)
  energy: [64, 66, 68, 69, 71, 73, 75], // E major (electric, bright)
  mist: [69, 71, 72, 74, 76, 77, 79], // A Aeolian soft (quiet, foggy)
  aquatic: [67, 69, 70, 72, 74, 76, 77], // G Dorian (flowing)
  shadow: [60, 61, 63, 65, 66, 68, 70], // C Locrian (dark)
  aerial: [67, 69, 71, 73, 74, 76, 78], // G Lydian (airy, lifting)
  // ── BG archetypes ──
  gas_giant: [60, 62, 64, 65, 67, 69, 70], // C Mixolydian (giant calm)
  gas_ringed: [62, 64, 66, 68, 69, 71, 73], // D Lydian (ringed elegance)
  ice: [64, 66, 68, 69, 71, 73, 75], // E major (bright crystalline)
  ocean: [65, 67, 69, 71, 72, 74, 76], // F Lydian (oceanic float)
  desert: [65, 67, 68, 70, 72, 74, 75], // F Dorian (dry warm)
  lava: [60, 61, 63, 65, 66, 68, 70], // C Locrian (molten dark)
  forest: [62, 64, 65, 67, 69, 71, 72], // D Dorian (alive forest)
  mineral: [60, 62, 64, 65, 67, 69, 71], // C major (mineral neutral)
  dead: [60, 62, 63, 65, 67, 68, 70], // C natural minor (lifeless)
  toxic: [62, 63, 65, 67, 69, 70, 72], // D Phrygian (poisonous)
  plasma: [60, 62, 64, 66, 68, 70, 72], // whole-tone wrapped to 7 (plasma alien)
  binary: [60, 64, 67, 72, 76, 79, 84], // C major triad across 2 octaves
}

/**
 * Per-planet sound modulations derived from seed.
 * - pitchStep: 0..13 — 7 scale steps × 2 octaves
 * - rotationIdx: 0..5 — note permutation (cyclic shift)
 * - inversionIdx: 0..2 — root/first/second voicing inversion
 * - detuneBin: 0..3 — discrete detune cents
 * - cutoffBin: 0..3 — discrete filter cutoff
 */
export interface PlanetModulations {
  pitchStep: number
  rotationIdx: number
  inversionIdx: number
  detuneBin: number
  cutoffBin: number
}

/**
 * Phase 8: детерминированно выводит 5 модуляций звука из seed.
 * 14 × 6 × 3 × 4 × 4 = 4032 уникальных комбинаций per archetype.
 * archetype param пока не используется (зарезервирован для per-archetype overrides),
 * underscore-prefixed for ESLint.
 */
export function deriveModulations(
  seed: number,
  _archetype: string,
): PlanetModulations {
  const rng = mulberry32(seed)
  return {
    pitchStep: Math.floor(rng() * 14),
    rotationIdx: Math.floor(rng() * 6),
    inversionIdx: Math.floor(rng() * 3),
    detuneBin: Math.floor(rng() * 4),
    cutoffBin: Math.floor(rng() * 4),
  }
}

/**
 * Применяет rotation (cyclic shift) и inversion (первые N нот вверх на октаву)
 * к массиву MIDI-нот. Возвращает новый массив, исходный не мутируется.
 */
export function applyVoicing(
  notes: number[],
  rotationIdx: number,
  inversionIdx: number,
): number[] {
  if (notes.length === 0) return notes.slice()
  // Rotation: cyclic shift по rotationIdx % notes.length
  const rot = rotationIdx % notes.length
  const rotated = notes.slice(rot).concat(notes.slice(0, rot))
  // Inversion: первые inversionIdx нот +12 semitones (cap = notes.length-1)
  const invCount = Math.min(inversionIdx, Math.max(0, rotated.length - 1))
  return rotated.map((n, i) => (i < invCount ? n + 12 : n))
}

/**
 * Cents detune для bin 0..3, симметричный диапазон ±range.
 * Дефолт range=15: bins → [-15, -5, +5, +15].
 */
export function detuneCents(bin: number, range = 15): number {
  const map = [-range, -range / 3, range / 3, range]
  return map[Math.max(0, Math.min(3, bin))]
}

/**
 * Filter cutoff Hz для bin 0..3, логарифмическая интерполяция от lo до hi.
 * Дефолт [400, 4000]: bins ≈ [400, 860, 1860, 4000].
 */
export function cutoffHz(
  bin: number,
  range: [number, number] = [400, 4000],
): number {
  const [lo, hi] = range
  const b = Math.max(0, Math.min(3, bin))
  return Math.round(lo * Math.pow(hi / lo, b / 3))
}

function loadMuted(): boolean {
  return localStorage.getItem(KEY_MUTED) === '1'
}
function saveMuted(v: boolean): void {
  localStorage.setItem(KEY_MUTED, v ? '1' : '0')
}
function loadVolume(): number {
  const raw = localStorage.getItem(KEY_VOLUME)
  if (!raw) return -10
  const n = Number(raw)
  if (!Number.isFinite(n)) return -10
  return Math.max(-40, Math.min(0, n))
}
function saveVolume(db: number): void {
  localStorage.setItem(KEY_VOLUME, String(db))
}

interface VoiceKit {
  bus: ToneNS.Volume
  bell: ToneNS.PolySynth
  drone: ToneNS.PolySynth
  pluck: ToneNS.Synth
  noise: ToneNS.NoiseSynth
  fm: ToneNS.FMSynth
  membrane: ToneNS.MembraneSynth
  // Phase 8: explicit references к filter'ам — нужны для cutoff модуляций
  droneFilter: ToneNS.Filter
  noiseFilter: ToneNS.Filter
}

/**
 * Профиль голоса для типа планеты.
 * - notes: ноты (MIDI), которые сложатся в аккорд/мотив
 * - synths: какие синты включить (combinable)
 * - filter: цвет/тембр (lowpass/highpass cutoff), 0 = no filter
 * - detune: расстройка для атмосферных эффектов (cents)
 * - noiseType: 'pink' / 'white' / 'brown' для шумовых компонентов
 */
interface VoiceProfile {
  notes: number[]
  synths: Array<'bell' | 'drone' | 'pluck' | 'noise' | 'fm' | 'membrane'>
  noiseType?: 'pink' | 'white' | 'brown'
  detune?: number
  octaveOffset?: number
  // Phase 8: per-archetype modulation hooks (используются если задан seed в play()).
  // Дефолтные значения берутся из THEME_SCALES + жёстко закодированных диапазонов.
  scaleNotes?: number[]
  detuneRange?: number
  cutoffRange?: [number, number]
  // Per-profile gain boost in dB. 0 = default, 6 ≈ ×2 громкость, -6 ≈ ×0.5.
  // Применяется к velocity всех trigger calls (clamped 0..1).
  gain?: number
}

// MIDI: 60=C4, 65=F4, 67=G4, 72=C5
const C = 60,
  D = 62,
  Eb = 63,
  E = 64,
  F = 65,
  Fs = 66,
  G = 67,
  A = 69,
  Bb = 70,
  B = 71

const PROFILES: Record<string, VoiceProfile> = {
  // ── Main race types ──
  home: { notes: [C, E, G, C + 12], synths: ['bell', 'drone'], gain: -1 },
  crystal: {
    notes: [E + 12, G + 12, B + 12],
    synths: ['bell', 'pluck'],
    detune: 5,
    gain: -1.5,
  },
  rocky: { notes: [C - 24, G - 12], synths: ['membrane', 'drone'] },
  ancient: {
    notes: [A - 12, E, A],
    synths: ['drone', 'bell'],
    octaveOffset: -12,
    gain: -1,
  },
  mystic: {
    notes: [Fs, A, Cs(), Fs + 12],
    synths: ['drone', 'bell'],
    detune: 12,
    gain: -1,
  },
  organic: {
    notes: [F, A, C + 12],
    synths: ['drone', 'noise'],
    noiseType: 'pink',
  },
  forge: {
    notes: [C, Eb, G],
    synths: ['membrane', 'noise', 'fm'],
    noiseType: 'white',
  },
  military: {
    notes: [C, C - 12, G - 12],
    synths: ['membrane', 'fm', 'pluck'],
    gain: 2,
  },
  destroyed: {
    notes: [Eb - 12, Bb - 12],
    synths: ['noise', 'drone'],
    noiseType: 'brown',
  },
  crystal_bio: {
    notes: [F + 12, A + 12, C + 24],
    synths: ['bell', 'drone', 'pluck'],
    gain: -2,
  },
  mechano: { notes: [C, G, C + 12], synths: ['fm', 'pluck'] },
  energy: {
    notes: [E + 12, G + 12, B + 12, E + 24],
    synths: ['fm', 'pluck'],
    detune: 8,
  },
  mist: {
    notes: [D, A, D + 12],
    synths: ['drone', 'noise'],
    noiseType: 'pink',
  },
  aquatic: {
    notes: [G, B, D + 12],
    synths: ['bell', 'noise'],
    noiseType: 'pink',
  },
  shadow: {
    notes: [C - 24, Eb - 12],
    synths: ['drone', 'noise'],
    noiseType: 'brown',
  },
  aerial: {
    notes: [G + 12, B + 12, D + 24],
    synths: ['pluck', 'noise'],
    noiseType: 'white',
  },

  // ── BG archetypes ──
  gas_giant: { notes: [C - 12, G - 12, C], synths: ['drone', 'fm'] },
  gas_ringed: {
    notes: [C - 12, G - 12, E + 12, G + 12],
    synths: ['drone', 'bell'],
    gain: -1,
  },
  ice: { notes: [E + 12, B + 12, E + 24], synths: ['bell', 'pluck'], gain: -1.5 },
  ocean: {
    notes: [F, A, C + 12],
    synths: ['drone', 'noise'],
    noiseType: 'pink',
  },
  desert: { notes: [F, C + 12], synths: ['noise', 'drone'], noiseType: 'pink' },
  lava: {
    notes: [C - 12, Eb - 12],
    synths: ['membrane', 'noise', 'fm'],
    noiseType: 'brown',
  },
  forest: {
    notes: [G, B, D + 12],
    synths: ['pluck', 'noise'],
    noiseType: 'pink',
  },
  mineral: { notes: [C + 12, G + 12], synths: ['bell', 'membrane'], gain: -1 },
  dead: { notes: [C - 24], synths: ['drone'] },
  toxic: { notes: [Eb, A], synths: ['drone', 'fm'], detune: 20 },
  plasma: {
    notes: [G + 12, D + 24, A + 24],
    synths: ['fm', 'pluck'],
    detune: 15,
  },
  binary: { notes: [C, F], synths: ['drone', 'fm'] },
}

function Cs(): number {
  return C + 1
} // C# (использован в mystic)

class PlanetVoice {
  private Tone: ToneLib | null = null
  private kit: VoiceKit | null = null
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
    const c = Math.max(-40, Math.min(0, db))
    this.volume = c
    saveVolume(c)
    if (this.kit) this.kit.bus.volume.rampTo(c, 0.05)
    this.notify()
  }

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
      const masterRev = new Tone.Reverb({ decay: 4, wet: 0.4 }).connect(bus)
      await masterRev.generate()

      const bell = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.5, release: 0.4 },
      }).connect(masterRev)
      bell.volume.value = -8

      // Phase 8: filter'ы вынесены в named refs чтобы их frequency.rampTo можно
      // было модулировать per-planet seed.
      const droneFilter = new Tone.Filter(800, 'lowpass')
      droneFilter.connect(masterRev)
      const drone = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.15, decay: 0.2, sustain: 0.8, release: 0.6 },
      }).connect(droneFilter)
      drone.volume.value = -12

      const pluck = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.3 },
      }).connect(masterRev)
      pluck.volume.value = -10

      const noiseFilter = new Tone.Filter(1200, 'bandpass')
      noiseFilter.connect(masterRev)
      const noise = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.6 },
      }).connect(noiseFilter)
      noise.volume.value = -22

      const fm = new Tone.FMSynth({
        harmonicity: 2,
        modulationIndex: 3,
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 },
        modulationEnvelope: {
          attack: 0.05,
          decay: 0.2,
          sustain: 0.4,
          release: 0.3,
        },
      }).connect(masterRev)
      fm.volume.value = -14

      const membrane = new Tone.MembraneSynth({
        pitchDecay: 0.15,
        octaves: 6,
        envelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.3 },
      }).connect(new Tone.Filter(400, 'lowpass').connect(masterRev))
      membrane.volume.value = -10

      this.kit = {
        bus,
        bell,
        drone,
        pluck,
        noise,
        fm,
        membrane,
        droneFilter,
        noiseFilter,
      }
    })()
    return this.loadingPromise
  }

  /**
   * Проигрывает голос планеты длительностью durationMs.
   * Реальная длина = max(durationMs, 250ms) — крайне короткие анимации
   * получают минимально слышимый звук.
   *
   * Phase 8: при наличии seed выводит 5 модуляций (deriveModulations),
   * применяет per-archetype scale (THEME_SCALES) к pitch, voicing rotation/inversion,
   * detune cents и filter cutoff. Без seed — поведение идентично Phase 7
   * (graceful degradation для legacy callers).
   */
  play(
    typeOrArchetype: string,
    durationMs: number,
    archetypeFallback?: string,
    seed?: number,
  ): void {
    if (this.muted) return
    if (!this.kit) {
      const t0 = Date.now()
      void this.ensureReady()
        .then(() => {
          // Воспроизводим после загрузки если успели < 1с
          if (Date.now() - t0 < 1000)
            this.play(typeOrArchetype, durationMs, archetypeFallback, seed)
        })
        .catch(() => {
          /* noop */
        })
      return
    }
    const profile =
      PROFILES[typeOrArchetype] ??
      (archetypeFallback ? PROFILES[archetypeFallback] : null)
    if (!profile) return

    const Tone = this.Tone!
    const k = this.kit
    const dur = Math.max(0.25, durationMs / 1000)
    const now = Tone.now()
    const sustainDur = Math.max(0.1, dur - 0.15) // attack ~50ms + release ~100ms

    // Phase 8: derive модуляций. archetypeKey — ключ который мы получили (предпочитаем
    // его перед fallback'ом для scale lookup); без seed — модуляций нет (Phase 7 path).
    const archetypeKey = typeOrArchetype
    const scale =
      profile.scaleNotes ??
      THEME_SCALES[archetypeKey] ??
      (archetypeFallback ? THEME_SCALES[archetypeFallback] : undefined) ??
      null
    const mod: PlanetModulations | null =
      seed !== undefined && scale ? deriveModulations(seed, archetypeKey) : null

    const octShift = profile.octaveOffset ?? 0
    let baseNotes: number[]
    if (mod && scale) {
      // Phase 8: pitch step из scale, octave wrap для pitchStep 7..13.
      const stepInOctave = mod.pitchStep % 7
      const octaveAdd = Math.floor(mod.pitchStep / 7) * 12
      const root = scale[stepInOctave] + octaveAdd
      // Аккорд: root + 3я + 5я (по scale, циклически).
      const third = scale[(stepInOctave + 2) % 7] + octaveAdd
      const fifth = scale[(stepInOctave + 4) % 7] + octaveAdd
      baseNotes = [root, third, fifth]
    } else {
      baseNotes = profile.notes.slice()
    }

    // Apply rotation + inversion (Phase 8) если есть mod.
    const voicedMidi = mod
      ? applyVoicing(baseNotes, mod.rotationIdx, mod.inversionIdx)
      : baseNotes

    const notes = voicedMidi.map((m) =>
      Tone.Frequency(m + octShift, 'midi').toFrequency(),
    )

    // Phase 8: применяем cutoff bin к droneFilter и noiseFilter (rampTo 50ms — без щелчков).
    if (mod) {
      const droneCutoff = cutoffHz(
        mod.cutoffBin,
        profile.cutoffRange ?? [400, 4000],
      )
      k.droneFilter.frequency.rampTo(droneCutoff, 0.05)
      const noiseCutoff = cutoffHz(mod.cutoffBin, [600, 3000])
      k.noiseFilter.frequency.rampTo(noiseCutoff, 0.05)
    }

    // Phase 8: detune cents — bell/pluck/fm получают полный, drone — половину
    // (для атмосферности без размывания тоники).
    const detuneOverride = mod
      ? detuneCents(mod.detuneBin, profile.detuneRange ?? 15)
      : (profile.detune ?? 0)

    // Per-profile velocity multiplier (linear from gain dB), clamped to safe range.
    const gainLin = Math.pow(10, (profile.gain ?? 0) / 20)
    const v = (base: number): number => Math.max(0, Math.min(1, base * gainLin))

    for (const synth of profile.synths) {
      try {
        if (synth === 'bell') {
          k.bell.set({ detune: detuneOverride })
          k.bell.triggerAttackRelease(notes, sustainDur, now, v(0.5))
        } else if (synth === 'drone') {
          k.drone.set({ detune: detuneOverride / 2 })
          k.drone.triggerAttackRelease(notes, sustainDur, now, v(0.55))
        } else if (synth === 'pluck') {
          k.pluck.detune.value = detuneOverride
          notes.forEach((n, i) => {
            k.pluck.triggerAttackRelease(
              n,
              sustainDur * 0.5,
              now + i * 0.06,
              v(0.5),
            )
          })
        } else if (synth === 'noise') {
          if (profile.noiseType)
            (k.noise.noise as { type: string }).type = profile.noiseType
          k.noise.triggerAttackRelease(sustainDur, now, v(0.45))
        } else if (synth === 'fm') {
          k.fm.detune.value = detuneOverride
          // FM играет первую ноту аккорда + квинту
          const root = notes[0]
          k.fm.triggerAttackRelease(root, sustainDur, now, v(0.5))
          if (notes.length >= 3) {
            k.fm.triggerAttackRelease(
              notes[2],
              sustainDur * 0.7,
              now + 0.05,
              v(0.4),
            )
          }
        } else if (synth === 'membrane') {
          k.membrane.triggerAttackRelease(
            notes[0],
            Math.min(sustainDur, 0.6),
            now,
            v(0.7),
          )
        }
      } catch {
        /* noop */
      }
    }
  }
}

export const planetVoice = new PlanetVoice()

let initialized = false

export function initPlanetVoice(): void {
  if (initialized) return
  initialized = true

  eventBus.on(
    'starmap:planet-tapped',
    ({ type, archetype, durationMs, seed }) => {
      // Для BG-планет приоритет архетипа, для main races — type
      const key = archetype ?? type
      planetVoice.play(key, durationMs, type, seed)
    },
  )
}
