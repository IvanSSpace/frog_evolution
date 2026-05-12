import { apiJson } from './client'
import type { CarrierData, Element, Rarity } from '../store/cosmic/types'

interface ApplySerumResponse {
  ok: true
  carrier: CarrierData
  serums: Record<Element, Record<Rarity, number>>
}

/** Server-validated применение сыворотки. Сервер проверяет:
 *  - element/rarity валидны
 *  - level frog'а совпадает с rarity (common→L1, rare→L7, epic→L13)
 *  - сыворотка есть в инвентаре (>= 1)
 *  - frog не уже carrier
 * При ошибке throw'ит с message из server response.
 */
export async function applySerumApi(
  frogId: string,
  element: Element,
  rarity: Rarity,
  level: number,
): Promise<ApplySerumResponse> {
  return apiJson<ApplySerumResponse>('/game/cosmic/apply-serum', {
    method: 'POST',
    body: JSON.stringify({ frogId, element, rarity, level }),
  })
}
