import { apiJson } from './client'

// Server snapshot. gold приходит как string (BigInt) — клиент преобразует при необходимости.
// upgrades: на сервере хранится как Json (Record<string, number>), клиент конвертирует
// через toUpgrades() при необходимости. При отправке в PUT клиент может посылать как
// Upgrades, так и Record<string, number> — JSON-сериализация идентична.
export interface ServerGameState {
  id: number
  userId: number
  gold: string
  upgrades: Record<string, number>
  frogPurchases: number[]
  discoveredLevels: number[]
  magnetEnabled: boolean
  currentLocation: number
  locationFrogs: number[][]
  boxOpenCount: number
  cosmic: unknown | null
  incomePerSec: number
  // Server-computed offline income при boot (только в GET response):
  offlineIncome?: string // BigInt-string
  offlineMs?: number
  elapsedMs?: number
  lastSessionAt: string
  createdAt: string
  updatedAt: string
}

export async function getServerGameState(): Promise<ServerGameState> {
  return apiJson<ServerGameState>('/game/state')
}

export async function putServerGameState(
  patch: Partial<
    Omit<ServerGameState, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  >,
): Promise<ServerGameState> {
  return apiJson<ServerGameState>('/game/state', {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}
