#!/usr/bin/env node
// Phase 18: smoke verify — проверяет что Phase 18 артефакты ship-готовы.
// Run: node client/scripts/smoke_bestiary.cjs

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const cwd = path.join(__dirname, '..')

function exists(p) {
  return fs.existsSync(path.join(cwd, p))
}

function fileContains(p, s) {
  if (!exists(p)) return false
  return fs.readFileSync(path.join(cwd, p), 'utf8').includes(s)
}

const checks = [
  { name: 'bestiary.ts countUnlocked', test: () => fileContains('src/store/cosmic/bestiary.ts', 'export function countUnlocked') },
  { name: 'bestiary.ts BESTIARY_MILESTONES', test: () => fileContains('src/store/cosmic/bestiary.ts', 'BESTIARY_MILESTONES') },
  { name: 'bestiary.ts milestonesCrossed', test: () => fileContains('src/store/cosmic/bestiary.ts', 'milestonesCrossed') },
  { name: 'slice.ts setBestiaryBit', test: () => fileContains('src/store/cosmic/slice.ts', 'setBestiaryBit') },
  { name: 'slice.ts emits cosmic:bestiary-milestone', test: () => fileContains('src/store/cosmic/slice.ts', 'cosmic:bestiary-milestone') },
  { name: 'eventBus has bestiary-milestone', test: () => fileContains('src/store/eventBus.ts', 'cosmic:bestiary-milestone') },
  { name: 'BestiaryTab full impl', test: () => fileContains('src/components/CosmicHub/BestiaryTab.tsx', 'LOCATION_TABS') },
  { name: 'BestiaryGrid TanStack', test: () => fileContains('src/components/CosmicHub/bestiary/BestiaryGrid.tsx', 'useVirtualizer') },
  { name: 'BestiaryCell', test: () => exists('src/components/CosmicHub/bestiary/BestiaryCell.tsx') },
  { name: 'BestiaryDetailModal full', test: () => fileContains('src/components/CosmicHub/bestiary/BestiaryDetailModal.tsx', 'AwakenedPreviewCanvas') },
  { name: 'AwakenedPreviewCanvas', test: () => exists('src/components/CosmicHub/bestiary/AwakenedPreviewCanvas.tsx') },
  { name: 'MilestoneToast', test: () => exists('src/components/CosmicHub/bestiary/MilestoneToast.tsx') },
  { name: '@tanstack/react-virtual installed', test: () => fileContains('package.json', '@tanstack/react-virtual') },
  { name: 'i18n RU bestiary', test: () => fileContains('src/i18n/ru.json', 'location_swamp') && fileContains('src/i18n/ru.json', 'milestone_10') },
  { name: 'i18n EN bestiary', test: () => fileContains('src/i18n/en.json', 'location_swamp') && fileContains('src/i18n/en.json', 'milestone_10') },
  { name: 'i18n ES bestiary', test: () => fileContains('src/i18n/es.json', 'location_swamp') && fileContains('src/i18n/es.json', 'milestone_10') },
  { name: 'devHelpers __unlockBestiaryCells', test: () => fileContains('src/utils/devHelpers.ts', '__unlockBestiaryCells') },
  { name: 'App.tsx mounts MilestoneToast', test: () => fileContains('src/App.tsx', '<MilestoneToast') },
]

let failed = 0
for (const c of checks) {
  const ok = c.test()
  console.log(`${ok ? '✓' : '✗'} ${c.name}`)
  if (!ok) failed++
}

console.log(`\n${checks.length - failed}/${checks.length} passed`)

if (failed > 0) {
  console.error(`FAIL: ${failed} checks failed`)
  process.exit(1)
}

// Run tsc as final check
console.log('\nRunning tsc --noEmit...')
try {
  execSync('npx tsc --noEmit', { cwd, stdio: 'inherit' })
} catch {
  console.error('FAIL: tsc errors')
  process.exit(1)
}

console.log('\nALL SMOKE CHECKS PASSED ✓')
process.exit(0)
