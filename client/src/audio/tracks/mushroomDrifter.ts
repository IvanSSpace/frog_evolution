import type * as ToneNS from 'tone'
import type { CreateTrack, TrackInstance, ToneLib } from '../types'
import { TRACK_META } from './index'
import { NodeBag, TimerBag, transpose, Mixer } from './_helpers'

// Mushroom Drifter — заглавная тема про космолягух. Меланхоличный альт-вайб,
// Am–C–G–F, 90 BPM, 4/4, структура интро → тема → припев → брейк → кульминация
// → концовка (~3:01). Порт оригинальной web-audio композиции (Tone.js) в формат
// плеера: голоса + событийный планировщик с пере-расписанием на каждый луп.
//
// Слои: pad (fatsawtooth + lowpass), bass (MonoSynth triangle), arp (triangle →
// delay), lead (triangle + vibrato → delay), kick/snare/hat, crash (metal),
// sparkle (sine → delay+reverb). Reverb (decay 5) + FeedbackDelay.

const SECTIONS = TRACK_META.mushroomDrifter.sections
const TOTAL_SEC = TRACK_META.mushroomDrifter.totalSec
const BPM = 90
const SPB = 60 / BPM
const T = (bar: number, beat = 0): number => (bar * 4 + beat) * SPB

// Длительности нот → секунды (при 90 BPM).
const DUR: Record<string, number> = {
  '32n': SPB / 8,
  '16n': SPB / 4,
  '8n': SPB / 2,
  '4n': SPB,
  '2n': SPB * 2,
  '1n': SPB * 4,
  '1m': SPB * 4,
  '2m': SPB * 8,
  '4m': SPB * 16,
}
const dsec = (d: string): number => DUR[d] ?? SPB

interface Chord {
  name: string
  bass: string
  pad: string[]
  arp: string[]
}
const PROG: Chord[] = [
  { name: 'Am', bass: 'A1', pad: ['A2', 'C3', 'E3'], arp: ['A3', 'C4', 'E4'] },
  { name: 'C', bass: 'C2', pad: ['C3', 'E3', 'G3'], arp: ['C4', 'E4', 'G4'] },
  { name: 'G', bass: 'G1', pad: ['G2', 'B2', 'D3'], arp: ['G3', 'B3', 'D4'] },
  { name: 'F', bass: 'F1', pad: ['F2', 'A2', 'C3'], arp: ['F3', 'A3', 'C4'] },
]
const MOTIF: Record<string, Array<[number, string, string]>> = {
  Am: [
    [0, 'E4', '4n'],
    [1.5, 'A4', '8n'],
    [2, 'C5', '4n'],
    [3.5, 'B4', '8n'],
    [4, 'A4', '4n'],
    [6, 'E4', '2n'],
  ],
  C: [
    [0, 'G4', '4n'],
    [1.5, 'E4', '8n'],
    [2, 'G4', '4n'],
    [3, 'C5', '8n'],
    [4, 'B4', '4n'],
    [6, 'G4', '2n'],
  ],
  G: [
    [0, 'D5', '4n'],
    [1.5, 'B4', '8n'],
    [2, 'D5', '4n'],
    [4, 'G4', '4n'],
    [6, 'B4', '2n'],
  ],
  F: [
    [0, 'C5', '4n'],
    [1.5, 'A4', '8n'],
    [2, 'F4', '4n'],
    [3, 'A4', '8n'],
    [4, 'G4', '4n'],
    [6, 'A4', '2n'],
  ],
}

type Section = 'intro' | 'A' | 'B' | 'break' | 'A2' | 'outro'
function sectionOf(bar: number): Section {
  if (bar < 8) return 'intro'
  if (bar < 24) return 'A'
  if (bar < 40) return 'B'
  if (bar < 48) return 'break'
  if (bar < 64) return 'A2'
  return 'outro'
}

type Inst =
  | 'pad'
  | 'bass'
  | 'arp'
  | 'lead'
  | 'kick'
  | 'snare'
  | 'hat'
  | 'crash'
  | 'sparkle'
interface Ev {
  time: number
  inst: Inst
  note: string | string[] | null
  dur: string
  vel: number
}

