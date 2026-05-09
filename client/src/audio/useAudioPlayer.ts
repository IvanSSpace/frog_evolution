import { useSyncExternalStore } from 'react'
import { audioPlayer } from './audioPlayer'
import type { PlayerSnapshot } from './types'

const subscribe = (cb: () => void): (() => void) => {
  const off1 = audioPlayer.on('state', cb)
  const off2 = audioPlayer.on('tick', cb)
  const off3 = audioPlayer.on('section', cb)
  return () => {
    off1()
    off2()
    off3()
  }
}

const getSnapshot = (): PlayerSnapshot => audioPlayer.snapshot()

export function useAudioPlayer(): PlayerSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
