import mitt from 'mitt'
import type {
  PlayerEvent,
  PlayerSnapshot,
  PlayerStatus,
  TrackId,
  TrackInstance,
  ToneLib,
  CreateTrack,
} from './types'
import {
  loadVolumeDb,
  saveVolumeDb,
  loadSelectedTrack,
  saveSelectedTrack,
  loadVizEnabled,
  saveVizEnabled,
  loadAutoResume,
  saveAutoResume,
} from './storage'

const TRACK_LOADERS: Record<TrackId, () => Promise<{ default: CreateTrack }>> =
  {
    beyondHorizon: () => import('./tracks/beyondHorizon'),
    swampDance: () => import('./tracks/swampDance'),
    frogJazz: () => import('./tracks/frogJazz'),
  }

export const TRACK_ORDER: TrackId[] = ['swampDance', 'frogJazz', 'beyondHorizon']

export const TRACK_TOTALS: Record<TrackId, number> = {
  beyondHorizon: 420,
  swampDance: 96,
  frogJazz: 108,
}

const CROSSFADE_SEC = 0.15
const RAMP_DOWN_SEC = 0.5
const DISPOSE_DELAY_MS = 4000

type Events = Record<PlayerEvent, void>

class AudioPlayer {
  private emitter = mitt<Events>()

  private Tone: ToneLib | null = null
  private masterVolume: import('tone').Volume | null = null
  private trackOut: import('tone').Volume | null = null

  private current: TrackInstance | null = null
  private status: PlayerStatus = 'idle'
  private trackId: TrackId | null = loadSelectedTrack()
  private volume: number = loadVolumeDb()
  private vizEnabled: boolean = loadVizEnabled()
  private autoResume: boolean = loadAutoResume()
  private bootPlayDone = false
  private sectionIdx = 0

  private baseTime = 0
  private realStart = 0
  private rafId: number | null = null

  private wasPlayingBeforeBlur = false

  private cachedSnapshot: PlayerSnapshot = {
    status: 'idle',
    trackId: loadSelectedTrack(),
    elapsed: 0,
    totalSec: 0,
    sectionIdx: 0,
    volume: loadVolumeDb(),
    vizEnabled: loadVizEnabled(),
    autoResume: loadAutoResume(),
  }

  private rebuildSnapshot(): void {
    const total = this.trackId ? TRACK_TOTALS[this.trackId] : 0
    this.cachedSnapshot = {
      status: this.status,
      trackId: this.trackId,
      elapsed: this.getElapsed(),
      totalSec: total,
      sectionIdx: this.sectionIdx,
      volume: this.volume,
      vizEnabled: this.vizEnabled,
      autoResume: this.autoResume,
    }
  }

  private emit(event: PlayerEvent): void {
    this.rebuildSnapshot()
    this.emitter.emit(event)
  }

  private async loadTone(): Promise<ToneLib> {
    if (this.Tone) return this.Tone
    const mod = await import('tone')
    this.Tone = mod
    this.masterVolume = new mod.Volume(this.volume).toDestination()
    return mod
  }

  private async createTrackInstance(id: TrackId): Promise<TrackInstance> {
    const Tone = await this.loadTone()
    const loader = TRACK_LOADERS[id]
    const mod = await loader()
    return mod.default(Tone)
  }

  /** Возвращает прошедшие секунды. */
  private getElapsed(): number {
    if (this.status !== 'playing') return this.baseTime
    return this.baseTime + (Date.now() - this.realStart) / 1000
  }

  private setStatus(s: PlayerStatus): void {
    if (this.status === s) return
    this.status = s
    this.emit('state')
  }

  private setSection(idx: number): void {
    if (this.sectionIdx === idx) return
    this.sectionIdx = idx
    this.emit('section')
    this.emit('state')
  }

