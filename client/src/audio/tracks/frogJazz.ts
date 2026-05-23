import type * as ToneNS from 'tone'
import type { CreateTrack, TrackInstance } from '../types'
import { TRACK_META } from './index'
import { NodeBag, TimerBag } from './_helpers'

// Frog Jazz — лягушачий джаз. Walking bass + piano comping + brass lead
// + scat-frog ribbits. Swing-фил через долю в 2/3 (не triplets — упрощённо).
//
// A minor → D minor → A minor, ~110 BPM, 108 sec, 4 секции по 27 сек.
//
// Слои:
//   bass    — Synth (square), walking bass quarter notes по аккордам
//   piano   — PolySynth (triangle pad), 7th chords на off-beats (2 и 4)
//   brass   — Synth (sawtooth + filter), мелодия с lead-нотами
//   hat     — NoiseSynth, hi-hat на каждой 8-й
//   ribbit  — NoiseSynth + bandpass + PitchShift, лягушачий «scat»

const SECTIONS = TRACK_META.frogJazz.sections
const TOTAL_SEC = TRACK_META.frogJazz.totalSec
const BPM = 110
const SEC_PER_BEAT = 60 / BPM

interface Voices {
  bass: ToneNS.Synth
  piano: ToneNS.PolySynth
  brass: ToneNS.Synth
  brassFilter: ToneNS.Filter
  hat: ToneNS.NoiseSynth
  hatFilter: ToneNS.Filter
  ribbitNoise: ToneNS.NoiseSynth
  ribbitFilter: ToneNS.Filter
  kick: ToneNS.MembraneSynth
}

