const NOTE_VALUES: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
}

const NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const

export function transpose(note: string, semis: number): string {
  const m = note.match(/^([A-G][#b]?)(-?\d+)$/)
  if (!m) return note
  const pc = NOTE_VALUES[m[1]]
  const oct = parseInt(m[2], 10)
  const total = pc + oct * 12 + semis
  return NAMES[((total % 12) + 12) % 12] + Math.floor(total / 12)
}

/** Утилита: создаёт массив для регистрации синтез-узлов и возвращает API остановки/диспоза. */
export class NodeBag {
  nodes: Array<{ stop?: () => unknown; dispose?: () => unknown }> = []

  add<T>(node: T): T {
    this.nodes.push(node as { stop?: () => unknown; dispose?: () => unknown })
    return node
  }

  stopAll(): void {
    this.nodes.forEach((n) => {
      try {
        n.stop?.()
      } catch {
        /* noop */
      }
    })
  }

  disposeAll(): void {
    this.nodes.forEach((n) => {
      try {
        n.dispose?.()
      } catch {
        /* noop */
      }
    })
    this.nodes = []
  }
}

// Нода с регулируемой громкостью: у Tone-синтов и Tone.Volume есть `.volume`
// (Param в децибелах). Достаточно для live-микшера.
interface VolumeNode {
  volume: { value: number }
}

/**
 * Микшер трека: регистрирует именованные голоса с их громкостью (dB) и отдаёт
 * каналы для UI-ползунков. Менять value можно на лету — Tone применяет сразу.
 */
export class Mixer {
  private chans: import('../types').MixerChannel[] = []

  add(id: string, label: string, node: VolumeNode): void {
    this.chans.push({
      id,
      label,
      getDb: () => node.volume.value,
      setDb: (db) => {
        node.volume.value = db
      },
    })
  }

  channels(): import('../types').MixerChannel[] {
    return this.chans
  }
}

/** Управляет списком таймеров (setTimeout/setInterval). */
export class TimerBag {
  ids: ReturnType<typeof setTimeout>[] = []

  pushTimeout(cb: () => void, ms: number): void {
    this.ids.push(setTimeout(cb, ms))
  }

  pushInterval(cb: () => void, ms: number): void {
    this.ids.push(
      setInterval(cb, ms) as unknown as ReturnType<typeof setTimeout>,
    )
  }

  add(id: ReturnType<typeof setTimeout>): void {
    this.ids.push(id)
  }

  clearAll(): void {
    this.ids.forEach((id) => {
      clearTimeout(id)
      clearInterval(id as unknown as ReturnType<typeof setInterval>)
    })
    this.ids = []
  }
}
