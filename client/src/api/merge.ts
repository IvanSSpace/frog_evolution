import { apiJson } from './client'

export interface MergeOk {
  ok: true
  gold: string
  locationFrogs: number[][]
  discoveredLevels: number[]
  newLevel: number
  targetLocationId: number // 0 для sentinel
  isSentinel: boolean
  crossLocation: boolean
}

// Сервер не нашёл 2 лягушки (desync: новые ещё не синканы). HTTP 200, не 400.
export interface MergeSkipped {
  ok: false
  skipped: true
  reason: string
  gold: string
  locationFrogs: number[][]
  discoveredLevels: number[]
}

export type MergeResponse = MergeOk | MergeSkipped

export async function mergeApi(
  fromLevel: number,
  locationId: number,
): Promise<MergeResponse> {
  return apiJson<MergeResponse>('/game/merge', {
    method: 'POST',
    body: JSON.stringify({ fromLevel, locationId }),
  })
}
