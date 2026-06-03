import type * as ToneNS from 'tone'
import type { CreateTrack, TrackInstance } from '../types'
import { TRACK_META } from './index'
import { NodeBag, TimerBag, Mixer } from './_helpers'

// Hogstep — lo-fi nether anthem (порт автономного hogstep_disc.html).
// F# minor, 90 BPM, swing ~10%. 8 секций / 52 такта ≈ 139 сек, зациклен.
// Движок плеера расписывает по setTimeout + Tone.now() (без Tone.Transport),
// поэтому свинг и позиции bar:beat пересчитаны в секунды вручную.
//
// Слои:
//   bass808   — sub-808 бас (главная фишка Pigstep), длинные ноты + синкопы.
//   piano     — lo-fi FM-пиано (мелодия/аккорды) с vibrato-wobble.
//   lead      — saw-синт хук + соло, delay+reverb.
//   kick/snare/snareBody/hats/shaker — хип-хоп бит.
//   pad       — тёмный fatsaw фон.
//   crackle   — виниловый треск.

const BPM = 90
const SWING = 0.1 // см. скриншот: tempo ~середина (90), swing близко к нулю (~10%)
const SPB = 60 / BPM // сек на долю
const SEC_PER_BAR = SPB * 4

// Структура (в тактах) — порядок соответствует TRACK_META.hogstep.sections.
const SECTION_BARS = [4, 8, 8, 8, 4, 8, 8, 4] as const
const TOTAL_BARS = SECTION_BARS.reduce((a, b) => a + b, 0) // 52
const SECTION_START: number[] = (() => {
  const out: number[] = []
  let acc = 0
  for (const b of SECTION_BARS) {
    out.push(acc)
    acc += b
  }
  return out
})()

const TOTAL_SEC = TRACK_META.hogstep.totalSec

function sectionForBar(bar: number): number {
  let cur = 0
  for (let i = 0; i < SECTION_START.length; i++) {
    if (bar >= SECTION_START[i]) cur = i
  }
  return cur
}

// F# minor прогрессия: F#m – D – A – E (по одному аккорду на такт).
interface Chord {
  root: string
  fifth: string
  chord: string[]
  melody: string[]
}
const PROG: Chord[] = [
  {
    root: 'F#1',
    fifth: 'C#2',
    chord: ['F#3', 'A3', 'C#4'],
    melody: ['F#4', 'A4', 'C#5', 'A4', 'F#4', 'E4', 'C#4', 'F#4'],
  },
  {
    root: 'D1',
    fifth: 'A1',
    chord: ['D3', 'F#3', 'A3'],
    melody: ['D4', 'F#4', 'A4', 'F#4', 'D4', 'C#4', 'A3', 'D4'],
  },
  {
    root: 'A1',
    fifth: 'E2',
    chord: ['A3', 'C#4', 'E4'],
    melody: ['A4', 'C#5', 'E5', 'C#5', 'A4', 'B4', 'E4', 'A4'],
  },
  {
    root: 'E1',
    fifth: 'B1',
    chord: ['E3', 'G#3', 'B3'],
    melody: ['E4', 'G#4', 'B4', 'G#4', 'E4', 'F#4', 'B3', 'E4'],
  },
]

interface Voices {
  bass808: ToneNS.MonoSynth
  piano: ToneNS.PolySynth
  lead: ToneNS.MonoSynth
  kick: ToneNS.MembraneSynth
  snare: ToneNS.NoiseSynth
  snareBody: ToneNS.MembraneSynth
  hatClosed: ToneNS.NoiseSynth
  hatOpen: ToneNS.NoiseSynth
  pad: ToneNS.PolySynth
  crackle: ToneNS.NoiseSynth
  shaker: ToneNS.NoiseSynth
}

