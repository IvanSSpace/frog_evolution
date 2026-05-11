import { apiJson } from './client'

export interface MergeResponse {
  ok: true
  gold: string
  locationFrogs: number[][]
  discoveredLevels: number[]
  newLevel: number
  targetLocationId: number // 0 для sentinel
  isSentinel: boolean
  crossLocation: boolean
}

export async function mergeApi(
  fromLevel: number,
  locationId: number,
): Promise<MergeResponse> {
  return apiJson<MergeResponse>('/game/merge', {
    method: 'POST',
    body: JSON.stringify({ fromLevel, locationId }),
  })
}
