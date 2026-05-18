// Phase 15 Plan 15-05 Task 1: unit tests for cosmicSettings.
// Phase 28 tech-debt: migrated from top-level `node:assert/strict` ad-hoc
// runner to vitest describe/it (vitest 4 не подбирал старый формат —
// «No test suite found»).
//
// Why install localStorage polyfill manually:
// happy-dom v20 (vitest 4) выставляет globalThis.localStorage как пустой Object
// без Storage-методов (наблюдалось на Node 25 + RTK proxy). Тот же workaround
// уже применяется в client/src/utils/cosmosGate.test.ts. Без него любой вызов
// localStorage.* падает с TypeError. Полифилл ставим ДО dynamic-импорта
// cosmicSettings, иначе module-init может прочитать сломанный API.
//
// gameSync.saveGameState мокается — иначе каждый setter триггерит реальный
// HTTP-вызов (Phase 22 force-sync).

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'

function installLocalStoragePolyfill(): void {
  const store: Record<string, string> = {}
  const ls: Storage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: ls,
    writable: true,
    configurable: true,
  })
}

installLocalStoragePolyfill()

vi.mock('../api/gameSync', () => ({
  saveGameState: vi.fn(async () => true),
}))

const KEY = 'frog_evolution_cosmic_instant_boxes'

let getInstantBoxes: () => boolean
let setInstantBoxes: (v: boolean) => void
let subscribeInstantBoxes: (cb: () => void) => () => void

beforeAll(async () => {
  const mod = await import('./cosmicSettings')
  getInstantBoxes = mod.getInstantBoxes
  setInstantBoxes = mod.setInstantBoxes
  subscribeInstantBoxes = mod.subscribeInstantBoxes
})

describe('cosmicSettings — instantBoxes', () => {
  beforeEach(() => {
    // Each test starts с чистого ключа → детерминированный default.
    localStorage.removeItem(KEY)
  })

  it('Test 1: default false когда нет записи в localStorage', () => {
    expect(getInstantBoxes()).toBe(false)
  })

  it('Test 2: setInstantBoxes(true) → getInstantBoxes() === true', () => {
    setInstantBoxes(true)
    expect(getInstantBoxes()).toBe(true)
  })

  it('Test 3: setInstantBoxes(false) → getInstantBoxes() === false', () => {
    setInstantBoxes(true)
    setInstantBoxes(false)
    expect(getInstantBoxes()).toBe(false)
  })

  it('Test 4: subscribe получает событие на каждый setInstantBoxes', () => {
    let count = 0
    const unsub = subscribeInstantBoxes(() => count++)
    setInstantBoxes(true)
    setInstantBoxes(false)
    expect(count).toBe(2)
    unsub()
  })

  it('Test 5: unsubscribe прекращает доставку событий', () => {
    let count = 0
    const unsub = subscribeInstantBoxes(() => count++)
    setInstantBoxes(true)
    unsub()
    setInstantBoxes(false)
    expect(count).toBe(1)
  })
})
