#!/usr/bin/env node
// Phase 19-06 (I18N-02/I18N-03): verify RU/EN/ES key parity.
// Flatten dotted-path keys из всех 3 файлов; report missing.
// Exit 0 если все 3 покрывают same set; exit 1 при missing.
//
// Usage:
//   node client/scripts/check-translations.cjs
//   npm run check-translations  (alias)

'use strict'

const fs = require('fs')
const path = require('path')

function flatten(obj, prefix) {
  if (!prefix) prefix = ''
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + '.' + k : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out.push(...flatten(v, key))
    } else {
      out.push(key)
    }
  }
  return out
}

function loadLocale(name) {
  const p = path.join(__dirname, '..', 'src', 'i18n', name + '.json')
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    console.error('Failed to load ' + p + ':', e.message)
    process.exit(1)
  }
}

const ru = loadLocale('ru')
const en = loadLocale('en')
const es = loadLocale('es')

const ruKeys = new Set(flatten(ru))
const enKeys = new Set(flatten(en))
const esKeys = new Set(flatten(es))

const allKeys = new Set([...ruKeys, ...enKeys, ...esKeys])

const missingInRu = [...allKeys].filter((k) => !ruKeys.has(k)).sort()
const missingInEn = [...allKeys].filter((k) => !enKeys.has(k)).sort()
const missingInEs = [...allKeys].filter((k) => !esKeys.has(k)).sort()

const report = {
  total_unique_keys: allKeys.size,
  ru_keys: ruKeys.size,
  en_keys: enKeys.size,
  es_keys: esKeys.size,
  missing_in_ru: missingInRu,
  missing_in_en: missingInEn,
  missing_in_es: missingInEs,
}

const hasGaps =
  missingInRu.length > 0 || missingInEn.length > 0 || missingInEs.length > 0

console.log(JSON.stringify(report, null, 2))

if (hasGaps) {
  console.error('\nTranslation parity FAILED')
  process.exit(1)
} else {
  console.error('\nOK: all ' + allKeys.size + ' keys present in RU/EN/ES')
}
