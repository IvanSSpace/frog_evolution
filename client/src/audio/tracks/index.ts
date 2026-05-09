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
  stellarTide: {
    id: 'stellarTide',
    nameKey: 'player.tracks.stellarTide.name',
    descKey: 'player.tracks.stellarTide.desc',
    totalSec: 240,
    sections: [
      { start: 0, label: 'I · Awakening', key: 'F# minor' },
      { start: 60, label: 'II · Currents', key: 'C# minor' },
      { start: 120, label: 'III · Light', key: 'A major' },
      { start: 180, label: 'IV · Return', key: 'F# minor' },
    ],
  },
  phylogenesis: {
    id: 'phylogenesis',
    nameKey: 'player.tracks.phylogenesis.name',
    descKey: 'player.tracks.phylogenesis.desc',
    totalSec: 240,
    sections: [
      { start: 0, label: 'I · Statement', key: 'A minor' },
      { start: 60, label: 'II · Phasing', key: 'D minor' },
      { start: 120, label: 'III · Inversion', key: 'C major' },
      { start: 180, label: 'IV · Convergence', key: 'A minor' },
    ],
  },
  leviathanLullaby: {
    id: 'leviathanLullaby',
    nameKey: 'player.tracks.leviathanLullaby.name',
    descKey: 'player.tracks.leviathanLullaby.desc',
    totalSec: 240,
    sections: [
      { start: 0, label: 'I · Descent', key: 'A minor' },
      { start: 60, label: 'II · Awakening', key: 'A minor' },
      { start: 120, label: 'III · The Song', key: 'A minor' },
      { start: 180, label: 'IV · Drifting', key: 'A minor' },
    ],
  },
  frogTomorrow: {
    id: 'frogTomorrow',
    nameKey: 'player.tracks.frogTomorrow.name',
    descKey: 'player.tracks.frogTomorrow.desc',
    totalSec: 60,
    sections: [
      { start: 0, label: 'Drone', key: 'C minor' },
      { start: 8, label: 'Pulse', key: 'C minor' },
      { start: 16, label: 'Cries', key: 'C minor' },
      { start: 28, label: 'Memory', key: 'C minor' },
      { start: 42, label: 'Choir', key: 'C minor' },
      { start: 54, label: 'Void', key: 'C minor' },
    ],
  },
  cosmicBattle: {
    id: 'cosmicBattle',
    nameKey: 'player.tracks.cosmicBattle.name',
    descKey: 'player.tracks.cosmicBattle.desc',
    totalSec: 60,
    sections: [
      { start: 0, label: 'I · Approach', key: 'C minor' },
      { start: 15, label: 'II · Clash', key: 'C minor' },
      { start: 30, label: 'III · Chaos', key: 'C minor' },
      { start: 45, label: 'IV · Silence', key: 'C minor' },
    ],
  },
}
