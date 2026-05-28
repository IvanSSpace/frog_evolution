import { apiJson } from './client'

export type ClanRole = 'LEADER' | 'COLEADER' | 'MEMBER'
export type ClanRequestType = 'SLIME' | 'ESSENCE' | 'SERUM'

export interface ClanListItem {
  id: number
  name: string
  emblemIcon: string
  emblemColor: string
  minEssence: number
  memberCount: number
}

export interface ClanMemberDto {
  userId: number
  username: string | null
  role: ClanRole
  joinedAt: string
}

export interface ClanMessageDto {
  id: number
  userId: number
  username: string | null
  text: string
  createdAt: string
}

export interface ClanRequestDto {
  id: number
  requesterId: number
  type: ClanRequestType
  element: string | null
  targetAmount: string
  currentAmount: string
  completed: boolean
  createdAt: string
  expiresAt: string
}

export interface ClanPinDto {
  id: number
  authorId: number
  text: string
  missionRef: string | null
  createdAt: string
  expiresAt: string
}

export interface ClanSnapshot {
  clan: {
    id: number
    name: string
    emblemIcon: string
    emblemColor: string
    minEssence: number
    leaderId: number
    createdAt: string
  }
  me: { role: ClanRole }
  members: ClanMemberDto[]
  messages: ClanMessageDto[]
  requests: ClanRequestDto[]
  pin: ClanPinDto | null
}

export interface ClanMeResponse {
  clan: ClanSnapshot['clan'] | null
  cooldownUntil: string | null
  me?: { role: ClanRole }
  members?: ClanMemberDto[]
  messages?: ClanMessageDto[]
  requests?: ClanRequestDto[]
  pin?: ClanPinDto | null
}

async function clanJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const data = await apiJson<T & { error?: string }>(path, options)
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(data.error as string)
  }
  return data
}

export async function fetchClanList(
  search?: string,
  page?: number,
): Promise<{ clans: ClanListItem[]; total: number }> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (page != null) params.set('page', String(page))
  const qs = params.toString()
  return clanJson(`/clan/list${qs ? `?${qs}` : ''}`)
}

export async function fetchClanMe(): Promise<ClanMeResponse> {
  return clanJson('/clan/me')
}

export async function createClan(input: {
  name: string
  emblemIcon: string
  emblemColor: string
  minEssence: number
}): Promise<ClanMeResponse> {
  return clanJson('/clan/create', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function joinClan(id: number): Promise<ClanMeResponse> {
  return clanJson(`/clan/${id}/join`, { method: 'POST' })
}

export async function leaveClan(): Promise<{ ok: true; cooldownUntil: string }> {
  return clanJson('/clan/leave', { method: 'POST' })
}

export async function kickMember(
  clanId: number,
  userId: number,
): Promise<{ ok: true }> {
  return clanJson(`/clan/${clanId}/kick/${userId}`, { method: 'POST' })
}

export async function promoteMember(
  clanId: number,
  userId: number,
): Promise<{ ok: true }> {
  return clanJson(`/clan/${clanId}/promote/${userId}`, { method: 'POST' })
}

export async function demoteMember(
  clanId: number,
  userId: number,
): Promise<{ ok: true }> {
  return clanJson(`/clan/${clanId}/demote/${userId}`, { method: 'POST' })
}

export async function transferLeader(
  clanId: number,
  userId: number,
): Promise<{ ok: true }> {
  return clanJson(`/clan/${clanId}/transfer/${userId}`, { method: 'POST' })
}

export async function fetchMessages(
  clanId: number,
  sinceIso?: string,
): Promise<ClanMessageDto[]> {
  const params = new URLSearchParams()
  if (sinceIso) params.set('since', sinceIso)
  const qs = params.toString()
  return clanJson(`/clan/${clanId}/messages${qs ? `?${qs}` : ''}`)
}

export async function sendMessage(
  clanId: number,
  text: string,
): Promise<ClanMessageDto> {
  return clanJson(`/clan/${clanId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function createRequest(
  clanId: number,
  input: { type: ClanRequestType; element?: string; amount: string },
): Promise<ClanRequestDto> {
  return clanJson(`/clan/${clanId}/requests`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function donate(
  requestId: number,
  amount: string,
): Promise<ClanRequestDto> {
  return clanJson(`/clan/requests/${requestId}/donate`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  })
}

export async function createPin(
  clanId: number,
  input: { text: string; missionRef?: string },
): Promise<ClanPinDto> {
  return clanJson(`/clan/${clanId}/pin`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function deletePin(clanId: number): Promise<{ ok: true }> {
  return clanJson(`/clan/${clanId}/pin`, { method: 'DELETE' })
}