const create: CreateTrack = (Tone): TrackInstance => {
  const nodes = new NodeBag()
  const timers = new TimerBag()
  let analyser: ToneNS.Analyser | null = null
  let voices: Voices | null = null

  function findSection(elapsed: number): number {
    const e = elapsed % TOTAL_SEC
    let curr = 0
    for (let i = 0; i < SECTIONS.length; i++) {
      if (e >= SECTIONS[i].start) curr = i
    }
    return curr
  }

  return {
    meta: TRACK_META.frogJazz,

    async build(_Tone, outNode) {
      const masterRev = nodes.add(
        new Tone.Reverb({ decay: 2.5, wet: 0.25 }).connect(outNode),
      )
      await masterRev.generate()

      analyser = new Tone.Analyser('waveform', 1024)
      masterRev.connect(analyser)
      nodes.add(analyser)

      // Walking bass — упругий square с быстрым релизом
      const bass = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'square' },
          envelope: { attack: 0.005, decay: 0.18, sustain: 0.2, release: 0.18 },
        }).connect(masterRev),
      )
      bass.volume.value = -10

      // Piano comping — мягкий triangle pad
      const piano = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 0.5 },
        }).connect(masterRev),
      )
      piano.volume.value = -16

      // Brass lead — sawtooth через lowpass filter
      const brassFilter = nodes.add(
        new Tone.Filter({ frequency: 1800, type: 'lowpass', Q: 1.2 }).connect(
          masterRev,
        ),
      )
      const brass = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.04, decay: 0.15, sustain: 0.5, release: 0.3 },
        }).connect(brassFilter),
      )
      brass.volume.value = -14

      // Hi-hat — белый шум через highpass
      const hatFilter = nodes.add(
        new Tone.Filter({ frequency: 6000, type: 'highpass' }).connect(
          masterRev,
        ),
      )
      const hat = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
        }).connect(hatFilter),
      )
      hat.volume.value = -24

      // Ribbit — bandpass brown noise + pitch shift (лягушачий «scat»)
      const ribbitFilter = nodes.add(
        new Tone.Filter({ frequency: 380, type: 'bandpass', Q: 6 }).connect(
          masterRev,
        ),
      )
      const ribbitNoise = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'brown' },
          envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.04 },
        }).connect(ribbitFilter),
      )
      ribbitNoise.volume.value = -10

      // Kick — джазовая бочка (мягче чем в swamp)
      const kick = nodes.add(
        new Tone.MembraneSynth({
          pitchDecay: 0.04,
          octaves: 3,
          envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.08 },
        }).connect(masterRev),
      )
      kick.volume.value = -12

      voices = {
        bass,
        piano,
        brass,
        brassFilter,
        hat,
        hatFilter,
        ribbitNoise,
        ribbitFilter,
        kick,
      }
    },

    startScheduler(fromSec, ctx) {
      if (!voices) return
      timers.clearAll()
      const startElapsed = fromSec
      ctx.onSectionChange(findSection(startElapsed))

      // Section watcher
      let curSec = findSection(startElapsed)
      const sectionTick = (): void => {
        if (!ctx.isPlaying()) return
        const sec = findSection(ctx.getElapsed())
        if (sec !== curSec) {
          curSec = sec
          ctx.onSectionChange(curSec)
        }
        timers.pushTimeout(sectionTick, 200)
      }
      sectionTick()

      const scheduleAt = (offsetSec: number, action: () => void): void => {
        const delay = Math.max(0, (offsetSec - startElapsed) * 1000)
        timers.pushTimeout(action, delay)
      }

      // Jazz progression — ii-V-i: Bm7♭5 → E7 → Am7 → Am7 (по 4 удара)
      // Walking bass — root, 3rd, 5th, approach-tone обратно
      const WALKING_BARS: Array<{
        chord: string[]
        bass: string[]
      }> = [
        {
          chord: ['A3', 'C4', 'E4', 'G4'],
          bass: ['A2', 'C3', 'E3', 'G3'],
        },
        {
          chord: ['D3', 'F3', 'A3', 'C4'],
          bass: ['D2', 'F2', 'A2', 'C3'],
        },
        {
          chord: ['B2', 'D3', 'F3', 'A3'],
          bass: ['B2', 'D3', 'F3', 'A3'],
        },
        {
          chord: ['E3', 'G#3', 'B3', 'D4'],
          bass: ['E2', 'G#2', 'B2', 'D3'],
        },
      ]

      // Helper: swing-time для off-beat (вторая 8-я доля сдвинута чуть позже)
      const swingOff = (beat: number): number =>
        beat * SEC_PER_BEAT + SEC_PER_BEAT * 0.66

      // ─── Section I (0+) — Intro: только walking bass + hi-hat ───
      scheduleAt(0, () => {
        let bar = 0
        const playBar = (): void => {
          if (!ctx.isPlaying() || !voices) return
          const b = WALKING_BARS[bar % WALKING_BARS.length]
          const now = Tone.now()
          for (let i = 0; i < 4; i++) {
            voices.bass.triggerAttackRelease(
              b.bass[i],
              '4n',
              now + i * SEC_PER_BEAT,
              0.7,
            )
            // hi-hat — на каждой доле
            voices.hat.triggerAttackRelease(
              '32n',
              now + i * SEC_PER_BEAT,
              0.5,
            )
            // swing off-beat hi-hat
            voices.hat.triggerAttackRelease(
              '32n',
              now + swingOff(i),
              0.35,
            )
          }
          bar++
          timers.pushTimeout(playBar, SEC_PER_BEAT * 4 * 1000)
        }
        playBar()
      })

      // ─── Section II (27+) — Theme: + piano comping + brass melody + kick ───
      scheduleAt(27, () => {
        let cBar = 0
        const playComp = (): void => {
          if (!ctx.isPlaying() || !voices) return
          const b = WALKING_BARS[cBar % WALKING_BARS.length]
          const now = Tone.now()
          // Piano на 2 и 4 долях (jazz comping)
          voices.piano.triggerAttackRelease(
            b.chord,
            '8n',
            now + SEC_PER_BEAT,
            0.5,
          )
          voices.piano.triggerAttackRelease(
            b.chord,
            '8n',
            now + SEC_PER_BEAT * 3,
            0.45,
          )
          // Kick на 1 и 3
          voices.kick.triggerAttackRelease('A1', '8n', now, 0.85)
          voices.kick.triggerAttackRelease(
            'A1',
            '8n',
            now + SEC_PER_BEAT * 2,
            0.7,
          )
          cBar++
          timers.pushTimeout(playComp, SEC_PER_BEAT * 4 * 1000)
        }
        playComp()

        // Brass melody — pentatonic A minor over progression
        const melody = [
          'A4', 'C5', 'E5', 'D5',
          'C5', 'A4', 'G4', 'E4',
          'F4', 'A4', 'C5', 'D5',
          'B4', 'A4', 'E4', 'A3',
        ]
        let mIdx = 0
        const playBrass = (): void => {
          if (!ctx.isPlaying() || !voices) return
          const note = melody[mIdx % melody.length]
          voices.brass.triggerAttackRelease(note, '8n', Tone.now(), 0.6)
          mIdx++
          // swing — иногда длиннее иногда короче
          const swingDur = (mIdx % 2 === 0 ? 0.66 : 0.34) * SEC_PER_BEAT * 2
          timers.pushTimeout(playBrass, swingDur * 1000)
        }
        playBrass()
      })

      // ─── Section III (54+) — Scat: walking bass + ribbit «scat» вместо brass ───
      scheduleAt(54, () => {
        const ribbitFreqs = [320, 480, 380, 560, 280, 420, 600, 360]
        let rIdx = 0
        const playScat = (): void => {
          if (!ctx.isPlaying() || !voices) return
          voices.ribbitFilter.frequency.value =
            ribbitFreqs[rIdx % ribbitFreqs.length]
          const now = Tone.now()
          // «doo-doo-ba» паттерн: 2-3 быстрых kvak
          voices.ribbitNoise.triggerAttackRelease('16n', now, 0.7)
          voices.ribbitNoise.triggerAttackRelease(
            '16n',
            now + 0.12,
            0.65,
          )
          if (rIdx % 3 === 0) {
            voices.ribbitNoise.triggerAttackRelease(
              '16n',
              now + 0.26,
              0.55,
            )
          }
          rIdx++
          // ритм scat'а — swing-фил
          const wait = (rIdx % 2 === 0 ? 0.5 : 0.34) * SEC_PER_BEAT * 2 * 1000
          timers.pushTimeout(playScat, wait)
        }
        playScat()
      })

      // ─── Section IV (81+) — Outro: theme затихает, остаются bass + piano ───
      scheduleAt(81, () => {
        // brass volume плавно вниз
        if (voices) voices.brass.volume.rampTo(-30, 4)

        let oBar = 0
        const playOutro = (): void => {
          if (!ctx.isPlaying() || !voices) return
          const b = WALKING_BARS[oBar % WALKING_BARS.length]
          const now = Tone.now()
          // Долгий piano пад на каждый такт
          voices.piano.triggerAttackRelease(
            b.chord,
            '2n',
            now,
            0.4,
          )
          oBar++
          timers.pushTimeout(playOutro, SEC_PER_BEAT * 4 * 1000)
        }
        playOutro()
      })
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
  }
}

export default create