function buildEvents(): Ev[] {
  const E: Ev[] = []
  const push = (
    time: number,
    inst: Inst,
    note: string | string[] | null,
    dur: string,
    vel: number,
  ): void => {
    E.push({ time, inst, note, dur, vel })
  }
  for (let bar = 0; bar < 64; bar++) {
    const ch = PROG[Math.floor((bar % 8) / 2)]
    const sec = sectionOf(bar)
    const start = bar % 2 === 0
    // PAD
    if (start) {
      let v = 0.5
      if (sec === 'intro') v = Math.min(0.55, 0.28 + 0.035 * bar)
      if (sec === 'break') v = 0.42
      push(T(bar), 'pad', ch.pad, '2m', v)
    }
    // BASS
    if (sec !== 'intro' || bar >= 4) {
      if (sec === 'break') {
        push(T(bar), 'bass', ch.bass, '1m', 0.5)
      } else if (sec === 'intro') {
        push(T(bar), 'bass', ch.bass, '2n', 0.5)
        push(T(bar, 2), 'bass', ch.bass, '2n', 0.45)
      } else if (sec === 'A') {
        push(T(bar), 'bass', ch.bass, '4n', 0.6)
        push(T(bar, 2), 'bass', ch.bass, '4n', 0.55)
      } else {
        for (const b of [0, 1, 2, 3])
          push(T(bar, b), 'bass', ch.bass, '8n', 0.62)
        push(T(bar, 2.5), 'bass', transpose(ch.bass, 12), '8n', 0.4)
      }
    }
    // ARP
    if (sec !== 'intro' || bar >= 4) {
      const an = ch.arp.map((n) => transpose(n, 12))
      const pat = [0, 1, 2, 1, 0, 1, 2, 1]
      let av = 0.3
      if (sec === 'intro') av = 0.16
      if (sec === 'break') av = 0.2
      if (sec === 'A') av = 0.27
      if (sec === 'B' || sec === 'A2') av = 0.33
      for (let i = 0; i < 8; i++)
        push(T(bar, i * 0.5), 'arp', an[pat[i]], '8n', av)
    }
    // LEAD
    if (start && (sec === 'A' || sec === 'B' || sec === 'A2')) {
      const oct = sec === 'B' || sec === 'A2' ? 12 : 0
      const lv = sec === 'A' ? 0.55 : 0.68
      for (const [bt, nt, du] of MOTIF[ch.name]) {
        push(T(bar, bt), 'lead', transpose(nt, oct), du, lv)
      }
    }
    if (sec === 'break' && (bar === 42 || bar === 44)) {
      push(T(bar), 'lead', 'E5', '2n', 0.38)
      push(T(bar, 2), 'lead', 'A4', '2n', 0.38)
    }
    // DRUMS
    if (sec === 'intro') {
      if (bar === 6 || bar === 7) push(T(bar), 'kick', null, '8n', 0.6)
      if (bar === 7) push(T(bar, 2), 'kick', null, '8n', 0.6)
    } else if (sec === 'A') {
      push(T(bar), 'kick', null, '8n', 0.9)
      push(T(bar, 2), 'kick', null, '8n', 0.8)
      if (bar >= 16) push(T(bar, 2), 'snare', null, '16n', 0.5)
      for (let i = 0; i < 8; i++)
        push(T(bar, i * 0.5), 'hat', null, '32n', i % 2 ? 0.24 : 0.14)
    } else if (sec === 'B' || sec === 'A2') {
      push(T(bar), 'kick', null, '8n', 1.0)
      push(T(bar, 2), 'kick', null, '8n', 0.9)
      push(T(bar, 2.5), 'kick', null, '8n', 0.55)
      push(T(bar, 1), 'snare', null, '16n', 0.8)
      push(T(bar, 3), 'snare', null, '16n', 0.85)
      for (let i = 0; i < 8; i++)
        push(T(bar, i * 0.5), 'hat', null, '32n', i % 2 ? 0.3 : 0.17)
    } else if (sec === 'break' && bar >= 46) {
      const steps = bar === 47 ? 16 : 8
      for (let i = 0; i < steps; i++)
        push(T(bar, i * (4 / steps)), 'hat', null, '32n', 0.18 + 0.018 * i)
      if (bar === 47) {
        push(T(bar, 3), 'snare', null, '16n', 0.7)
        push(T(bar, 3.5), 'snare', null, '16n', 0.88)
      }
    }
    if (bar === 24 || bar === 48 || bar === 56)
      push(T(bar), 'crash', null, '1n', 0.32)
    if (sec === 'intro' && (bar === 2 || bar === 5))
      push(T(bar, 1), 'sparkle', 'A5', '4n', 0.38)
    if (sec === 'break' && (bar === 40 || bar === 43))
      push(T(bar, 2), 'sparkle', 'E6', '4n', 0.32)
  }
  // OUTRO (такты 64-67) — разрешение на Am
  push(T(64), 'pad', ['A2', 'C3', 'E3', 'A3'], '4m', 0.55)
  push(T(64), 'bass', 'A1', '1m', 0.5)
  push(T(64), 'crash', null, '2n', 0.22)
  push(T(64), 'lead', 'A4', '2m', 0.5)
  push(T(66), 'lead', 'E4', '2m', 0.45)
  push(T(64), 'sparkle', 'A5', '2n', 0.3)
  push(T(67, 2), 'sparkle', 'E6', '2n', 0.24)
  push(T(67), 'bass', 'A1', '2n', 0.45)
  return E.sort((a, b) => a.time - b.time)
}

