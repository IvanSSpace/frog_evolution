import type * as ToneNS from 'tone'

export type ToneLib = typeof ToneNS

export interface TrackSection {
  start: number
  label: string
  key: string
}

export interface TrackMeta {
  id: TrackId
  nameKey: string
  descKey: string
  totalSec: number
  sections: TrackSection[]
}

export type TrackId =
  | 'hogstep'
  | 'beyondHorizon'
  | 'swampDance'
  | 'frogJazz'
  | 'mushroomDrifter'

export interface RuntimeContext {
  getElapsed: () => number
  isPlaying: () => boolean
  onSectionChange: (idx: number) => void
}

export interface TrackInstance {
  meta: TrackMeta
  build: (Tone: ToneLib, outNode: ToneNS.ToneAudioNode) => Promise<void>
  startScheduler: (fromSec: number, ctx: RuntimeContext) => void
  stopScheduler: () => void
  dispose: () => Promise<void>
  getAnalyser: () => ToneNS.Analyser | null
}

export type CreateTrack = (Tone: ToneLib) => TrackInstance

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused'

export interface PlayerSnapshot {
  status: PlayerStatus
  trackId: TrackId | null
  elapsed: number
  totalSec: number
  sectionIdx: number
  volume: number
  vizEnabled: boolean
  autoResume: boolean
}

export type PlayerEvent = 'state' | 'tick' | 'section'