  private startUiTick(): void {
    this.stopUiTick()
    let last = 0
    const tick = (): void => {
      if (this.status !== 'playing') return
      const now = performance.now()
      if (now - last >= 33) {
        last = now
        this.emit('tick')
      }
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private stopUiTick(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private setupVisibility(): void {
    if (typeof document === 'undefined') return
    const handler = (): void => {
      if (document.hidden) {
        this.wasPlayingBeforeBlur = this.status === 'playing'
        if (this.status === 'playing') void this.pause()
      } else if (this.wasPlayingBeforeBlur && this.autoResume) {
        this.wasPlayingBeforeBlur = false
        void this.resume()
      }
    }
    document.addEventListener('visibilitychange', handler)
  }

  init(): void {
    this.setupVisibility()
    this.setupBootAutoplay()
  }

  /**
   * 2026-05-28: autoResume = «при включённом тумблере музыка играет».
   * При первом user-gesture в сессии, если autoResume && status === 'idle',
   * стартуем пластинку (TRACK_ORDER[0] или последний выбранный через
   * loadSelectedTrack). Gesture обязателен для AudioContext.start() на
   * mobile/Telegram (autoplay policy). Listener self-removes после первого
   * срабатывания через bootPlayDone flag.
   */
  private setupBootAutoplay(): void {
    if (typeof window === 'undefined') return
    const start = (): void => {
      if (this.bootPlayDone) return
      this.bootPlayDone = true
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('touchstart', start)
      window.removeEventListener('click', start)
      window.removeEventListener('keydown', start)
      if (this.autoResume && this.status === 'idle') {
        void this.playTrack()
      }
    }
    const passiveOpts: AddEventListenerOptions = { passive: true }
    window.addEventListener('pointerdown', start, passiveOpts)
    window.addEventListener('touchstart', start, passiveOpts)
    window.addEventListener('click', start, passiveOpts)
    window.addEventListener('keydown', start)
  }

  on(event: PlayerEvent, cb: () => void): () => void {
    this.emitter.on(event, cb)
    return () => this.emitter.off(event, cb)
  }

  snapshot(): PlayerSnapshot {
    return this.cachedSnapshot
  }

  setVolume(db: number): void {
    const clamped = Math.max(-60, Math.min(0, db))
    this.volume = clamped
    saveVolumeDb(clamped)
    if (this.masterVolume) {
      this.masterVolume.volume.rampTo(clamped, 0.05)
    }
    this.emit('state')
  }

  setVizEnabled(v: boolean): void {
    this.vizEnabled = v
    saveVizEnabled(v)
    this.emit('state')
  }

  setAutoResume(v: boolean): void {
    this.autoResume = v
    saveAutoResume(v)
    this.emit('state')
    // 2026-05-28: включили тумблер и музыка не играет — запускаем пластинку.
    // setAutoResume зовётся из PlayerPanel button click = user gesture → safe
    // для AudioContext start. Если уже playing/paused — не трогаем (юзер сам
    // управляет через play/pause кнопки).
    if (v && this.status === 'idle') {
      void this.playTrack()
    }
  }

  getAnalyser(): import('tone').Analyser | null {
    return this.current?.getAnalyser() ?? null
  }

  /** Загрузка трека (build, но без play). */
  async loadTrack(id: TrackId): Promise<void> {
    if (this.trackId === id && this.current) return
    if (this.current) {
      await this.disposeCurrent(true)
    }
    this.setStatus('loading')
    const Tone = await this.loadTone()
    if (!Tone.getDestination) {
      throw new Error('Tone.js not initialized')
    }
    const inst = await this.createTrackInstance(id)
    this.trackOut = new Tone.Volume(0).connect(this.masterVolume!)
    await inst.build(Tone, this.trackOut)
    this.current = inst
    this.trackId = id
    saveSelectedTrack(id)
    this.baseTime = 0
    this.sectionIdx = 0
    this.setStatus('idle')
  }

  async playTrack(id?: TrackId, fromSec = 0): Promise<void> {
    const targetId = id ?? this.trackId ?? TRACK_ORDER[0]
    const Tone = await this.loadTone()
    if (Tone.context.state !== 'running') {
      await Tone.start()
    }

    if (this.current && this.trackId === targetId && this.status === 'paused') {
      return this.resume()
    }

    if (!this.current || this.trackId !== targetId) {
      // Crossfade if currently playing another track
      if (this.current && this.status === 'playing') {
        await this.crossfadeTo(targetId, fromSec)
        return
      }
      await this.loadTrack(targetId)
    }

    if (!this.current) return

    this.baseTime = Math.max(0, Math.min(fromSec, TRACK_TOTALS[targetId] - 1))
    this.realStart = Date.now()
    this.setStatus('playing')
    if (this.trackOut) {
      this.trackOut.volume.cancelScheduledValues(Tone.now())
      this.trackOut.volume.value = 0
    }
    this.current.startScheduler(this.baseTime, {
      getElapsed: () => this.getElapsed(),
      isPlaying: () => this.status === 'playing',
      onSectionChange: (idx) => this.setSection(idx),
    })
    this.startUiTick()
  }

  async pause(): Promise<void> {
    if (this.status !== 'playing' || !this.current) return
    this.baseTime = this.getElapsed()
    this.current.stopScheduler()
    if (this.trackOut && this.Tone) {
      this.trackOut.volume.rampTo(-60, RAMP_DOWN_SEC)
    }
    this.stopUiTick()
    this.setStatus('paused')
  }

  async resume(): Promise<void> {
    if (this.status !== 'paused' || !this.current || !this.Tone) return
    // Будим AudioContext: браузер суспендит его при сворачивании вкладки
    // (mobile/Telegram). Без этого scheduler играет в спящий контекст = тишина,
    // из-за чего авто-возобновление «не работало». Симметрично playTrack().
    if (this.Tone.context.state !== 'running') {
      await this.Tone.start()
    }
    this.realStart = Date.now()
    if (this.trackOut) {
      this.trackOut.volume.cancelScheduledValues(this.Tone.now())
      this.trackOut.volume.rampTo(0, RAMP_DOWN_SEC)
    }
    this.current.startScheduler(this.baseTime, {
      getElapsed: () => this.getElapsed(),
      isPlaying: () => this.status === 'playing',
      onSectionChange: (idx) => this.setSection(idx),
    })
    this.setStatus('playing')
    this.startUiTick()
  }

  async stopTrack(): Promise<void> {
    if (!this.current) return
    this.stopUiTick()
    await this.disposeCurrent(false)
    this.baseTime = 0
    this.sectionIdx = 0
    this.setStatus('idle')
  }

  seekTo(sec: number): void {
    if (!this.current || !this.trackId) return
    const total = TRACK_TOTALS[this.trackId]
    const target = Math.max(0, Math.min(sec, total - 1))
    if (this.status === 'playing') {
      this.current.stopScheduler()
      this.baseTime = target
      this.realStart = Date.now()
      this.current.startScheduler(target, {
        getElapsed: () => this.getElapsed(),
        isPlaying: () => this.status === 'playing',
        onSectionChange: (idx) => this.setSection(idx),
      })
    } else {
      this.baseTime = target
    }
    this.emit('tick')
  }

  getCurrentTime(): number {
    return this.getElapsed()
  }

  private async disposeCurrent(silentlyRamp: boolean): Promise<void> {
    if (!this.current) return
    const inst = this.current
    const out = this.trackOut
    this.current = null
    this.trackOut = null
    inst.stopScheduler()
    if (silentlyRamp && out && this.Tone) {
      try {
        out.volume.rampTo(-60, RAMP_DOWN_SEC)
      } catch {
        /* noop */
      }
    }
    setTimeout(() => {
      void inst.dispose().catch(() => {
        /* noop */
      })
      try {
        out?.dispose()
      } catch {
        /* noop */
      }
    }, DISPOSE_DELAY_MS)
  }

  private async crossfadeTo(id: TrackId, fromSec: number): Promise<void> {
    const Tone = this.Tone!
    const oldInst = this.current
    const oldOut = this.trackOut
    this.setStatus('loading')
    if (oldInst && oldOut) {
      oldInst.stopScheduler()
      oldOut.volume.rampTo(-60, CROSSFADE_SEC)
      setTimeout(
        () => {
          void oldInst.dispose().catch(() => {
            /* noop */
          })
          try {
            oldOut.dispose()
          } catch {
            /* noop */
          }
        },
        CROSSFADE_SEC * 1000 + DISPOSE_DELAY_MS,
      )
    }
    this.current = null
    this.trackOut = null

    const newInst = await this.createTrackInstance(id)
    const newOut = new Tone.Volume(-60).connect(this.masterVolume!)
    await newInst.build(Tone, newOut)
    this.current = newInst
    this.trackOut = newOut
    this.trackId = id
    saveSelectedTrack(id)
    this.baseTime = Math.max(0, Math.min(fromSec, TRACK_TOTALS[id] - 1))
    this.realStart = Date.now()
    this.setStatus('playing')
    newOut.volume.rampTo(0, CROSSFADE_SEC)
    newInst.startScheduler(this.baseTime, {
      getElapsed: () => this.getElapsed(),
      isPlaying: () => this.status === 'playing',
      onSectionChange: (idx) => this.setSection(idx),
    })
    this.startUiTick()
  }

  /** Хелпер для UI: подписаться на смену секции. */
  onSectionChange(cb: () => void): () => void {
    return this.on('section', cb)
  }
}

export const audioPlayer = new AudioPlayer()

if (typeof window !== 'undefined') {
  audioPlayer.init()
}
