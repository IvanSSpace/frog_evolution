import { apiJson } from './client'
import type { CarrierData, Element } from '../store/cosmic/types'

interface ApplySerumResponse {
  ok: true
  carrier: CarrierData
  serums: Record<Element, number>
}

/** Server-validated применение сыворотки.
 * Phase 22: rarity removed. Сервер проверяет:
 *  - element валиден
 *  - level валиден (1-24)
 *  - сыворотка есть в инвентаре (>= 1)
 *  - frog не уже carrier
 * При ошибке throw'ит с message из server response.
 */
export async function applySerumApi(
  frogId: string,
  element: Element,
  level: number,
): Promise<ApplySerumResponse> {
  return apiJson<ApplySerumResponse>('/game/cosmic/apply-serum', {
    method: 'POST',
    body: JSON.stringify({ frogId, element, level }),
  })
}
