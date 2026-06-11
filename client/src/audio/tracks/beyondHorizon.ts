import type * as ToneNS from 'tone'
import type { CreateTrack, TrackInstance } from '../types'
import { TRACK_META } from './index'
import { NodeBag, TimerBag, transpose, Mixer } from './_helpers'

const SECTIONS = TRACK_META.beyondHorizon.sections

interface SectionData {
  pedal: [string, string]
  arpeggio: string[]
  theme: string[]
  chord: string[]
  arpDensity: 0 | 1 | 2
  bassNote: string
}

const SECTION_DATA: Record<number, SectionData> = {
  0: {
    pedal: ['C2', 'G2'],
    arpeggio: ['C4', 'E4', 'G4', 'C5', 'G4', 'E4'],
    theme: ['G5', 'C6', 'E6', 'C6'],
    chord: ['C3', 'E3', 'G3'],
    arpDensity: 1,
    bassNote: 'C2',
  },
  1: {
    pedal: ['F1', 'C2'],
    arpeggio: ['F4', 'A4', 'C5', 'F5', 'C5', 'A4'],
    theme: ['C5', 'F5', 'A5', 'F5', 'C6'],
    chord: ['F3', 'A3', 'C4'],
    arpDensity: 1,
    bassNote: 'F1',
  },
  2: {
    pedal: ['D2', 'A2'],
    arpeggio: ['D4', 'F4', 'A4', 'D5', 'A4', 'F4'],
    theme: ['A4', 'D5', 'F5', 'D5', 'A4'],
    chord: ['D3', 'F3', 'A3'],
    arpDensity: 1,
    bassNote: 'D2',
  },
  3: {
    pedal: ['Bb1', 'F2'],
    arpeggio: ['Bb4', 'D5', 'F5', 'Bb5', 'F5', 'D5'],
    theme: ['F5', 'Bb5', 'D6', 'Bb5', 'F6', 'D6'],
    chord: ['Bb2', 'D3', 'F3', 'Bb3'],
    arpDensity: 2,
    bassNote: 'Bb1',
  },
  4: {
    pedal: ['A1', 'E2'],
    arpeggio: ['A4', 'C5', 'E5', 'A5', 'E5', 'C5'],
    theme: ['E5', 'A5', 'C6', 'B5', 'A5'],
    chord: ['A3', 'C4', 'E4'],
    arpDensity: 0,
    bassNote: 'A1',
  },
  5: {
    pedal: ['F1', 'C2'],
    arpeggio: ['F4', 'A4', 'C5', 'F5', 'C5', 'A4'],
    theme: ['F5', 'A5', 'C6', 'A5', 'F5'],
    chord: ['F3', 'A3', 'C4', 'F4'],
    arpDensity: 1,
    bassNote: 'F1',
  },
  6: {
    pedal: ['C2', 'G2'],
    arpeggio: ['C4', 'E4', 'G4', 'C5', 'G4', 'E4'],
    theme: ['G5', 'C6', 'E6', 'G6', 'E6', 'C6'],
    chord: ['C3', 'E3', 'G3', 'C4'],
    arpDensity: 1,
    bassNote: 'C2',
  },
}

interface Voices {
  pedal1: ToneNS.Oscillator
  pedal2: ToneNS.Oscillator
  pedal3: ToneNS.Oscillator
  pedal4: ToneNS.Oscillator
  piano: ToneNS.PolySynth
  theme: ToneNS.PolySynth
  themeHigh: ToneNS.PolySynth
  strings: ToneNS.PolySynth
  bass: ToneNS.MembraneSynth
}

