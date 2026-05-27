import { apiJson } from './client'

// Mirrors server src/expedition + routes/expedition.ts "Expedition View".
export type ExpeditionPhase = 'outbound' | 'returning' | 'arrived' | 'lost'

export interface JournalLine {
  time: string // "ЧЧ:ММ" since departure (Fallout-Shelter-style log clock)
  text: string
  category: string
  revealSec: number // real seconds since departure when the line should appear
}

export interface ExpeditionView {
  id: number
  seed: number
  phase: ExpeditionPhase
  status: string
  startedAt: string
  recalledAt: string | null
  arrivalAt: string | null
  outboundSec: number
  risk: number // 0..1
  shipLost: boolean
  hp: number
  maxHp: number
  canRecall: boolean
  canClaim: boolean
  canRevive: boolean
  reviveCost: number
  loot: { gold: number; serums: Record<string, number>; mutagen: number }
  journal: JournalLine[]
}

export interface ShipUpg {
  corpus: number
  armor: number
  engine: number
  scanner: number
}

export interface ShipView {
  id: number
  name: string
  upg: ShipUpg
  stats: { speed: number; luck: number; cargo: number; hull: number }
  maxHp: number
  activeExpeditionId: number | null
  upgCosts: Record<string, number | null>
  maxUpg: number
}

interface OneResp {
  ok: true
  expedition: ExpeditionView
}
interface ListResp {
  ok: true
  expeditions: ExpeditionView[]
}
interface ClaimResp {
  ok: true
  shipLost: boolean
  loot: { gold: number; serums: Record<string, number>; mutagen: number }
}

// demo=true → minute-scale tempo (instant rich log) for testing the feature.
export function startExpedition(
  demo = false,
  shipId?: number,
  crew: number[] = [],
): Promise<OneResp> {
  return apiJson<OneResp>('/expedition/start', {
    method: 'POST',
    body: JSON.stringify({ demo, shipId, crew }),
  })
}

export function getActiveExpeditions(): Promise<ListResp> {
  return apiJson<ListResp>('/expedition/active')
}

export function getShips(): Promise<{ ok: true; ships: ShipView[] }> {
  return apiJson('/expedition/ships')
}

export function upgradeShip(
  shipId: number,
  stat: keyof ShipUpg,
): Promise<{ ok: true; gold: string; ship: ShipView }> {
  return apiJson('/expedition/ship/upgrade', {
    method: 'POST',
    body: JSON.stringify({ shipId, stat }),
  })
}

// Body '{}' is required: apiFetch always sets Content-Type: application/json,
// and Fastify 400s on an empty body with that header (FST_ERR_CTP_EMPTY_JSON_BODY).
export function recallExpedition(id: number): Promise<OneResp> {
  return apiJson<OneResp>(`/expedition/${id}/recall`, {
    method: 'POST',
    body: '{}',
  })
}

// Отмена возврата (мисклик) — снова летим вперёд с той же секунды.
export function continueExpedition(id: number): Promise<OneResp> {
  return apiJson<OneResp>(`/expedition/${id}/continue`, {
    method: 'POST',
    body: '{}',
  })
}

// Воскресить разбитый корабль за золото — HP восстановлено, лут цел, летим дальше.
export function reviveExpedition(id: number): Promise<OneResp> {
  return apiJson<OneResp>(`/expedition/${id}/revive`, {
    method: 'POST',
    body: '{}',
  })
}

export function claimExpedition(id: number): Promise<ClaimResp> {
  return apiJson<ClaimResp>(`/expedition/${id}/claim`, {
    method: 'POST',
    body: '{}',
  })
}
