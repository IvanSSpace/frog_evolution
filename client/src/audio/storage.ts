import type { TrackId } from './types'

const KEY_VOLUME = 'audio.volume'
const KEY_TRACK = 'audio.selectedTrack'
const KEY_VIZ = 'audio.vizEnabled'
const KEY_AUTORESUME = 'audio.autoResume'
const KEY_PROGRESS = 'audio.progress'

export function loadVolumeDb(): number {
  const raw = localStorage.getItem(KEY_VOLUME)
  if (!raw) return 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.max(-60, Math.min(0, n))
}

export function saveVolumeDb(db: number): void {
  localStorage.setItem(KEY_VOLUME, String(db))
}

const VALID_TRACKS: ReadonlySet<TrackId> = new Set<TrackId>([
  'hogstep',
  'beyondHorizon',
  'swampDance',
  'frogJazz',
])

export function loadSelectedTrack(): TrackId | null {
  const raw = localStorage.getItem(KEY_TRACK)
  if (!raw) return null
  return VALID_TRACKS.has(raw as TrackId) ? (raw as TrackId) : null
}

export function saveSelectedTrack(id: TrackId | null): void {
  if (id === null) localStorage.removeItem(KEY_TRACK)
  else localStorage.setItem(KEY_TRACK, id)
}

export function loadVizEnabled(): boolean {
  return localStorage.getItem(KEY_VIZ) === '1'
}

export function saveVizEnabled(v: boolean): void {
  localStorage.setItem(KEY_VIZ, v ? '1' : '0')
}

export function loadAutoResume(): boolean {
  const raw = localStorage.getItem(KEY_AUTORESUME)
  if (raw === null) return true
  return raw === '1'
}

export function saveAutoResume(v: boolean): void {
  localStorage.setItem(KEY_AUTORESUME, v ? '1' : '0')
}

/** Последняя позиция воспроизведения для resume при перезаходе в приложение. */
export interface AudioProgress {
  trackId: TrackId
  pos: number // позиция внутри трека (0..totalSec), уже по модулю петли
  ts: number // Date.now() момента сохранения
}

export function loadProgress(): AudioProgress | null {
  const raw = localStorage.getItem(KEY_PROGRESS)
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Partial<AudioProgress>
    if (
      typeof p.pos === 'number' &&
      Number.isFinite(p.pos) &&
      typeof p.ts === 'number' &&
      Number.isFinite(p.ts) &&
      typeof p.trackId === 'string' &&
      VALID_TRACKS.has(p.trackId as TrackId)
    ) {
      return { trackId: p.trackId as TrackId, pos: p.pos, ts: p.ts }
    }
  } catch {
    /* corrupt — игнорируем */
  }
  return null
}

export function saveProgress(p: AudioProgress): void {
  localStorage.setItem(KEY_PROGRESS, JSON.stringify(p))
}

export function clearProgress(): void {
  localStorage.removeItem(KEY_PROGRESS)
}