interface Voices {
  pad: ToneNS.PolySynth
  bass: ToneNS.MonoSynth
  arp: ToneNS.Synth
  lead: ToneNS.Synth
  kick: ToneNS.MembraneSynth
  snare: ToneNS.NoiseSynth
  hat: ToneNS.NoiseSynth
  crash: ToneNS.MetalSynth
  sparkle: ToneNS.Synth
}

const create: CreateTrack = (Tone: ToneLib): TrackInstance => {
  const nodes = new NodeBag()
  const timers = new TimerBag()
  const mixer = new Mixer()
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

  function trigger(ev: Ev): void {
    if (!voices) return
    const t = Tone.now()
    const d = dsec(ev.dur)
    const v = ev.vel
    switch (ev.inst) {
      case 'pad':
        voices.pad.triggerAttackRelease(ev.note as string[], d, t, v)
        break
      case 'bass':
        voices.bass.triggerAttackRelease(ev.note as string, d, t, v)
        break
      case 'arp':
        voices.arp.triggerAttackRelease(ev.note as string, d, t, v)
        break
      case 'lead':
        voices.lead.triggerAttackRelease(ev.note as string, d, t, v)
        break
      case 'sparkle':
        voices.sparkle.triggerAttackRelease(ev.note as string, d, t, v)
        break
      case 'kick':
        voices.kick.triggerAttackRelease('C1', d, t, v)
        break
      case 'snare':
        voices.snare.triggerAttackRelease(d, t, v)
        break
      case 'hat':
        voices.hat.triggerAttackRelease(d, t, v)
        break
      case 'crash':
        voices.crash.triggerAttackRelease(d, t, v)
        break
    }
  }

  return {
    meta: TRACK_META.mushroomDrifter,

    async build(_Tone, outNode) {
      // −40% к максимальной громкости (0.92 × 0.6) — трек заметно громче
      // остальных в оригинале, приглушаем на выходе пластинки.
      const master = nodes.add(new Tone.Gain(0.92 * 0.6).connect(outNode))
      const reverb = nodes.add(
        new Tone.Reverb({ decay: 5, preDelay: 0.02, wet: 0.34 }).connect(
          master,
        ),
      )
      await reverb.generate()
      const delay = nodes.add(
        new Tone.FeedbackDelay({
          delayTime: '8n.',
          feedback: 0.27,
          wet: 0.17,
        }).connect(master),
      )

      analyser = new Tone.Analyser('waveform', 1024)
      master.connect(analyser)
      nodes.add(analyser)

      // PAD — fatsawtooth через lowpass, отправка в reverb
      const padF = nodes.add(new Tone.Filter(1700, 'lowpass').connect(master))
      padF.connect(reverb)
      const pad = nodes.add(
        new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'fatsawtooth', count: 3, spread: 28 },
          envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 2.6 },
        }).connect(padF),
      )
      pad.volume.value = -15

      // BASS — MonoSynth triangle с filter-envelope
      const bass = nodes.add(
        new Tone.MonoSynth({
          oscillator: { type: 'triangle' },
          filter: { Q: 1, type: 'lowpass' },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 },
          filterEnvelope: {
            attack: 0.02,
            decay: 0.2,
            baseFrequency: 110,
            octaves: 2.4,
            sustain: 0.4,
          },
        }).connect(master),
      )
      bass.volume.value = -9

      // ARP — triangle → delay
      const arp = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.005, decay: 0.15, sustain: 0.05, release: 0.2 },
        }),
      )
      arp.connect(delay)
      arp.connect(master)
      arp.volume.value = -19

      // LEAD — triangle + vibrato → delay
      const lead = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.6 },
        }),
      )
      const vib = nodes.add(new Tone.Vibrato({ frequency: 5, depth: 0.08 }))
      lead.connect(vib)
      vib.connect(delay)
      vib.connect(master)
      lead.volume.value = -11

      // KICK
      const kick = nodes.add(
        new Tone.MembraneSynth({
          pitchDecay: 0.03,
          octaves: 6,
          envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
        }).connect(master),
      )
      kick.volume.value = -4

      // SNARE — белый шум через highpass + reverb
      const snF = nodes.add(new Tone.Filter(1700, 'highpass').connect(master))
      snF.connect(reverb)
      const snare = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
        }).connect(snF),
      )
      snare.volume.value = -13

      // HAT
      const haF = nodes.add(new Tone.Filter(7000, 'highpass').connect(master))
      const hat = nodes.add(
        new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
        }).connect(haF),
      )
      hat.volume.value = -23

      // CRASH — metal через reverb
      const crash = nodes.add(
        new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 1.2, release: 0.4 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5,
        }).connect(master),
      )
      crash.connect(reverb)
      crash.volume.value = -22

      // SPARKLE — sine → delay + reverb
      const sparkle = nodes.add(
        new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.6 },
        }),
      )
      sparkle.connect(delay)
      sparkle.connect(reverb)
      sparkle.volume.value = -17

      voices = {
        pad,
        bass,
        arp,
        lead,
        kick,
        snare,
        hat,
        crash,
        sparkle,
      }

      mixer.add('pad', 'Пэд', pad)
      mixer.add('bass', 'Бас', bass)
      mixer.add('arp', 'Арп', arp)
      mixer.add('lead', 'Лид', lead)
      mixer.add('kick', 'Кик', kick)
      mixer.add('snare', 'Снэр', snare)
      mixer.add('hat', 'Хет', hat)
      mixer.add('crash', 'Креш', crash)
      mixer.add('sparkle', 'Искры', sparkle)
    },

    startScheduler(fromSec, ctx) {
      if (!voices) return
      timers.clearAll()
      const events = buildEvents()

      // Section watcher (UI) — секция по elapsed % TOTAL.
      let curSec = findSection(fromSec)
      ctx.onSectionChange(curSec)
      const sectionTick = (): void => {
        if (!ctx.isPlaying()) return
        const s = findSection(ctx.getElapsed())
        if (s !== curSec) {
          curSec = s
          ctx.onSectionChange(curSec)
        }
        timers.pushTimeout(sectionTick, 200)
      }
      sectionTick()

      // Планируем один «проход» арранжировки от origin (момент такта 0 этого
      // прохода). В конце ставим пере-расписание следующего прохода — трек сам
      // лупится (getElapsed растёт безгранично, startScheduler зовётся 1 раз).
      const schedulePass = (origin: number): void => {
        if (!ctx.isPlaying()) return
        const nowElapsed = ctx.getElapsed()
        for (const ev of events) {
          const delay = (origin + ev.time - nowElapsed) * 1000
          if (delay < -60) continue // событие уже прошло (seek в середину)
          timers.pushTimeout(
            () => {
              if (ctx.isPlaying()) trigger(ev)
            },
            Math.max(0, delay),
          )
        }
        const nextOrigin = origin + TOTAL_SEC
        const loopDelay = (nextOrigin - ctx.getElapsed()) * 1000
        timers.pushTimeout(
          () => schedulePass(nextOrigin),
          Math.max(0, loopDelay),
        )
      }
      // origin первого прохода выравниваем по проигранным лупам (seek/resume).
      schedulePass(Math.floor(fromSec / TOTAL_SEC) * TOTAL_SEC)
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
