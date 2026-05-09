import type * as ToneNS from 'tone'
import type { CreateTrack, TrackInstance } from '../types'
import { TRACK_META } from './index'
import { NodeBag, TimerBag, transpose } from './_helpers'

const SECTIONS = TRACK_META.stellarTide.sections
const TOTAL_SEC = TRACK_META.stellarTide.totalSec

const MOTIF_BASE = ['F#4', 'A4', 'C#5', 'E5', 'C#5']

function getMotifFor(section: number): string[] {
  if (section === 0) return MOTIF_BASE
  if (section === 1) return MOTIF_BASE.map((n) => transpose(n, -5))
  if (section === 2) return MOTIF_BASE.map((n) => transpose(n, 3))
  return MOTIF_BASE
}

function getDroneFor(section: number): [string, string] {
  const map: Record<number, [string, string]> = {
    0: ['F#2', 'C#3'],
    1: ['C#2', 'G#2'],
    2: ['A2', 'E3'],
    3: ['F#2', 'C#3'],
  }
  return map[section]
}

interface Voices {
  drone1: ToneNS.Oscillator
  drone2: ToneNS.Oscillator
  pulse: ToneNS.Synth
  bell: ToneNS.Synth
  melody: ToneNS.PolySynth
  pad: ToneNS.PolySynth
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
    meta: TRACK_META.stellarTide,

    async build(Tone, outNode) {
      const masterRev = nodes.add(
        new Tone.Reverb({ decay: 8, wet: 0.5 }).connect(outNode),
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
        new Tone.Filter(800, 'lowpass').connect(droneRev),
      )
      const drone1 = nodes.add(
        new Tone.Oscillator({
          type: 'sine',
          frequency: 'F#2',
          volume: -22,
        }).connect(droneFilter),
      )
      const drone2 = nodes.add(
        new Tone.Oscillator({
          type: 'sine',
          frequency: 'C#3',
          volume: -26,
        }).connect(droneFilter),
      )
      drone1.start()
      drone2.start()

      const pulseRev = nodes.add(
        new Tone.Reverb({ decay: 8, wet: 0.85 }).connect(masterRev),
      )
      await pulseRev.generate()
      const pulseFilter = nodes.add(
        new Tone.Filter(1200, 'lowpass').connect(pulseRev),
      )
      const pulse = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 1.2, decay: 0.5, sustain: 0.6, release: 2.5 },
        }).connect(pulseFilter),
      )
      pulse.volume.value = -18

      const bellRev = nodes.add(
        new Tone.Reverb({ decay: 10, wet: 0.85 }).connect(masterRev),
      )
      await bellRev.generate()
      const bellEcho = nodes.add(
        new Tone.FeedbackDelay('4n.', 0.4).connect(bellRev),
      )
      bellEcho.wet.value = 0.4
      const bell = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.6, sustain: 0.2, release: 3 },
        }).connect(bellEcho),
      )
      bell.volume.value = -22

      const melRev = nodes.add(
        new Tone.Reverb({ decay: 6, wet: 0.65 }).connect(masterRev),
      )
      await melRev.generate()
      const melEcho = nodes.add(
        new Tone.FeedbackDelay('4n', 0.3).connect(melRev),
      )
      melEcho.wet.value = 0.25
      const melody = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.3, decay: 0.4, sustain: 0.5, release: 2 },
        }).connect(melEcho),
      )
      melody.volume.value = -16

      const padRev = nodes.add(
        new Tone.Reverb({ decay: 12, wet: 0.9 }).connect(masterRev),
      )
      await padRev.generate()
      const pad = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 2.5, decay: 1, sustain: 0.6, release: 4 },
        }).connect(padRev),
      )
      pad.volume.value = -26

      voices = { drone1, drone2, pulse, bell, melody, pad }
    },

    startScheduler(fromSec, ctx) {
      if (!voices) return
      timers.clearAll()
      let curSec = findSection(fromSec)

      const updateDrone = (sectionIdx: number): void => {
        if (!voices) return
        const [tonic, fifth] = getDroneFor(sectionIdx)
        voices.drone1.frequency.rampTo(tonic, 5)
        voices.drone2.frequency.rampTo(fifth, 5)
      }
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
          const [tonic] = getDroneFor(curSec)
          voices.bell.triggerAttackRelease(
            transpose(tonic, 24),
            '1n',
            Tone.now(),
            0.4,
          )
        }
        if (now >= TOTAL_SEC) {
          // Loop is handled by the player; just refresh section
          curSec = 0
          updateDrone(0)
          ctx.onSectionChange(0)
        }
        timers.pushTimeout(tick, 100)
      }
      tick()

      const pulseLoop = (): void => {
        if (!ctx.isPlaying() || !voices) return
        const sIdx = findSection(ctx.getElapsed())
        const [tonic] = getDroneFor(sIdx)
        const pulseNote = transpose(tonic, 12)
        voices.pulse.triggerAttackRelease(pulseNote, '2n', Tone.now(), 0.5)
        timers.pushTimeout(pulseLoop, 4000)
      }
      timers.pushTimeout(pulseLoop, 500)

      const bellLoop = (): void => {
        if (!ctx.isPlaying() || !voices) return
        const sIdx = findSection(ctx.getElapsed())
        const [tonic, fifth] = getDroneFor(sIdx)
        const choices = [
          transpose(tonic, 24),
          transpose(fifth, 12),
          transpose(tonic, 27),
          transpose(tonic, 19),
        ]
        const note = choices[Math.floor(Math.random() * choices.length)]
        voices.bell.triggerAttackRelease(note, '2n', Tone.now(), 0.3)
        timers.pushTimeout(bellLoop, 6000 + Math.random() * 3000)
      }
      timers.pushTimeout(bellLoop, 3000)

      const melodyLoop = (): void => {
        if (!ctx.isPlaying() || !voices) return
        const sIdx = findSection(ctx.getElapsed())
        const motif = getMotifFor(sIdx)
        const t0 = Tone.now() + 0.1
        const noteInterval = 1.2

        motif.forEach((note, i) => {
          voices!.melody.triggerAttackRelease(
            note,
            '2n',
            t0 + i * noteInterval,
            0.45,
          )
        })

        if (sIdx >= 1) {
          motif.forEach((note, i) => {
            const lowOct = transpose(note, -12)
            voices!.melody.triggerAttackRelease(
              lowOct,
              '2n',
              t0 + i * noteInterval + noteInterval * 0.5,
              0.25,
            )
          })
        }

        if (sIdx >= 2) {
          const root = motif[0]
          const third = transpose(root, sIdx === 2 ? 4 : 3)
          const fifth = transpose(root, 7)
          voices.pad.triggerAttackRelease([root, third, fifth], '1n', t0, 0.4)
        }

        const totalDur = motif.length * noteInterval + 4
        timers.pushTimeout(melodyLoop, totalDur * 1000)
      }
      timers.pushTimeout(melodyLoop, 1500)
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