const create: CreateTrack = (Tone): TrackInstance => {
  const nodes = new NodeBag()
  const timers = new TimerBag()
  const mixer = new Mixer()
  let analyser: ToneNS.Analyser | null = null
  let voices: Voices | null = null

  // Длительности в секундах (вместо нотных строк, т.к. Transport не используется).
  const D2DOT = 3 * SPB // 2n.
  const D2 = 2 * SPB // 2n
  const D4DOT = 1.5 * SPB // 4n.
  const D4 = SPB // 4n
  const D8 = 0.5 * SPB // 8n
  const D16 = 0.25 * SPB // 16n
  const D32 = 0.125 * SPB // 32n
  const D1M = 4 * SPB // 1m

  // Позиция доли → абсолютное audio-время. Свинг сдвигает офф-биты (8-е «и»).
  const at = (t0: number, beat: number): number => {
    const eighth = beat * 2
    const isOffEighth =
      Math.abs(eighth - Math.round(eighth)) < 1e-6 &&
      Math.round(eighth) % 2 === 1
    const shift = isOffEighth ? SWING * (1 / 6) * SPB : 0
    return t0 + beat * SPB + shift
  }

  return {
    meta: TRACK_META.hogstep,

    async build(_Tone, outNode) {
      const masterRev = nodes.add(
        new Tone.Reverb({ decay: 2.5, wet: 0.2 }).connect(outNode),
      )
      const masterComp = nodes.add(
        new Tone.Compressor({ threshold: -14, ratio: 4 }).connect(masterRev),
      )

      analyser = new Tone.Analyser('waveform', 1024)
      masterRev.connect(analyser)
      nodes.add(analyser)

      // 808 бас
      const bassDist = nodes.add(new Tone.Distortion(0.15).connect(masterComp))
      const bassFilter = nodes.add(
        new Tone.Filter({ frequency: 180, type: 'lowpass' }).connect(bassDist),
      )
      const bass808 = nodes.add(
        new Tone.MonoSynth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.005, decay: 0.4, sustain: 0.3, release: 1.2 },
          filterEnvelope: {
            attack: 0.005,
            decay: 0.2,
            baseFrequency: 80,
            octaves: 2,
          },
        }).connect(bassFilter),
      )
      bass808.volume.value = -11 // приглушён (был -6) — слишком басило

      // Пиано (lo-fi FM)
      const pianoRev = nodes.add(
        new Tone.Reverb({ decay: 3.5, wet: 0.4 }).connect(masterComp),
      )
      const pianoVibrato = nodes.add(
        new Tone.Vibrato({ frequency: 2, depth: 0.04 }).connect(pianoRev),
      )
      const pianoFilter = nodes.add(
        new Tone.Filter({ frequency: 3500, type: 'lowpass' }).connect(
          pianoVibrato,
        ),
      )
      const piano = nodes.add(
        new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 2.5,
          modulationIndex: 5,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.005, decay: 0.8, sustain: 0.1, release: 0.8 },
          modulation: { type: 'triangle' },
          modulationEnvelope: {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.1,
            release: 0.3,
          },
        }).connect(pianoFilter),
      )
      piano.volume.value = -10

      // Лид-синт
      const leadRev = nodes.add(
        new Tone.Reverb({ decay: 2.5, wet: 0.35 }).connect(masterComp),
      )
      const leadDelay = nodes.add(
        new Tone.FeedbackDelay({
          delayTime: SPB / 3,
          feedback: 0.35,
          wet: 0.3,
        }).connect(leadRev),
      )
      const leadFilter = nodes.add(
        new Tone.Filter({ frequency: 3000, type: 'lowpass' }).connect(
          leadDelay,
        ),
      )
      const lead = nodes.add(
        new Tone.MonoSynth({
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.5, release: 0.4 },
          filterEnvelope: {
            attack: 0.01,
            decay: 0.2,
            baseFrequency: 1500,
            octaves: 2,
          },
        }).connect(leadFilter),
      )
      lead.volume.value = -14

      // Кик
      const kickFilter = nodes.add(
        new Tone.Filter({ frequency: 180, type: 'lowpass' }).connect(
          masterComp,
        ),
      )
      const kick = nodes.add(
        new Tone.MembraneSynth({
          pitchDecay: 0.04,
          octaves: 5,
          envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
        }).connect(kickFilter),
      )
      kick.volume.value = -10 // приглушён (был -8) — меньше низа

      // Снэр + body
      const snareFilter = nodes.add(
        new Tone.Filter({ frequency: 1800, type: 'highpass' }).connect(
          masterComp,
        ),
      )
      const snare = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
        }).connect(snareFilter),
      )
      snare.volume.value = -16
      const snareBody = nodes.add(
        new Tone.MembraneSynth({
          pitchDecay: 0.02,
          octaves: 3,
          envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
        }).connect(masterComp),
      )
      snareBody.volume.value = -18

      // Хай-хеты
      const hatFilter = nodes.add(
        new Tone.Filter({ frequency: 8000, type: 'highpass' }).connect(
          masterComp,
        ),
      )
      const hatClosed = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
        }).connect(hatFilter),
      )
      hatClosed.volume.value = -22
      const hatOpen = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.25, sustain: 0 },
        }).connect(hatFilter),
      )
      hatOpen.volume.value = -24

      // Пэд
      const padRev = nodes.add(
        new Tone.Reverb({ decay: 6, wet: 0.7 }).connect(masterComp),
      )
      const padFilter = nodes.add(
        new Tone.Filter({ frequency: 900, type: 'lowpass' }).connect(padRev),
      )
      const pad = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'fatsawtooth', count: 3, spread: 25 },
          envelope: { attack: 1.5, decay: 0.5, sustain: 0.7, release: 2.5 },
        }).connect(padFilter),
      )
      pad.volume.value = -26

      // Виниловый треск
      const crackleFilter = nodes.add(
        new Tone.Filter({ frequency: 4500, type: 'bandpass' }).connect(
          masterComp,
        ),
      )
      const crackle = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.001, decay: 0.02, sustain: 0 },
        }).connect(crackleFilter),
      )
      crackle.volume.value = -32

      // Шейкер
      const shakerFilter = nodes.add(
        new Tone.Filter({ frequency: 6000, type: 'highpass' }).connect(
          masterComp,
        ),
      )
      const shaker = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.005, decay: 0.05, sustain: 0 },
        }).connect(shakerFilter),
      )
      shaker.volume.value = -26

      await Promise.all([
        masterRev.generate(),
        pianoRev.generate(),
        leadRev.generate(),
        padRev.generate(),
      ])

      voices = {
        bass808,
        piano,
        lead,
        kick,
        snare,
        snareBody,
        hatClosed,
        hatOpen,
        pad,
        crackle,
        shaker,
      }

      // Микшер: голоса с громкостью для UI-ползунков.
      mixer.add('bass808', '808-бас', bass808)
      mixer.add('piano', 'Пиано', piano)
      mixer.add('lead', 'Лид', lead)
      mixer.add('kick', 'Кик', kick)
      mixer.add('snare', 'Снэр', snare)
      mixer.add('snareBody', 'Снэр-тело', snareBody)
      mixer.add('hatClosed', 'Хет закрытый', hatClosed)
      mixer.add('hatOpen', 'Хет открытый', hatOpen)
      mixer.add('pad', 'Пэд', pad)
      mixer.add('crackle', 'Винил', crackle)
      mixer.add('shaker', 'Шейкер', shaker)
    },

    startScheduler(fromSec, ctx) {
      if (!voices) return
      const v = voices
      timers.clearAll()

      // ─── паттерны одного такта (t0 = Tone.now() начала такта) ───
      const bass808Pattern = (t0: number, c: Chord, intensity = 1): void => {
        v.bass808.triggerAttackRelease(
          c.root,
          D2DOT,
          at(t0, 0),
          0.9 * intensity,
        )
        v.bass808.triggerAttackRelease(
          c.root,
          D16,
          at(t0, 2.5),
          0.7 * intensity,
        )
        v.bass808.triggerAttackRelease(
          c.fifth,
          D8,
          at(t0, 3.5),
          0.7 * intensity,
        )
      }
      const bass808Simple = (t0: number, c: Chord, intensity = 1): void => {
        v.bass808.triggerAttackRelease(c.root, D2, at(t0, 0), 0.85 * intensity)
        v.bass808.triggerAttackRelease(c.root, D2, at(t0, 2), 0.8 * intensity)
      }
      const snareHit = (
        t0: number,
        beat: number,
        sv: number,
        bv: number,
      ): void => {
        v.snare.triggerAttackRelease(D16, at(t0, beat), sv)
        v.snareBody.triggerAttackRelease('C3', D32, at(t0, beat), bv)
      }
      const beatLight = (t0: number): void => {
        v.kick.triggerAttackRelease('C2', D8, at(t0, 0), 0.85)
        snareHit(t0, 1, 0.7, 0.5)
        v.kick.triggerAttackRelease('C2', D8, at(t0, 2), 0.85)
        snareHit(t0, 3, 0.7, 0.5)
        for (let i = 0; i < 8; i++) {
          v.hatClosed.triggerAttackRelease(D16, at(t0, i / 2), 0.5)
        }
      }
      const beatFull = (t0: number): void => {
        v.kick.triggerAttackRelease('C2', D8, at(t0, 0), 0.9)
        v.kick.triggerAttackRelease('C2', D16, at(t0, 0.75), 0.6)
        snareHit(t0, 1, 0.75, 0.55)
        v.kick.triggerAttackRelease('C2', D8, at(t0, 2), 0.9)
        v.kick.triggerAttackRelease('C2', D16, at(t0, 2.75), 0.5)
        snareHit(t0, 3, 0.75, 0.55)
        for (let i = 0; i < 16; i++) {
          const beat = i / 4
          const isOffBeat = (i + 1) % 4 === 0
          if (isOffBeat && Math.random() < 0.4) {
            v.hatOpen.triggerAttackRelease(D16, at(t0, beat), 0.4)
          } else {
            v.hatClosed.triggerAttackRelease(D32, at(t0, beat), 0.4)
          }
        }
        ;[0.5, 1.5, 2.5, 3.5].forEach((beat) => {
          v.shaker.triggerAttackRelease(D32, at(t0, beat), 0.4)
        })
      }
      const beatHalf = (t0: number): void => {
        v.kick.triggerAttackRelease('C2', D8, at(t0, 0), 0.85)
        snareHit(t0, 2, 0.85, 0.7)
        ;[1, 3].forEach((beat) => {
          v.hatClosed.triggerAttackRelease(D16, at(t0, beat), 0.5)
        })
      }
      const pianoMelody = (t0: number, c: Chord, intensity = 1): void => {
        ;[0, 2, 3, 5, 6].forEach((pos) => {
          const beat = pos / 2
          const note = c.melody[pos % c.melody.length]
          v.piano.triggerAttackRelease(note, D8, at(t0, beat), 0.6 * intensity)
        })
      }
      const pianoChords = (t0: number, c: Chord, intensity = 1): void => {
        v.piano.triggerAttackRelease(c.chord, D2, at(t0, 0), 0.5 * intensity)
        v.piano.triggerAttackRelease(c.chord, D2, at(t0, 2), 0.45 * intensity)
      }
      const leadHook = (t0: number, c: Chord, intensity = 1): void => {
        v.lead.triggerAttackRelease(c.melody[0], D4, at(t0, 0), 0.7 * intensity)
        v.lead.triggerAttackRelease(
          c.melody[2],
          D8,
          at(t0, 1.5),
          0.65 * intensity,
        )
        v.lead.triggerAttackRelease(c.melody[1], D8, at(t0, 2), 0.6 * intensity)
        v.lead.triggerAttackRelease(
          c.melody[3],
          D4DOT,
          at(t0, 2.5),
          0.65 * intensity,
        )
      }
      const leadSolo = (t0: number, c: Chord, intensity = 1): void => {
        const positions = [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]
        positions.forEach((pos, n) => {
          const beat = pos / 4
          const note = c.melody[(n + 2) % c.melody.length]
          v.lead.triggerAttackRelease(note, D16, at(t0, beat), 0.65 * intensity)
        })
      }
      const padBar = (t0: number, c: Chord, intensity = 1): void => {
        v.pad.triggerAttackRelease(c.chord, D1M, at(t0, 0), 0.4 * intensity)
      }

      const renderBar = (loopBar: number): void => {
        const sec = sectionForBar(loopBar)
        const localBar = loopBar - SECTION_START[sec]
        const c = PROG[localBar % 4]
        const t0 = Tone.now() + 0.03

        switch (sec) {
          case 0: // INTRO · DROP
            padBar(t0, c, 0.5 + localBar * 0.15)
            if (localBar >= 2) bass808Simple(t0, c, 0.7)
            if (localBar === 3) {
              v.kick.triggerAttackRelease('C2', D8, at(t0, 3), 0.9)
              v.kick.triggerAttackRelease('C2', D16, at(t0, 3.5), 0.95)
            }
            break
          case 1: // VERSE · GROOVE
            padBar(t0, c, 0.5)
            bass808Pattern(t0, c)
            beatLight(t0)
            pianoChords(t0, c, 0.55)
            break
          case 2: // PIANO · DREAMS
            padBar(t0, c, 0.55)
            bass808Pattern(t0, c)
            beatLight(t0)
            pianoMelody(t0, c, 0.85)
            break
          case 3: // DROP · HARD
            padBar(t0, c, 0.6)
            bass808Pattern(t0, c)
            beatFull(t0)
            pianoMelody(t0, c, 0.75)
            leadHook(t0, c, 0.9)
            break
          case 4: // BREAK · HALF
            padBar(t0, c, 0.7)
            beatHalf(t0)
            pianoChords(t0, c, 0.7)
            if (localBar >= 2) {
              v.bass808.triggerAttackRelease(c.root, D4, at(t0, 3), 0.8)
            }
            break
          case 5: // DROP · HARDER
            padBar(t0, c, 0.7)
            bass808Pattern(t0, c, 1.1)
            beatFull(t0)
            pianoMelody(t0, c, 0.8)
            leadHook(t0, c, 1.0)
            break
          case 6: // LEAD · SOLO
            padBar(t0, c, 0.5)
            bass808Pattern(t0, c)
            beatFull(t0)
            pianoChords(t0, c, 0.5)
            leadSolo(t0, c, 0.85)
            break
          case 7: // OUTRO · FADE
            padBar(t0, c, Math.max(0.3, 0.7 - localBar * 0.15))
            bass808Simple(t0, c, Math.max(0.3, 0.85 - localBar * 0.2))
            if (localBar < 2) beatLight(t0)
            pianoMelody(t0, c, Math.max(0.2, 0.7 - localBar * 0.18))
            break
        }
      }

      // ─── такт-цикл ───
      const e0 = ((fromSec % TOTAL_SEC) + TOTAL_SEC) % TOTAL_SEC
      let bar = Math.floor(e0 / SEC_PER_BAR)
      let curSec = sectionForBar(((bar % TOTAL_BARS) + TOTAL_BARS) % TOTAL_BARS)
      ctx.onSectionChange(curSec)

      const playBar = (): void => {
        if (!ctx.isPlaying()) return
        const loopBar = ((bar % TOTAL_BARS) + TOTAL_BARS) % TOTAL_BARS
        const sec = sectionForBar(loopBar)
        if (sec !== curSec) {
          curSec = sec
          ctx.onSectionChange(curSec)
        }
        renderBar(loopBar)
        bar++
        timers.pushTimeout(playBar, SEC_PER_BAR * 1000)
      }
      playBar()

      // ─── виниловый треск ───
      timers.pushInterval(() => {
        if (!ctx.isPlaying()) return
        if (Math.random() < 0.4) {
          v.crackle.triggerAttackRelease(
            D32,
            Tone.now(),
            0.2 + Math.random() * 0.2,
          )
        }
      }, 400)
    },

    stopScheduler() {
      timers.clearAll()
    },

    async dispose() {
      timers.clearAll()
      nodes.stopAll()
      await new Promise((r) => setTimeout(r, 100))
      nodes.disposeAll()
      voices = null
      analyser = null
    },

    getAnalyser: () => analyser,
    getMixer: () => mixer.channels(),
  }
}

export default create
