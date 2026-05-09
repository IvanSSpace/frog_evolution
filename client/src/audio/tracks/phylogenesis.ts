import type * as ToneNS from 'tone'
import type { CreateTrack, TrackInstance } from '../types'
import { TRACK_META } from './index'
import { NodeBag, TimerBag, transpose } from './_helpers'

const SECTIONS = TRACK_META.phylogenesis.sections
const TOTAL_SEC = TRACK_META.phylogenesis.totalSec

const NOTE_VALUES: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
}
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const MOTIF_C = ['C4', 'Eb4', 'G4', 'F4', 'D4']

function transposeMotif(semis: number): string[] {
  return MOTIF_C.map((n) => transpose(n, semis))
}

function getMotifFor(section: number): string[] {
  if (section === 0) return transposeMotif(-3)
  if (section === 1) return transposeMotif(2)
  if (section === 2) {
    return MOTIF_C.map((n) => {
      const m = n.match(/^([A-G][#b]?)(-?\d+)$/)!
      const pc = NOTE_VALUES[m[1]]
      const oct = parseInt(m[2], 10)
      const total = pc + oct * 12
      const refMidi = NOTE_VALUES['C'] + 4 * 12
      const mirrored = 2 * refMidi - total
      return NAMES[((mirrored % 12) + 12) % 12] + Math.floor(mirrored / 12)
    })
  }
  return transposeMotif(-3)
}

const PHASE_SEC = 60 / 16
const NOTE_INTERVAL = 0.75

interface Voices {
  drone1: ToneNS.Oscillator
  drone2: ToneNS.Oscillator
  piano: ToneNS.PolySynth
  counter: ToneNS.Synth
  pad: ToneNS.PolySynth
  bell: ToneNS.Synth
}

const create: CreateTrack = (Tone): TrackInstance => {
  const nodes = new NodeBag()
  const timers = new TimerBag()
  let analyser: ToneNS.Analyser | null = null
  let voices: Voices | null = null

  function findSection(elapsed: number): number {
    const s = SECTIONS.findIndex((sec) => elapsed < sec.start + 60)
    return s < 0 ? 3 : s
  }

  return {
    meta: TRACK_META.phylogenesis,

    async build(Tone, outNode) {
      const masterRev = nodes.add(
        new Tone.Reverb({ decay: 6, wet: 0.45 }).connect(outNode),
      )
      await masterRev.generate()

      analyser = new Tone.Analyser('waveform', 1024)
      masterRev.connect(analyser)
      nodes.add(analyser)

      const droneRev = nodes.add(
        new Tone.Reverb({ decay: 10, wet: 0.7 }).connect(masterRev),
      )
      await droneRev.generate()
      const droneFilter = nodes.add(
        new Tone.Filter(500, 'lowpass').connect(droneRev),
      )
      const drone1 = nodes.add(
        new Tone.Oscillator({
          type: 'sine',
          frequency: 'A1',
          volume: -22,
        }).connect(droneFilter),
      )
      const drone2 = nodes.add(
        new Tone.Oscillator({
          type: 'sine',
          frequency: 'E2',
          volume: -28,
        }).connect(droneFilter),
      )
      drone1.start()
      drone2.start()

      const pianoRev = nodes.add(
        new Tone.Reverb({ decay: 5, wet: 0.55 }).connect(masterRev),
      )
      await pianoRev.generate()
      const pianoEcho = nodes.add(
        new Tone.FeedbackDelay('4n', 0.25).connect(pianoRev),
      )
      pianoEcho.wet.value = 0.2
      const piano = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.04, decay: 0.4, sustain: 0.3, release: 1.5 },
        }).connect(pianoEcho),
      )
      piano.volume.value = -14

      const counterRev = nodes.add(
        new Tone.Reverb({ decay: 6, wet: 0.7 }).connect(masterRev),
      )
      await counterRev.generate()
      const counter = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 1.8 },
        }).connect(counterRev),
      )
      counter.volume.value = -20

      const padRev = nodes.add(
        new Tone.Reverb({ decay: 8, wet: 0.85 }).connect(masterRev),
      )
      await padRev.generate()
      const pad = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 1.5, decay: 0.5, sustain: 0.6, release: 2.5 },
        }).connect(padRev),
      )
      pad.volume.value = -22

      const bell = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 3 },
        }).connect(padRev),
      )
      bell.volume.value = -18

      voices = { drone1, drone2, piano, counter, pad, bell }
    },

    startScheduler(fromSec, ctx) {
      if (!voices) return
      timers.clearAll()

      const updateDrone = (sectionIdx: number): void => {
        if (!voices) return
        const tonics: Record<string, string> = { A: 'A1', D: 'D2', C: 'C2' }
        const fifths: Record<string, string> = { A: 'E2', D: 'A2', C: 'G2' }
        const sec = SECTIONS[sectionIdx]
        const tonic = sec.key.split(' ')[0]
        voices.drone1.frequency.rampTo(tonics[tonic] ?? 'A1', 4)
        voices.drone2.frequency.rampTo(fifths[tonic] ?? 'E2', 4)
      }

      let curSec = findSection(fromSec)
      updateDrone(curSec)
      ctx.onSectionChange(curSec)

      const tick = (): void => {
        if (!ctx.isPlaying() || !voices) return
        const now = ctx.getElapsed()
        const actual = findSection(now)
        if (actual !== curSec) {
          curSec = actual
          updateDrone(curSec)
          ctx.onSectionChange(curSec)
          const tonic = SECTIONS[curSec].key.split(' ')[0]
          voices.bell.triggerAttackRelease(tonic + '5', '4n', Tone.now(), 0.4)
        }
        if (now >= TOTAL_SEC) {
          curSec = 0
          updateDrone(0)
          ctx.onSectionChange(0)
        }
        timers.pushTimeout(tick, 100)
      }
      tick()

      const playMotif = (): void => {
        if (!ctx.isPlaying() || !voices) return
        const sIdx = findSection(ctx.getElapsed())
        const motif = getMotifFor(sIdx)
        const t0 = Tone.now() + 0.05

        motif.forEach((note, i) => {
          voices!.piano.triggerAttackRelease(
            note,
            '2n',
            t0 + i * NOTE_INTERVAL,
            0.6,
          )
        })

        if (sIdx >= 1) {
          motif.forEach((note, i) => {
            const offsetNote = transpose(note, 12)
            voices!.counter.triggerAttackRelease(
              offsetNote,
              '4n',
              t0 + i * NOTE_INTERVAL + NOTE_INTERVAL * 1.5,
              0.4,
            )
          })
        }

        if (sIdx >= 2) {
          const root = motif[0]
          const fifth = transpose(root, 7)
          voices.pad.triggerAttackRelease([root, fifth], '1n', t0, 0.35)
        }

        if (sIdx >= 3) {
          const motifLow = motif.map((n) => transpose(n, -12))
          motifLow.forEach((note, i) => {
            if (i % 2 === 0) {
              voices!.piano.triggerAttackRelease(
                note,
                '2n',
                t0 + i * NOTE_INTERVAL + NOTE_INTERVAL * 0.5,
                0.35,
              )
            }
          })
        }

        const totalDur = motif.length * NOTE_INTERVAL + 1.0
        timers.pushTimeout(playMotif, totalDur * 1000)
      }
      timers.pushTimeout(playMotif, 200)
      void PHASE_SEC // intentionally unused, kept as documentation
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
