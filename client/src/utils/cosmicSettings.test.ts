// Phase 15 Plan 15-05 Task 1: unit tests for cosmicSettings.
// Run: tsx client/src/utils/cosmicSettings.test.ts
//
// Polyfill localStorage + window.{Custom}Event для Node environment.

import assert from 'node:assert/strict'

const store: Record<string, string> = {}
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = v
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
} as Storage

const listeners = new Map<string, Set<EventListener>>()
;(globalThis as { window?: Window }).window = {
  addEventListener: (type: string, cb: EventListener) => {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type)!.add(cb)
  },
  removeEventListener: (type: string, cb: EventListener) => {
    listeners.get(type)?.delete(cb)
  },
  dispatchEvent: (ev: Event) => {
    listeners.get(ev.type)?.forEach((cb) => cb(ev))
    return true
  },
} as Window
;(globalThis as { CustomEvent?: typeof CustomEvent }).CustomEvent =
  class CustomEventPolyfill {
    type: string
    constructor(type: string) {
      this.type = type
    }
  } as unknown as typeof CustomEvent

const { getInstantBoxes, setInstantBoxes, subscribeInstantBoxes } =
  await import('./cosmicSettings')

// Test 1: default false
assert.equal(getInstantBoxes(), false, 'Test 1: default false')

// Test 2: set true
setInstantBoxes(true)
assert.equal(getInstantBoxes(), true, 'Test 2: set true')

// Test 3: set false
setInstantBoxes(false)
assert.equal(getInstantBoxes(), false, 'Test 3: set false')

// Test 4: subscribe receives event
let count = 0
const unsub = subscribeInstantBoxes(() => count++)
setInstantBoxes(true)
setInstantBoxes(false)
assert.equal(count, 2, 'Test 4: subscribe count = 2')

// Test 5: unsubscribe stops events
unsub()
setInstantBoxes(true)
assert.equal(count, 2, 'Test 5: count still 2 after unsub')

console.log('All cosmicSettings tests passed.')
