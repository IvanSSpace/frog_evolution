import type * as ToneNS from 'tone'
import type { CreateTrack, TrackInstance } from '../types'
import { TRACK_META } from './index'
import { NodeBag, TimerBag } from './_helpers'

const SECTIONS = TRACK_META.frogTomorrow.sections
const TOTAL_SEC = TRACK_META.frogTomorrow.totalSec

interface Voices {
  droneOsc1: ToneNS.Oscillator
  droneOsc2: ToneNS.Oscillator
  droneSub: ToneNS.Oscillator
  pulseKick: ToneNS.MembraneSynth
  frog: ToneNS.Synth
  memSynth: ToneNS.Synth
  noise: ToneNS.NoiseSynth
  choir: ToneNS.PolySynth
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
    meta: TRACK_META.frogTomorrow,

    async build(Tone, outNode) {
      const masterRev = nodes.add(
        new Tone.Reverb({ decay: 8, wet: 0.6 }).connect(outNode),
      )
      await masterRev.generate()

      analyser = new Tone.Analyser('waveform', 1024)
      masterRev.connect(analyser)
      nodes.add(analyser)

      // Drone
      const droneRev = nodes.add(
        new Tone.Reverb({ decay: 12, wet: 0.85 }).connect(masterRev),
      )
      await droneRev.generate()
      const droneFlanger = nodes.add(
        new Tone.Chorus({ frequency: 0.3, delayTime: 8, depth: 0.7 })
          .connect(droneRev)
          .start(),
      )
      const droneOsc1 = nodes.add(
        new Tone.Oscillator({
          type: 'sawtooth',
          frequency: 'C2',
          volume: -22,
        }).connect(droneFlanger),
      )
      const droneOsc2 = nodes.add(
        new Tone.Oscillator({
          type: 'sawtooth',
          frequency: 'C2',
          detune: 8,
          volume: -24,
        }).connect(droneFlanger),
      )
      const droneSub = nodes.add(
        new Tone.Oscillator({
          type: 'sine',
          frequency: 'C1',
          volume: -18,
        }).connect(droneFlanger),
      )
      droneOsc1.start()
      droneOsc2.start()
      droneSub.start()

      // Pulse
      const pulseFilter = nodes.add(
        new Tone.Filter(80, 'lowpass').connect(masterRev),
      )
      const pulseRev = nodes.add(
        new Tone.Reverb({ decay: 6, wet: 0.7 }).connect(pulseFilter),
      )
      await pulseRev.generate()
      const pulseKick = nodes.add(
        new Tone.MembraneSynth({
          pitchDecay: 0.4,
          octaves: 6,
          envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.2 },
        }).connect(pulseRev),
      )
      pulseKick.volume.value = -8

