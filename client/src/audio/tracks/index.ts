import type { TrackId, TrackMeta } from '../types'

export const TRACK_META: Record<TrackId, TrackMeta> = {
  beyondHorizon: {
    id: 'beyondHorizon',
    nameKey: 'player.tracks.beyondHorizon.name',
    descKey: 'player.tracks.beyondHorizon.desc',
    totalSec: 420,
    sections: [
      { start: 0, label: 'I · Awakening', key: 'C major' },
      { start: 60, label: 'II · Ascent', key: 'F major' },
      { start: 120, label: 'III · Drift', key: 'D minor' },
      { start: 180, label: 'IV · Climax', key: 'Bb major' },
      { start: 240, label: 'V · Suspension', key: 'A minor' },
      { start: 300, label: 'VI · Resolution', key: 'F major' },
      { start: 360, label: 'VII · Eternity', key: 'C major' },
    ],
  },
  swampDance: {
    id: 'swampDance',
    nameKey: 'player.tracks.swampDance.name',
    descKey: 'player.tracks.swampDance.desc',
    totalSec: 96,
    sections: [
      { start: 0, label: 'I · Утро', key: 'C major' },
      { start: 24, label: 'II · Прыжки', key: 'C major' },
      { start: 48, label: 'III · Хор лягушек', key: 'F major' },
      { start: 72, label: 'IV · Закат', key: 'C major' },
    ],
  },
  frogJazz: {
    id: 'frogJazz',
    nameKey: 'player.tracks.frogJazz.name',
    descKey: 'player.tracks.frogJazz.desc',
    totalSec: 108,
    sections: [
      { start: 0, label: 'I · Intro', key: 'A minor' },
      { start: 27, label: 'II · Theme', key: 'D minor' },
      { start: 54, label: 'III · Scat', key: 'A minor' },
      { start: 81, label: 'IV · Outro', key: 'A minor' },
    ],
  },
}
