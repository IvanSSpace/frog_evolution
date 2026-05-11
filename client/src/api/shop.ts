import { apiJson } from './client'

interface BuyFrogResponse {
  ok: true
  gold: string
  frogPurchases: number[]
  spent: number
  level: number
}

interface BuyUpgradeResponse {
  ok: true
  gold: string
  upgrades: Record<string, number>
  spent: number
  key: string
  newLevel: number
}

// Throw'ит с сообщением из server response при 4xx/5xx — caller ловит.
export async function buyFrogApi(level: number): Promise<BuyFrogResponse> {
  return apiJson<BuyFrogResponse>('/game/shop/buy-frog', {
    method: 'POST',
    body: JSON.stringify({ level }),
  })
}

export async function buyUpgradeApi(key: string): Promise<BuyUpgradeResponse> {
  return apiJson<BuyUpgradeResponse>('/game/shop/buy-upgrade', {
    method: 'POST',
    body: JSON.stringify({ key }),
  })
}
