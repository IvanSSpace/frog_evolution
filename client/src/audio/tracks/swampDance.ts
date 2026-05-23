import type * as ToneNS from 'tone'
import type { CreateTrack, TrackInstance } from '../types'
import { TRACK_META } from './index'
import { NodeBag, TimerBag } from './_helpers'

// Swamp Dance — весёлый болотный трек для loc1 (Болото).
// C major, ~125 BPM, 4 секции по 24 сек = 96 sec total.
// Слои:
//   bass     — pluck bass на корнях аккордов (C/F/G/Am).
//   lead     — мелодия triangle synth, пентатоническая.
//   ribbit   — лягушачьи "квак" через NoiseSynth + bandpass + pitchshift.
//   bubbles  — short sine arpeggios (пузырьки).
//   kick     — мягкий downbeat (квартовая нота).

const SECTIONS = TRACK_META.swampDance.sections
const TOTAL_SEC = TRACK_META.swampDance.totalSec
const BPM = 125
const SEC_PER_BEAT = 60 / BPM

interface Voices {
  bass: ToneNS.Synth
  lead: ToneNS.Synth
  ribbitNoise: ToneNS.NoiseSynth
  ribbitFilter: ToneNS.Filter
  ribbitPitch: ToneNS.PitchShift
  bubbles: ToneNS.Synth
  kick: ToneNS.MembraneSynth
  chord: ToneNS.PolySynth
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
    meta: TRACK_META.swampDance,

