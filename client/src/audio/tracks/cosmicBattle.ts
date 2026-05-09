import type * as ToneNS from 'tone'
import type {
  CreateTrack,
  RuntimeContext,
  ToneLib,
  TrackInstance,
} from '../types'
import { TRACK_META } from './index'
import { NodeBag, TimerBag } from './_helpers'

const SECTIONS = TRACK_META.cosmicBattle.sections
const TOTAL_SEC = TRACK_META.cosmicBattle.totalSec

const ACT_BOUNDS = [0, 15, 30, 45, 60]

type ActCleanup = () => void

const create: CreateTrack = (Tone): TrackInstance => {
  const nodes = new NodeBag()
  const timers = new TimerBag()
  let analyser: ToneNS.Analyser | null = null
  let masterEQ: ToneNS.EQ3 | null = null
  let masterReverb: ToneNS.Reverb | null = null
  let activeCleanups: ActCleanup[] = []
  let currentActIdx = -1

  function findSection(elapsed: number): number {
    const e = elapsed % TOTAL_SEC
    for (let i = ACT_BOUNDS.length - 2; i >= 0; i--) {
      if (e >= ACT_BOUNDS[i]) return i
    }
    return 0
  }

  function disposeActiveActs(): void {
    activeCleanups.forEach((c) => {
      try {
        c()
      } catch {
        /* noop */
      }
    })
    activeCleanups = []
  }

  function makeAct1(T: ToneLib, ctx: RuntimeContext): ActCleanup {
    const localNodes: unknown[] = []
    const drone = new T.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 3, decay: 0, sustain: 1, release: 5 },
    }).connect(new T.Reverb({ decay: 8, wet: 0.85 }).connect(masterEQ!))
    drone.volume.value = -18
    drone.triggerAttack('C2')
    localNodes.push(drone)

    const pulseSynth = new T.MembraneSynth({
      pitchDecay: 0.4,
      octaves: 5,
      envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.1 },
    }).connect(new T.Filter(400, 'lowpass').connect(masterEQ!))
    pulseSynth.volume.value = -22
    localNodes.push(pulseSynth)

    const pulseLoop = new T.Loop((time) => {
      pulseSynth.triggerAttackRelease('C1', '4n', time)
      pulseSynth.triggerAttackRelease(
        'C1',
        '8n',
        time + T.Time('2n').toSeconds(),
        0.4,
      )
    }, '2m')
    pulseLoop.start('+0')
    localNodes.push(pulseLoop)

    const hollowRev = new T.Reverb({ decay: 6, wet: 0.8 }).connect(masterEQ!)
    const hollowEcho = new T.FeedbackDelay('4n.', 0.3).connect(hollowRev)
    const hollow = new T.PolySynth(T.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.5, decay: 0.2, sustain: 0.8, release: 2 },
    }).connect(hollowEcho)
    hollow.volume.value = -20
    localNodes.push(hollowRev, hollowEcho, hollow)

    const act1Notes = ['C3', 'Eb3', 'G3', 'F3', 'Eb3', 'D3', 'C3']
    const act1Dur = [2, 1, 1, 2, 1, 1, 4]
    let t = T.now() + 1
    act1Notes.forEach((note, i) => {
      hollow.triggerAttackRelease(note, act1Dur[i] + 'n', t)
      t += T.Time(act1Dur[i] + 'n').toSeconds()
    })

    return () => {
      try {
        drone.triggerRelease()
      } catch {
        /* noop */
      }
      try {
        pulseLoop.stop()
      } catch {
        /* noop */
      }
      void ctx
      setTimeout(() => {
        localNodes.forEach((n) => {
          try {
            ;(n as { dispose?: () => unknown }).dispose?.()
          } catch {
            /* noop */
          }
        })
      }, 3000)
    }
  }

  function makeAct2(T: ToneLib, ctx: RuntimeContext): ActCleanup {
    const localNodes: unknown[] = []

    const kick = new T.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 8,
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
    }).connect(masterEQ!)
    kick.volume.value = -8

    const snare = new T.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
    }).connect(new T.Filter(3000, 'highpass').connect(masterEQ!))
    snare.volume.value = -14

    const hihat = new T.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).connect(masterEQ!)
    hihat.volume.value = -22

    const drumPart = new T.Part(
      ((time: number, note: string) => {
        if (note === 'kick') kick.triggerAttackRelease('C1', '8n', time)
        else if (note === 'kick2')
          kick.triggerAttackRelease('C1', '8n', time, 0.5)
        else if (note === 'snare') snare.triggerAttackRelease('8n', time)
        else if (note === 'hat') hihat.triggerAttackRelease('16n', time)
      }) as never,
      [
        ['0:0:0', 'kick'],
        ['0:0:2', 'kick2'],
        ['0:1:0', 'snare'],
        ['0:1:2', 'kick2'],
        ['0:0:1', 'hat'],
        ['0:0:3', 'hat'],
        ['0:1:1', 'hat'],
        ['0:1:3', 'hat'],
      ],
    )
    drumPart.loop = true
    drumPart.loopEnd = '1m'
    drumPart.start('+0')

    const bassDistort = new T.Distortion(0.5).connect(masterEQ!)
    const bass = new T.FMSynth({
      harmonicity: 2,
      modulationIndex: 3,
      envelope: { attack: 0.01, decay: 0.18, sustain: 0.1, release: 0.05 },
      modulationEnvelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0,
        release: 0.1,
      },
    }).connect(bassDistort)
    bass.volume.value = -10

    const bassNotes = ['C2', 'C2', 'Eb2', 'C2', 'G1', 'C2', 'Ab1', 'Bb1']
    const bassPart = new T.Sequence(
      ((time: number, note: string) => {
        bass.triggerAttackRelease(note, '8n', time)
      }) as never,
      bassNotes,
      '8n',
    )
    bassPart.start('+0')

    const sawRev = new T.Reverb({ decay: 2, wet: 0.5 }).connect(masterEQ!)
    const sawEcho = new T.FeedbackDelay('8n', 0.25).connect(sawRev)
    const saw = new T.PolySynth(T.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.1 },
    }).connect(sawEcho)
    saw.volume.value = -14

    const heroNotes = [
      'C4',
      'C4',
      'G4',
      'Eb4',
      'F4',
      'G4',
      'Ab4',
      'Ab4',
      'Bb4',
      'Ab4',
      'G4',
      'F4',
      'Eb4',
      'C5',
      'Bb4',
      'Ab4',
      'G4',
      'C4',
    ]
    const heroDur = [4, 4, 2, 4, 4, 2, 4, 4, 4, 4, 2, 4, 2, 2, 4, 4, 2, 4]
    let t2 = T.now() + 0.1
    heroNotes.forEach((note, i) => {
      saw.triggerAttackRelease(note, heroDur[i] + 'n', t2)
      t2 += T.Time(heroDur[i] + 'n').toSeconds()
    })

    localNodes.push(
      kick,
      snare,
      hihat,
      bass,
      saw,
      drumPart,
      bassPart,
      bassDistort,
      sawRev,
      sawEcho,
    )

    return () => {
      try {
        drumPart.stop()
      } catch {
        /* noop */
      }
      try {
        bassPart.stop()
      } catch {
        /* noop */
      }
      void ctx
      setTimeout(() => {
        localNodes.forEach((n) => {
          try {
            ;(n as { dispose?: () => unknown }).dispose?.()
          } catch {
            /* noop */
          }
        })
      }, 2000)
    }
  }

  function makeAct3(T: ToneLib, ctx: RuntimeContext): ActCleanup {
    const localNodes: unknown[] = []

    const kick3 = new T.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 10,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.08 },
    }).connect(masterEQ!)
    kick3.volume.value = -6

    const snare3 = new T.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    }).connect(
      new T.Filter(2500, 'highpass').connect(
        new T.Distortion(0.4).connect(masterEQ!),
      ),
    )
    snare3.volume.value = -12

    const drumPart3 = new T.Part(
      ((time: number, note: string) => {
        if (note === 'k') kick3.triggerAttackRelease('C1', '8n', time)
        else if (note === 'k2')
          kick3.triggerAttackRelease('C1', '8n', time, 0.5)
        else if (note === 's') snare3.triggerAttackRelease('8n', time)
      }) as never,
      [
        ['0:0:0', 'k'],
        ['0:0:1', 'k2'],
        ['0:1:0', 's'],
        ['0:1:2', 'k2'],
        ['0:1:3', 'k'],
      ],
    )
    drumPart3.loop = true
    drumPart3.loopEnd = '1m'
    drumPart3.start('+0')

    const bassDistort3 = new T.Distortion(0.8).connect(masterEQ!)
    const bass3 = new T.FMSynth({
      harmonicity: 1.5,
      modulationIndex: 4,
      envelope: { attack: 0.01, decay: 0.12, sustain: 0.05, release: 0.03 },
    }).connect(bassDistort3)
    bass3.volume.value = -8

    const bassNotes3 = ['C2', 'Eb2', 'G1', 'Ab1', 'C2', 'F1', 'Bb1', 'C2']
    const bassPart3 = new T.Sequence(
      ((time: number, note: string) => {
        bass3.triggerAttackRelease(note, '8n', time)
      }) as never,
      bassNotes3,
      '8n',
    )
    bassPart3.start('+0')

    const leadEcho3 = new T.FeedbackDelay('16n', 0.35).connect(masterEQ!)
    const lead3 = new T.PolySynth(T.Synth, {
      oscillator: { type: 'pulse', width: 0.3 },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.08 },
    }).connect(leadEcho3)
    lead3.volume.value = -13

    const riff3 = [
      'C5',
      'Eb5',
      'G5',
      'F5',
      'Eb5',
      'D5',
      'C5',
      'Bb4',
      'Ab4',
      'G4',
      'Ab4',
      'Bb4',
      'C5',
      'G5',
      'Eb5',
      'C5',
    ]
    let stopRiff = false
    const riffLoop = (): void => {
      if (stopRiff || !ctx.isPlaying()) return
      let t3 = T.now() + 0.05
      riff3.forEach((note) => {
        lead3.triggerAttackRelease(note, '16n', t3)
        t3 += T.Time('16n').toSeconds()
      })
      timers.pushTimeout(
        riffLoop,
        riff3.length * T.Time('16n').toSeconds() * 1000 - 100,
      )
    }
    riffLoop()

    const choirRev = new T.Reverb({ decay: 5, wet: 0.85 }).connect(masterEQ!)
    const choir = new T.PolySynth(T.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.8, decay: 0.3, sustain: 0.7, release: 2 },
    }).connect(choirRev)
    choir.volume.value = -20

    const chords3: string[][] = [
      ['C3', 'Eb3', 'G3'],
      ['Ab2', 'C3', 'Eb3'],
      ['Eb3', 'G3', 'Bb3'],
      ['Bb2', 'D3', 'F3'],
    ]
    let ci = 0
    const choirLoop = new T.Loop((time) => {
      choir.triggerAttackRelease(chords3[ci % chords3.length], '2n', time)
      ci++
    }, '2n')
    choirLoop.start('+0')

    const expDistort = new T.Distortion(1.0).connect(masterEQ!)
    const explosion = new T.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
    }).connect(new T.Filter(1500, 'lowpass').connect(expDistort))
    explosion.volume.value = -18

    const expLoop = new T.Loop((time) => {
      if (Math.random() < 0.5) explosion.triggerAttackRelease('8n', time)
    }, '4n')
    expLoop.start('+0')

    localNodes.push(
      kick3,
      snare3,
      bass3,
      lead3,
      choir,
      explosion,
      drumPart3,
      bassPart3,
      choirLoop,
      expLoop,
      bassDistort3,
      leadEcho3,
      choirRev,
      expDistort,
    )

    return () => {
      stopRiff = true
      try {
        drumPart3.stop()
      } catch {
        /* noop */
      }
      try {
        bassPart3.stop()
      } catch {
        /* noop */
      }
      try {
        choirLoop.stop()
      } catch {
        /* noop */
      }
      try {
        expLoop.stop()
      } catch {
        /* noop */
      }
      setTimeout(() => {
        localNodes.forEach((n) => {
          try {
            ;(n as { dispose?: () => unknown }).dispose?.()
          } catch {
            /* noop */
          }
        })
      }, 2000)
    }
  }

  function makeAct4(T: ToneLib, ctx: RuntimeContext): ActCleanup {
    const localNodes: unknown[] = []

    const dyingRev = new T.Reverb({ decay: 10, wet: 0.92 }).connect(masterEQ!)
    const dyingFilter = new T.Filter(800, 'lowpass').connect(dyingRev)
    const dying = new T.FMSynth({
      harmonicity: 2,
      modulationIndex: 2,
      envelope: { attack: 0.2, decay: 0.5, sustain: 0.6, release: 3 },
    }).connect(dyingFilter)
    dying.volume.value = -16

    const dyingNotes = ['C2', 'G1', 'Eb1', 'C1']
    let td = T.now() + 0.5
    dyingNotes.forEach((note, i) => {
      const vol = -16 - i * 4
      dying.volume.rampTo(vol, 2, td)
      dying.triggerAttackRelease(note, 2, td)
      td += 3
      dyingFilter.frequency.rampTo(800 - i * 150, 3, td - 3)
    })

    const finalRev = new T.Reverb({ decay: 12, wet: 0.95 }).connect(masterEQ!)
    const finalEcho = new T.FeedbackDelay('2n', 0.4).connect(finalRev)
    const finalSynth = new T.PolySynth(T.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.8, decay: 0.3, sustain: 0.7, release: 4 },
    }).connect(finalEcho)
    finalSynth.volume.value = -18

    const finalNotes = [
      'C4',
      'Eb4',
      'G4',
      'F4',
      'Eb4',
      'D4',
      'C4',
      'G3',
      'Eb3',
      'C3',
    ]
    const finalDur = [1, 0.5, 0.5, 1, 0.5, 0.5, 2, 1, 1.5, 4]
    let tf = T.now() + 1
    finalNotes.forEach((note, i) => {
      const amp = 1 - i * 0.09
      finalSynth.triggerAttackRelease(note, finalDur[i] + 'n', tf, amp)
      tf += T.Time(finalDur[i] + 'n').toSeconds()
    })

    const voidRev = new T.Reverb({ decay: 15, wet: 0.99 }).connect(masterEQ!)
    const voidDrone = new T.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 5, decay: 0, sustain: 1, release: 8 },
    }).connect(voidRev)
    voidDrone.volume.value = -26
    voidDrone.triggerAttack('C1')

    localNodes.push(
      dyingRev,
      dyingFilter,
      dying,
      finalRev,
      finalEcho,
      finalSynth,
      voidRev,
      voidDrone,
    )

    return () => {
      try {
        voidDrone.triggerRelease()
      } catch {
        /* noop */
      }
      void ctx
      setTimeout(() => {
        localNodes.forEach((n) => {
          try {
            ;(n as { dispose?: () => unknown }).dispose?.()
          } catch {
            /* noop */
          }
        })
      }, 5000)
    }
  }

  function startAct(idx: number, ctx: RuntimeContext): void {
    if (currentActIdx === idx) return
    disposeActiveActs()
    currentActIdx = idx
    ctx.onSectionChange(idx)
    let cleanup: ActCleanup
    if (idx === 0) cleanup = makeAct1(Tone, ctx)
    else if (idx === 1) cleanup = makeAct2(Tone, ctx)
    else if (idx === 2) cleanup = makeAct3(Tone, ctx)
    else cleanup = makeAct4(Tone, ctx)
    activeCleanups.push(cleanup)
  }

  return {
    meta: TRACK_META.cosmicBattle,

    async build(Tone, outNode) {
      masterReverb = nodes.add(
        new Tone.Reverb({ decay: 4, wet: 0.35 }).connect(outNode),
      )
      await masterReverb.generate()
      masterEQ = nodes.add(
        new Tone.EQ3({ low: 2, mid: 0, high: -2 }).connect(masterReverb),
      )

      analyser = new Tone.Analyser('waveform', 512)
      masterReverb.connect(analyser)
      nodes.add(analyser)

      try {
        Tone.getTransport().bpm.value = 130
      } catch {
        /* noop */
      }
      try {
        Tone.getTransport().start()
      } catch {
        /* noop */
      }
    },

    startScheduler(fromSec, ctx) {
      timers.clearAll()
      currentActIdx = -1
      const initialAct = findSection(fromSec)
      startAct(initialAct, ctx)

      const tick = (): void => {
        if (!ctx.isPlaying()) return
        const wanted = findSection(ctx.getElapsed())
        if (wanted !== currentActIdx) {
          startAct(wanted, ctx)
        }
        timers.pushTimeout(tick, 200)
      }
      tick()
    },

    stopScheduler() {
      timers.clearAll()
      disposeActiveActs()
      currentActIdx = -1
    },

    async dispose() {
      timers.clearAll()
      disposeActiveActs()
      try {
        Tone.getTransport().stop()
      } catch {
        /* noop */
      }
      try {
        Tone.getTransport().cancel()
      } catch {
        /* noop */
      }
      nodes.stopAll()
      await new Promise((r) => setTimeout(r, 100))
      nodes.disposeAll()
      analyser = null
      masterEQ = null
      masterReverb = null
    },

    getAnalyser: () => analyser,
  }
}

void SECTIONS

export default create