      // Frog signal
      const frogRev = nodes.add(
        new Tone.Reverb({ decay: 10, wet: 0.9 }).connect(masterRev),
      )
      await frogRev.generate()
      const frogPitch = nodes.add(
        new Tone.PitchShift({ pitch: -12, windowSize: 0.1 }).connect(frogRev),
      )
      const frog = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.2 },
        }).connect(frogPitch),
      )
      frog.volume.value = -14

      // Ancient memory
      const memRev = nodes.add(
        new Tone.Reverb({ decay: 7, wet: 0.75 }).connect(masterRev),
      )
      await memRev.generate()
      const memEcho = nodes.add(
        new Tone.FeedbackDelay('4n', 0.4).connect(memRev),
      )
      memEcho.wet.value = 0.4
      const memSynth = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.3, decay: 0.2, sustain: 0.6, release: 0.8 },
        }).connect(memEcho),
      )
      memSynth.volume.value = -16

      // Stellar noise
      const noiseRev = nodes.add(
        new Tone.Reverb({ decay: 8, wet: 0.95 }).connect(masterRev),
      )
      await noiseRev.generate()
      const noiseCrush = nodes.add(new Tone.BitCrusher(6).connect(noiseRev))
      const noiseFilter = nodes.add(
        new Tone.Filter(800, 'lowpass').connect(noiseCrush),
      )
      const noise = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.5, decay: 0.5, sustain: 0.5, release: 2 },
        }).connect(noiseFilter),
      )
      noise.volume.value = -28

      // Choir
      const choirRev = nodes.add(
        new Tone.Reverb({ decay: 10, wet: 0.88 }).connect(masterRev),
      )
      await choirRev.generate()
      const choirEcho = nodes.add(
        new Tone.FeedbackDelay('2n.', 0.5).connect(choirRev),
      )
      choirEcho.wet.value = 0.5
      const choir = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 1.5, decay: 0.5, sustain: 0.7, release: 3 },
        }).connect(choirEcho),
      )
      choir.volume.value = -20

      voices = {
        droneOsc1,
        droneOsc2,
        droneSub,
        pulseKick,
        frog,
        memSynth,
        noise,
        choir,
      }
    },

    startScheduler(fromSec, ctx) {
      if (!voices) return
      timers.clearAll()
      const startElapsed = fromSec
      ctx.onSectionChange(findSection(startElapsed))

      // Drone tone alternation
      let droneToggle = Math.floor(startElapsed / 8) % 2 === 1
      const applyDrone = (): void => {
        if (!voices) return
        const target = droneToggle ? ['G1', 'G2', 'G0'] : ['C2', 'C2', 'C1']
        voices.droneOsc1.frequency.rampTo(target[0], 4)
        voices.droneOsc2.frequency.rampTo(target[1], 4)
        voices.droneSub.frequency.rampTo(target[2], 4)
      }
      applyDrone()
      const droneInterval = setInterval(() => {
        droneToggle = !droneToggle
        applyDrone()
      }, 8000)
      timers.add(droneInterval as unknown as ReturnType<typeof setTimeout>)

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

      // Layer activations: scheduling each layer from its offset
      const scheduleAt = (offsetSec: number, action: () => void): void => {
        const delay = Math.max(0, (offsetSec - startElapsed) * 1000)
        timers.pushTimeout(action, delay)
      }

      // Pulse (2s+): every 8s, kicks at 0/3/4
      scheduleAt(2, () => {
        const playPulsePattern = (): void => {
          if (!ctx.isPlaying() || !voices) return
          const now = Tone.now()
          voices.pulseKick.triggerAttackRelease('C0', '2n', now, 0.9)
          voices.pulseKick.triggerAttackRelease('C0', '2n', now + 3, 0.4)
          voices.pulseKick.triggerAttackRelease('C0', '2n', now + 4, 0.7)
          timers.pushTimeout(playPulsePattern, 8000)
        }
        playPulsePattern()
      })

      // Frog signal (6s+): random sequence
      scheduleAt(6, () => {
        const frogNotes = ['C3', 'Eb3', 'G3', 'Bb2', 'C3', 'F2']
        const frogSleeps = [1.5, 2, 2.5, 1, 3]
        let frogIdx = 0
        const frogStep = (): void => {
          if (!ctx.isPlaying() || !voices) return
          const note = frogNotes[frogIdx % frogNotes.length]
          voices.frog.triggerAttackRelease(note, '2n', Tone.now(), 0.7)
          frogIdx++
          const sleep =
            frogSleeps[Math.floor(Math.random() * frogSleeps.length)] * 1000
          timers.pushTimeout(frogStep, sleep)
        }
        frogStep()
      })

      // Ancient memory (10s+): melody
      scheduleAt(10, () => {
        const melody = [
          'C4',
          'Eb4',
          'G4',
          'Bb3',
          'G4',
          'Eb4',
          'C4',
          'Ab3',
          'Bb3',
          'G3',
          'Eb3',
          'C3',
        ]
        const playMemory = (): void => {
          if (!ctx.isPlaying() || !voices) return
          let t = Tone.now()
          melody.forEach((note) => {
            voices!.memSynth.triggerAttackRelease(note, '2n', t, 0.55)
            t += 0.75 * (60 / 52)
          })
          const totalDur = (melody.length * 0.75 + 2) * (60 / 52) * 1000
          timers.pushTimeout(playMemory, totalDur)
        }
        playMemory()
      })

      // Stellar noise (14s+)
      scheduleAt(14, () => {
        const stellarStep = (): void => {
          if (!ctx.isPlaying() || !voices) return
          if (Math.random() < 0.5) {
            voices.noise.triggerAttackRelease('2n', Tone.now(), 0.4)
          }
          const sleeps = [4, 6, 8, 3]
          const wait = sleeps[Math.floor(Math.random() * sleeps.length)] * 1000
          timers.pushTimeout(stellarStep, wait)
        }
        stellarStep()
      })

      // Choir (20s+)
      scheduleAt(20, () => {
        const chords: string[][] = [
          ['C3', 'Eb3', 'G3'],
          ['Ab2', 'C3', 'Eb3'],
          ['Eb3', 'G3', 'Bb3'],
          ['Bb2', 'D3', 'F3', 'A3'],
        ]
        let chordIdx = 0
        const playChoir = (): void => {
          if (!ctx.isPlaying() || !voices) return
          voices.choir.triggerAttackRelease(
            chords[chordIdx % chords.length],
            '1n',
            Tone.now(),
            0.4,
          )
          chordIdx++
          timers.pushTimeout(playChoir, 8000)
        }
        playChoir()
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