    async build(_Tone, outNode) {
      const masterRev = nodes.add(
        new Tone.Reverb({ decay: 3, wet: 0.35 }).connect(outNode),
      )
      await masterRev.generate()

      analyser = new Tone.Analyser('waveform', 1024)
      masterRev.connect(analyser)
      nodes.add(analyser)

      // Bass
      const bass = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.25, sustain: 0.15, release: 0.3 },
        }).connect(masterRev),
      )
      bass.volume.value = -10

      // Lead melody
      const leadDelay = nodes.add(
        new Tone.FeedbackDelay('8n', 0.25).connect(masterRev),
      )
      leadDelay.wet.value = 0.22
      const lead = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.02, decay: 0.18, sustain: 0.4, release: 0.4 },
        }).connect(leadDelay),
      )
      lead.volume.value = -12

      // Ribbit (frog "quack")
      const ribbitPitch = nodes.add(
        new Tone.PitchShift({ pitch: -10, windowSize: 0.05 }).connect(masterRev),
      )
      const ribbitFilter = nodes.add(
        new Tone.Filter({ frequency: 420, type: 'bandpass', Q: 6 }).connect(
          ribbitPitch,
        ),
      )
      const ribbitNoise = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'brown' },
          envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.05 },
        }).connect(ribbitFilter),
      )
      ribbitNoise.volume.value = -8

      // Bubbles (high sparkle)
      const bubblesDelay = nodes.add(
        new Tone.FeedbackDelay('16n', 0.35).connect(masterRev),
      )
      bubblesDelay.wet.value = 0.3
      const bubbles = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.005, decay: 0.08, sustain: 0, release: 0.1 },
        }).connect(bubblesDelay),
      )
      bubbles.volume.value = -18

      // Kick (downbeat)
      const kick = nodes.add(
        new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 4,
          envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
        }).connect(masterRev),
      )
      kick.volume.value = -10

      // Chord pad
      const chord = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.4, decay: 0.3, sustain: 0.5, release: 1.2 },
        }).connect(masterRev),
      )
      chord.volume.value = -22

      voices = {
        bass,
        lead,
        ribbitNoise,
        ribbitFilter,
        ribbitPitch,
        bubbles,
        kick,
        chord,
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

      // Chord progression: C major / F major / G major / Am — one chord per 2 beats.
      // 4-beat bar. Each bar: 1 chord. Section 24s = 12.5 bars at 125 BPM.
      const CHORDS: Array<{ root: string; notes: string[] }> = [
        { root: 'C2', notes: ['C3', 'E3', 'G3'] },
        { root: 'F2', notes: ['F3', 'A3', 'C4'] },
        { root: 'G2', notes: ['G3', 'B3', 'D4'] },
        { root: 'A2', notes: ['A3', 'C4', 'E4'] },
      ]

      // ─── Section I (0+) — Утро: бас + лёгкие пузырьки, без kick ───
      scheduleAt(0, () => {
        let bar = 0
        const playBar = (): void => {
          if (!ctx.isPlaying() || !voices) return
          const c = CHORDS[bar % CHORDS.length]
          const now = Tone.now()
          // Бас на 1 и 3 долях
          voices.bass.triggerAttackRelease(c.root, '4n', now, 0.7)
          voices.bass.triggerAttackRelease(c.root, '4n', now + SEC_PER_BEAT * 2, 0.6)
          // Пузырьки на 2 и 4 долях
          const bubbleNote = c.notes[Math.floor(Math.random() * c.notes.length)]
          voices.bubbles.triggerAttackRelease(
            bubbleNote,
            '16n',
            now + SEC_PER_BEAT,
            0.5,
          )
          voices.bubbles.triggerAttackRelease(
            c.notes[(bar + 1) % c.notes.length],
            '16n',
            now + SEC_PER_BEAT * 3,
            0.4,
          )
          bar++
          timers.pushTimeout(playBar, SEC_PER_BEAT * 4 * 1000)
        }
        playBar()
      })

      // ─── Section II (24+) — Прыжки: lead-мелодия + kick ───
      scheduleAt(24, () => {
        const melody = [
          'C4', 'E4', 'G4', 'E4',
          'F4', 'A4', 'G4', 'E4',
          'D4', 'G4', 'F4', 'E4',
          'C4', 'E4', 'D4', 'C4',
        ]
        let mIdx = 0
        const playLead = (): void => {
          if (!ctx.isPlaying() || !voices) return
          const note = melody[mIdx % melody.length]
          voices.lead.triggerAttackRelease(note, '8n', Tone.now(), 0.65)
          mIdx++
          timers.pushTimeout(playLead, SEC_PER_BEAT * 1000)
        }
        playLead()

        const playKick = (): void => {
          if (!ctx.isPlaying() || !voices) return
          voices.kick.triggerAttackRelease('C1', '8n', Tone.now(), 0.85)
          timers.pushTimeout(playKick, SEC_PER_BEAT * 2 * 1000)
        }
        playKick()
      })

      // ─── Section III (48+) — Хор лягушек: ribbit pattern + chord pad ───
      scheduleAt(48, () => {
        // F major shift — поднимаем bassroot чуть выше
        const ribbits = [200, 300, 250, 380, 220, 320]
        let rIdx = 0
        const playRibbit = (): void => {
          if (!ctx.isPlaying() || !voices) return
          voices.ribbitFilter.frequency.value =
            ribbits[rIdx % ribbits.length]
          // двойной квак (характерный "ква-ква")
          voices.ribbitNoise.triggerAttackRelease('8n', Tone.now(), 0.8)
          voices.ribbitNoise.triggerAttackRelease(
            '8n',
            Tone.now() + 0.15,
            0.7,
          )
          rIdx++
          const wait = (Math.random() * 0.6 + 0.6) * 1000
          timers.pushTimeout(playRibbit, wait)
        }
        playRibbit()

        // Chord pad на каждом 4-битном баре
        let cBar = 1 // F major — second chord
        const playChord = (): void => {
          if (!ctx.isPlaying() || !voices) return
          const c = CHORDS[cBar % CHORDS.length]
          voices.chord.triggerAttackRelease(c.notes, '1n', Tone.now(), 0.5)
          cBar++
          timers.pushTimeout(playChord, SEC_PER_BEAT * 4 * 1000)
        }
        playChord()
      })

      // ─── Section IV (72+) — Закат: melodic outro, тише ───
      scheduleAt(72, () => {
        const outroMelody = ['G4', 'E4', 'C4', 'A3', 'G3', 'E3', 'C3']
        let oIdx = 0
        const playOutro = (): void => {
          if (!ctx.isPlaying() || !voices) return
          const note = outroMelody[oIdx % outroMelody.length]
          voices.lead.triggerAttackRelease(note, '4n', Tone.now(), 0.5)
          // последний пузырёк на каждом обороте
          voices.bubbles.triggerAttackRelease(
            'C5',
            '16n',
            Tone.now() + SEC_PER_BEAT,
            0.35,
          )
          oIdx++
          timers.pushTimeout(playOutro, SEC_PER_BEAT * 2 * 1000)
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