const create: CreateTrack = (Tone): TrackInstance => {
  const nodes = new NodeBag()
  const timers = new TimerBag()
  const mixer = new Mixer()
  let analyser: ToneNS.Analyser | null = null
  let voices: Voices | null = null

  function findSection(elapsed: number): number {
    const s = SECTIONS.findIndex((sec) => elapsed < sec.start + 60)
    return s < 0 ? SECTIONS.length - 1 : s
  }

  return {
    meta: TRACK_META.beyondHorizon,

    async build(Tone, outNode) {
      const masterRev = nodes.add(
        new Tone.Reverb({ decay: 7, wet: 0.4 }).connect(outNode),
      )
      await masterRev.generate()

      analyser = new Tone.Analyser('waveform', 1024)
      masterRev.connect(analyser)
      nodes.add(analyser)

      // ─── ORGAN PEDAL ───
      const pedalRev = nodes.add(
        new Tone.Reverb({ decay: 9, wet: 0.6 }).connect(masterRev),
      )
      await pedalRev.generate()
      const pedalFilter = nodes.add(
        new Tone.Filter(1000, 'lowpass').connect(pedalRev),
      )
      const pedal1 = nodes.add(
        new Tone.Oscillator({
          type: 'sine',
          frequency: 'C2',
          volume: -18,
        }).connect(pedalFilter),
      )
      const pedal2 = nodes.add(
        new Tone.Oscillator({
          type: 'sine',
          frequency: 'C3',
          volume: -23,
        }).connect(pedalFilter),
      )
      const pedal3 = nodes.add(
        new Tone.Oscillator({
          type: 'sine',
          frequency: 'G3',
          volume: -28,
        }).connect(pedalFilter),
      )
      const pedal4 = nodes.add(
        new Tone.Oscillator({
          type: 'triangle',
          frequency: 'C2',
          volume: -28,
          detune: 4,
        }).connect(pedalFilter),
      )
      pedal1.start()
      pedal2.start()
      pedal3.start()
      pedal4.start()

      // ─── PIANO (arpeggio) ───
      const pianoRev = nodes.add(
        new Tone.Reverb({ decay: 4, wet: 0.45 }).connect(masterRev),
      )
      await pianoRev.generate()
      const pianoEcho = nodes.add(
        new Tone.FeedbackDelay('8n', 0.2).connect(pianoRev),
      )
      pianoEcho.wet.value = 0.15
      const piano = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.4 },
        }).connect(pianoEcho),
      )
      piano.volume.value = -16

      // ─── THEME (organ-choir) ───
      const themeRev = nodes.add(
        new Tone.Reverb({ decay: 8, wet: 0.7 }).connect(masterRev),
      )
      await themeRev.generate()
      const themeChorus = nodes.add(
        new Tone.Chorus({ frequency: 0.4, delayTime: 6, depth: 0.4 })
          .connect(themeRev)
          .start(),
      )
      themeChorus.wet.value = 0.3
      const theme = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 3 },
        }).connect(themeChorus),
      )
      theme.volume.value = -14

      const themeHigh = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 1.2, decay: 0.5, sustain: 0.5, release: 3 },
        }).connect(themeRev),
      )
      themeHigh.volume.value = -24

      // ─── STRINGS ───
      const stringsRev = nodes.add(
        new Tone.Reverb({ decay: 10, wet: 0.85 }).connect(masterRev),
      )
      await stringsRev.generate()
      const stringsFilter = nodes.add(
        new Tone.Filter(1500, 'lowpass').connect(stringsRev),
      )
      const strings = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 3, decay: 1, sustain: 0.7, release: 4 },
        }).connect(stringsFilter),
      )
      strings.volume.value = -28

      // ─── BASS PULSE ───
      const bassRev = nodes.add(
        new Tone.Reverb({ decay: 5, wet: 0.4 }).connect(masterRev),
      )
      await bassRev.generate()
      const bassFilter = nodes.add(
        new Tone.Filter(150, 'lowpass').connect(bassRev),
      )
      const bass = nodes.add(
        new Tone.MembraneSynth({
          pitchDecay: 0.4,
          octaves: 5,
          envelope: { attack: 0.005, decay: 0.6, sustain: 0, release: 0.3 },
        }).connect(bassFilter),
      )
      bass.volume.value = -10

      voices = {
        pedal1,
        pedal2,
        pedal3,
        pedal4,
        piano,
        theme,
        themeHigh,
        strings,
        bass,
      }

      mixer.add('pedal1', 'Пэд 1', pedal1)
      mixer.add('pedal2', 'Пэд 2', pedal2)
      mixer.add('pedal3', 'Пэд 3', pedal3)
      mixer.add('pedal4', 'Пэд 4', pedal4)
      mixer.add('piano', 'Пиано', piano)
      mixer.add('theme', 'Тема', theme)
      mixer.add('themeHigh', 'Тема (выс.)', themeHigh)
      mixer.add('strings', 'Струнные', strings)
      mixer.add('bass', 'Бас', bass)
    },

    startScheduler(fromSec, ctx) {
      if (!voices) return
      timers.clearAll()
      let curSec = findSection(fromSec)

      const updatePedal = (idx: number): void => {
        if (!voices) return
        const data = SECTION_DATA[idx]
        const [low, high] = data.pedal
        voices.pedal1.frequency.rampTo(low, 6)
        voices.pedal2.frequency.rampTo(transpose(low, 12), 6)
        voices.pedal3.frequency.rampTo(high, 6)
        voices.pedal4.frequency.rampTo(low, 6)
      }
      updatePedal(curSec)
      ctx.onSectionChange(curSec)

      const tick = (): void => {
        if (!ctx.isPlaying()) return
        const now = ctx.getElapsed()
        const actual = findSection(now)
        if (actual !== curSec) {
          curSec = actual
          updatePedal(curSec)
          ctx.onSectionChange(curSec)
        }
        timers.pushTimeout(tick, 100)
      }
      tick()

      const arpeggio = (): void => {
        if (!ctx.isPlaying() || !voices) return
        const sIdx = findSection(ctx.getElapsed())
        const data = SECTION_DATA[sIdx]
        if (data.arpDensity > 0) {
          const arp = data.arpeggio
          const t0 = Tone.now() + 0.05
          const stepTime = data.arpDensity === 2 ? 0.125 : 0.25
          const repeats = data.arpDensity === 2 ? 4 : 2
          for (let r = 0; r < repeats; r++) {
            arp.forEach((note, i) => {
              const vel = 0.35 + Math.random() * 0.2
              voices!.piano.triggerAttackRelease(
                note,
                '16n',
                t0 + (r * arp.length + i) * stepTime,
                vel,
              )
            })
          }
          if (data.arpDensity === 2) {
            for (let r = 0; r < repeats; r++) {
              arp.forEach((note, i) => {
                voices!.piano.triggerAttackRelease(
                  transpose(note, 12),
                  '16n',
                  t0 + (r * arp.length + i) * stepTime + 0.0625,
                  0.25,
                )
              })
            }
          }
        }
        timers.pushTimeout(arpeggio, data.arpDensity === 2 ? 2000 : 3000)
      }
      timers.pushTimeout(arpeggio, 100)

      const playTheme = (): void => {
        if (!ctx.isPlaying() || !voices) return
        const sIdx = findSection(ctx.getElapsed())
        const data = SECTION_DATA[sIdx]
        const themeNotes = data.theme
        const t0 = Tone.now() + 0.1
        let noteDur = 3.5
        let velocity = 0.55
        if (sIdx === 3) {
          noteDur = 3.0
          velocity = 0.75
        }
        if (sIdx === 4) {
          noteDur = 5.0
          velocity = 0.4
        }
        if (sIdx === 2) {
          velocity = 0.45
        }
        if (sIdx === 6) {
          velocity = 0.6
        }
        themeNotes.forEach((note, i) => {
          voices!.theme.triggerAttackRelease(
            note,
            noteDur,
            t0 + i * noteDur * 0.9,
            velocity,
          )
          if (sIdx === 1 || sIdx === 3 || sIdx >= 5) {
            const shimVel = sIdx === 3 ? 0.35 : 0.22
            voices!.themeHigh.triggerAttackRelease(
              transpose(note, 12),
              noteDur,
              t0 + i * noteDur * 0.9 + 0.3,
              shimVel,
            )
          }
        })
        const themeDur = themeNotes.length * noteDur * 0.9 + 4
        timers.pushTimeout(playTheme, themeDur * 1000)
      }
      timers.pushTimeout(playTheme, 2000)

      const stringsSwell = (): void => {
        if (!ctx.isPlaying() || !voices) return
        const sIdx = findSection(ctx.getElapsed())
        const stringsActive = [false, true, false, true, true, true, true]
        if (stringsActive[sIdx]) {
          const data = SECTION_DATA[sIdx]
          let stringsVel = 0.5
          if (sIdx === 3) stringsVel = 0.85
          if (sIdx === 4) stringsVel = 0.4
          voices.strings.triggerAttackRelease(
            data.chord,
            '1n',
            Tone.now(),
            stringsVel,
          )
        }
        timers.pushTimeout(stringsSwell, 12000)
      }
      timers.pushTimeout(stringsSwell, 6000)

      const bassPulse = (): void => {
        if (!ctx.isPlaying() || !voices) return
        const sIdx = findSection(ctx.getElapsed())
        if (sIdx === 3) {
          const data = SECTION_DATA[sIdx]
          const t = Tone.now()
          voices.bass.triggerAttackRelease(data.bassNote, '4n', t, 0.9)
          voices.bass.triggerAttackRelease(data.bassNote, '4n', t + 1.5, 0.6)
        }
        timers.pushTimeout(bassPulse, 3000)
      }
      timers.pushTimeout(bassPulse, 1000)
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
