import type * as ToneNS from 'tone'
import type { CreateTrack, TrackInstance } from '../types'
import { TRACK_META } from './index'
import { NodeBag, TimerBag } from './_helpers'

const SECTIONS = TRACK_META.leviathanLullaby.sections
const TOTAL_SEC = TRACK_META.leviathanLullaby.totalSec

const DRONE_TONES: Array<[string, string, string, string]> = [
  ['A1', 'A1', 'A0', 'E2'],
  ['E1', 'E1', 'E0', 'B1'],
  ['F1', 'F1', 'F0', 'C2'],
  ['A1', 'A1', 'A0', 'E2'],
]

interface Voices {
  droneOsc1: ToneNS.Oscillator
  droneOsc2: ToneNS.Oscillator
  droneOsc3: ToneNS.Oscillator
  droneOsc4: ToneNS.Oscillator
  pulseKick: ToneNS.MembraneSynth
  dropSynth: ToneNS.Synth
  whaleSynth: ToneNS.Synth
  whaleFilter: ToneNS.Filter
  melSynth: ToneNS.PolySynth
  choir: ToneNS.PolySynth
  bell: ToneNS.Synth
  noise: ToneNS.NoiseSynth
}

const create: CreateTrack = (Tone): TrackInstance => {
  const nodes = new NodeBag()
  const timers = new TimerBag()
  let analyser: ToneNS.Analyser | null = null
  let voices: Voices | null = null
  let currentMvmt = -1

  function findSection(elapsed: number): number {
    const e = elapsed % TOTAL_SEC
    const s = SECTIONS.findIndex((sec) => e < sec.start + 60)
    return s < 0 ? 3 : s
  }

  return {
    meta: TRACK_META.leviathanLullaby,

    async build(Tone, outNode) {
      const masterRev = nodes.add(
        new Tone.Reverb({ decay: 10, wet: 0.55 }).connect(outNode),
      )
      await masterRev.generate()

      analyser = new Tone.Analyser('waveform', 1024)
      masterRev.connect(analyser)
      nodes.add(analyser)

      // Drone
      const droneRev = nodes.add(
        new Tone.Reverb({ decay: 14, wet: 0.85 }).connect(masterRev),
      )
      await droneRev.generate()
      const droneChorus = nodes.add(
        new Tone.Chorus({ frequency: 0.2, delayTime: 12, depth: 0.8 })
          .connect(droneRev)
          .start(),
      )
      const droneOsc1 = nodes.add(
        new Tone.Oscillator({
          type: 'sawtooth',
          frequency: 'A1',
          volume: -22,
        }).connect(droneChorus),
      )
      const droneOsc2 = nodes.add(
        new Tone.Oscillator({
          type: 'sawtooth',
          frequency: 'A1',
          detune: 7,
          volume: -25,
        }).connect(droneChorus),
      )
      const droneOsc3 = nodes.add(
        new Tone.Oscillator({
          type: 'sine',
          frequency: 'A0',
          volume: -16,
        }).connect(droneChorus),
      )
      const droneOsc4 = nodes.add(
        new Tone.Oscillator({
          type: 'triangle',
          frequency: 'E2',
          volume: -28,
          detune: -5,
        }).connect(droneChorus),
      )
      droneOsc1.start()
      droneOsc2.start()
      droneOsc3.start()
      droneOsc4.start()

      // Mvmt 1 — Descent
      const pulseFilter = nodes.add(
        new Tone.Filter(75, 'lowpass').connect(masterRev),
      )
      const pulseRev = nodes.add(
        new Tone.Reverb({ decay: 8, wet: 0.7 }).connect(pulseFilter),
      )
      await pulseRev.generate()
      const pulseKick = nodes.add(
        new Tone.MembraneSynth({
          pitchDecay: 0.5,
          octaves: 6,
          envelope: { attack: 0.001, decay: 0.8, sustain: 0, release: 0.3 },
        }).connect(pulseRev),
      )
      pulseKick.volume.value = -10

      const dropRev = nodes.add(
        new Tone.Reverb({ decay: 9, wet: 0.85 }).connect(masterRev),
      )
      await dropRev.generate()
      const dropEcho = nodes.add(
        new Tone.FeedbackDelay('2n', 0.5).connect(dropRev),
      )
      dropEcho.wet.value = 0.4
      const dropSynth = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.5, decay: 0.4, sustain: 0.3, release: 2.5 },
        }).connect(dropEcho),
      )
      dropSynth.volume.value = -18

      // Mvmt 2 — Awakening (whale)
      const whaleRev = nodes.add(
        new Tone.Reverb({ decay: 12, wet: 0.92 }).connect(masterRev),
      )
      await whaleRev.generate()
      const whalePitch = nodes.add(
        new Tone.PitchShift({ pitch: -7, windowSize: 0.15 }).connect(whaleRev),
      )
      const whaleFilter = nodes.add(
        new Tone.Filter({ frequency: 600, type: 'lowpass', Q: 4 }).connect(
          whalePitch,
        ),
      )
      const whaleSynth = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.8, decay: 0.5, sustain: 0.6, release: 2.5 },
        }).connect(whaleFilter),
      )
      whaleSynth.volume.value = -16

      // Mvmt 3 — The Song (theme + choir)
      const melRev = nodes.add(
        new Tone.Reverb({ decay: 8, wet: 0.7 }).connect(masterRev),
      )
      await melRev.generate()
      const melEcho = nodes.add(
        new Tone.FeedbackDelay('4n.', 0.45).connect(melRev),
      )
      melEcho.wet.value = 0.4
      const melSynth = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.4, decay: 0.3, sustain: 0.7, release: 1.5 },
        }).connect(melEcho),
      )
      melSynth.volume.value = -14

      const choirRev = nodes.add(
        new Tone.Reverb({ decay: 11, wet: 0.88 }).connect(masterRev),
      )
      await choirRev.generate()
      const choir = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 1.5, decay: 0.5, sustain: 0.7, release: 3 },
        }).connect(choirRev),
      )
      choir.volume.value = -22

      // Mvmt 4 — Drifting (bell + noise)
      const bellRev = nodes.add(
        new Tone.Reverb({ decay: 12, wet: 0.92 }).connect(masterRev),
      )
      await bellRev.generate()
      const bellEcho = nodes.add(
        new Tone.FeedbackDelay('2n', 0.55).connect(bellRev),
      )
      bellEcho.wet.value = 0.5
      const bell = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.05, decay: 0.4, sustain: 0.3, release: 4 },
        }).connect(bellEcho),
      )
      bell.volume.value = -18

      const noiseRev = nodes.add(
        new Tone.Reverb({ decay: 10, wet: 0.95 }).connect(masterRev),
      )
      await noiseRev.generate()
      const noiseFilter = nodes.add(
        new Tone.Filter(600, 'bandpass').connect(noiseRev),
      )
      const noise = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 2, decay: 1, sustain: 0.5, release: 4 },
        }).connect(noiseFilter),
      )
      noise.volume.value = -32

      voices = {
        droneOsc1,
        droneOsc2,
        droneOsc3,
        droneOsc4,
        pulseKick,
        dropSynth,
        whaleSynth,
        whaleFilter,
        melSynth,
        choir,
        bell,
        noise,
      }
    },

    startScheduler(fromSec, ctx) {
      if (!voices) return
      timers.clearAll()
      currentMvmt = findSection(fromSec)
      ctx.onSectionChange(currentMvmt)

      // Drone modulation cycle (every 60s, 4-step cycle)
      const droneStartIdx = Math.floor((fromSec % TOTAL_SEC) / 60)
      let droneIdx = droneStartIdx
      const applyDroneTones = (idx: number): void => {
        if (!voices) return
        const t = DRONE_TONES[idx % DRONE_TONES.length]
        voices.droneOsc1.frequency.rampTo(t[0], 8)
        voices.droneOsc2.frequency.rampTo(t[1], 8)
        voices.droneOsc3.frequency.rampTo(t[2], 8)
        voices.droneOsc4.frequency.rampTo(t[3], 8)
      }
      applyDroneTones(droneIdx)

      const droneCycle = setInterval(() => {
        droneIdx = (droneIdx + 1) % DRONE_TONES.length
        applyDroneTones(droneIdx)
      }, 60000)
      timers.add(droneCycle as unknown as ReturnType<typeof setTimeout>)

      // Section watcher (drives currentMvmt + onSection)
      const sectionTick = (): void => {
        if (!ctx.isPlaying()) return
        const sec = findSection(ctx.getElapsed())
        if (sec !== currentMvmt) {
          currentMvmt = sec
          ctx.onSectionChange(currentMvmt)
        }
        timers.pushTimeout(sectionTick, 200)
      }
      sectionTick()

      // ── Mvmt 1: heartbeat + drops (active when currentMvmt === 0) ──
      const heartbeat = (): void => {
        if (!ctx.isPlaying() || !voices) return
        if (currentMvmt === 0) {
          const now = Tone.now()
          voices.pulseKick.triggerAttackRelease('A0', '2n', now, 0.85)
          voices.pulseKick.triggerAttackRelease('A0', '2n', now + 0.5, 0.4)
        }
        timers.pushTimeout(heartbeat, 6000)
      }
      timers.pushTimeout(heartbeat, 4000)

      const descentNotes = ['E5', 'B4', 'G4', 'E4', 'B3', 'G3', 'E3']
      let dropIdx = 0
      const dropStep = (): void => {
        if (!ctx.isPlaying() || !voices) return
        if (currentMvmt === 0) {
          voices.dropSynth.triggerAttackRelease(
            descentNotes[dropIdx % descentNotes.length],
            '1n',
            Tone.now(),
            0.5,
          )
          dropIdx++
        }
        timers.pushTimeout(dropStep, 4500 + Math.random() * 2000)
      }
      timers.pushTimeout(dropStep, 8000)

      // ── Mvmt 2: whale ──
      const whaleNotes = ['A2', 'D3', 'F3', 'A2', 'C3', 'E3', 'G2']
      let wIdx = 0
      const whaleCall = (): void => {
        if (!ctx.isPlaying() || !voices) return
        if (currentMvmt === 1) {
          const now = Tone.now()
          const note = whaleNotes[wIdx % whaleNotes.length]
          voices.whaleSynth.triggerAttackRelease(note, '1n', now, 0.7)
          voices.whaleFilter.frequency.rampTo(900, 1.5)
          voices.whaleFilter.frequency.rampTo(400, 3)
          wIdx++
        }
        timers.pushTimeout(whaleCall, 5000 + Math.random() * 3000)
      }
      timers.pushTimeout(whaleCall, 100)

      // ── Mvmt 3: theme + choir ──
      const themePattern: Array<[string, number]> = [
        ['A4', 1.0],
        ['C5', 0.5],
        ['E5', 0.5],
        ['D5', 1.5],
        ['C5', 0.5],
        ['E5', 1.0],
        ['G5', 0.5],
        ['A5', 1.5],
        ['E5', 1.0],
        ['D5', 1.0],
        ['C5', 1.5],
        ['A4', 0.5],
        ['G4', 1.0],
        ['A4', 2.0],
      ]
      const playTheme = (): void => {
        if (!ctx.isPlaying() || !voices) return
        if (currentMvmt === 2) {
          let t = Tone.now() + 0.1
          themePattern.forEach(([n, dur]) => {
            voices!.melSynth.triggerAttackRelease(n, dur + 'n', t, 0.55)
            t += dur * (60 / 52)
          })
        }
        const totalDur = themePattern.reduce((s, [, d]) => s + d, 0) * (60 / 52)
        timers.pushTimeout(playTheme, totalDur * 1000 + 1000)
      }
      timers.pushTimeout(playTheme, 200)

      const chords: string[][] = [
        ['A2', 'C3', 'E3'],
        ['F2', 'A2', 'C3'],
        ['C3', 'E3', 'G3'],
        ['G2', 'B2', 'D3'],
        ['A2', 'C3', 'E3', 'G3'],
      ]
      let cIdx = 0
      const playChoir = (): void => {
        if (!ctx.isPlaying() || !voices) return
        if (currentMvmt === 2) {
          voices.choir.triggerAttackRelease(
            chords[cIdx % chords.length],
            '1n',
            Tone.now(),
            0.45,
          )
          cIdx++
        }
        timers.pushTimeout(playChoir, 6000)
      }
      timers.pushTimeout(playChoir, 400)

      // ── Mvmt 4: bell ascend + noise ──
      const ascendNotes = ['E3', 'G3', 'B3', 'E4', 'G4', 'B4', 'E5']
      let aIdx = 0
      const ascend = (): void => {
        if (!ctx.isPlaying() || !voices) return
        if (currentMvmt === 3) {
          voices.bell.triggerAttackRelease(
            ascendNotes[aIdx % ascendNotes.length],
            '1n',
            Tone.now(),
            0.45 - (aIdx % ascendNotes.length) * 0.04,
          )
          aIdx++
        }
        timers.pushTimeout(ascend, 5000 + Math.random() * 2500)
      }
      timers.pushTimeout(ascend, 200)

      const noiseStep = (): void => {
        if (!ctx.isPlaying() || !voices) return
        if (currentMvmt === 3) {
          voices.noise.triggerAttackRelease('1n', Tone.now(), 0.35)
        }
        timers.pushTimeout(noiseStep, 7000 + Math.random() * 3000)
      }
      timers.pushTimeout(noiseStep, 500)
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
