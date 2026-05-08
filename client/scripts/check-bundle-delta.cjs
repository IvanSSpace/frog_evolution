#!/usr/bin/env node
// Phase 19-07 (PERF-05, PERF-07): bundle delta vs v1.0 baseline + lazy chunk verify.
//
// Usage:
//   1. cd client && npm run build  (сначала)
//   2. node scripts/check-bundle-delta.cjs
//
// Exits 0 если:
//   - delta (current - baseline) ≤ capDeltaBytes (50 KB)
//   - expected lazy chunks (CosmicHubModal) присутствуют

'use strict'

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const baselinePath = path.join(__dirname, '.bundle-baseline-v1.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))

const distDir = path.join(__dirname, '..', 'dist', 'assets')
if (!fs.existsSync(distDir)) {
  console.error('dist/assets not found: ' + distDir)
  console.error('Run `cd client && npm run build` first')
  process.exit(1)
}

const allFiles = fs.readdirSync(distDir).filter((f) => f.endsWith('.js'))
const indexFiles = allFiles.filter((f) => /^index-.+\.js$/.test(f))
if (indexFiles.length !== 1) {
  console.error('expected 1 index-*.js, found ' + indexFiles.length + ': ' + indexFiles)
  process.exit(1)
}

const mainPath = path.join(distDir, indexFiles[0])
const mainBuf = fs.readFileSync(mainPath)
const mainGzip = zlib.gzipSync(mainBuf).length

const otherChunks = allFiles.filter((f) => !f.startsWith('index-'))
const chunkInfo = otherChunks.map((f) => {
  const buf = fs.readFileSync(path.join(distDir, f))
  return { name: f, gzip: zlib.gzipSync(buf).length }
})

// Expected lazy chunks (verified separately for PERF-07).
// CosmicHubModal — guaranteed lazy chunk (Phase 11).
// BestiaryV2Tab not separated (lives inside CosmicHubModal chunk after Phase 18).
const expectedChunks = ['CosmicHubModal']
const missingChunks = expectedChunks.filter(
  (name) => !otherChunks.some((f) => f.includes(name)),
)

const delta = mainGzip - baseline.indexJsGzip
const cap = baseline.capDeltaBytes != null ? baseline.capDeltaBytes : 50 * 1024
const capPassed = delta <= cap

const report = {
  baseline_v1_gzip: baseline.indexJsGzip,
  current_main_gzip: mainGzip,
  delta_bytes: delta,
  delta_kb: +(delta / 1024).toFixed(2),
  cap_bytes: cap,
  cap_kb: cap / 1024,
  cap_passed: capPassed,
  expected_lazy_chunks: expectedChunks,
  missing_chunks: missingChunks,
  actual_chunks: chunkInfo.sort((a, b) => b.gzip - a.gzip),
}

console.log(JSON.stringify(report, null, 2))

const errors = []
if (!capPassed) {
  errors.push('Bundle delta ' + report.delta_kb + 'KB exceeds cap ' + cap / 1024 + 'KB')
}
if (missingChunks.length > 0) {
  errors.push('Missing expected lazy chunks: ' + missingChunks.join(', '))
}

if (errors.length > 0) {
  console.error('\nBundle audit FAILED')
  for (const e of errors) console.error('  -', e)
  process.exit(1)
}
console.error('\nOK: Bundle delta ' + report.delta_kb + 'KB within cap ' + cap / 1024 + 'KB')
console.error('OK: Lazy chunks present: ' + expectedChunks.join(', '))
