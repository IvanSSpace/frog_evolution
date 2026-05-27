import { useState } from 'react'
import { api } from '@/lib/api'

// Цвета по категориям — зеркало клиентского CAT_COLOR (ExpeditionModal).
const CAT_COLOR: Record<string, string> = {
  loot: '#d9a441',
  hazard: '#ff5d6c',
  departure: '#6ec1ff',
  arrival: '#6ec1ff',
  return: '#6ec1ff',
  discovery: '#a7f3d0',
  encounter: '#fcd34d',
  lore: '#c4b5fd',
  travel: '#cbd5e1',
  mundane: '#94a3b8',
}

interface JournalLine {
  time: string
  revealSec: number
  text: string
  category: string
}
interface PreviewResp {
  ok: true
  params: Record<string, unknown>
  journal: JournalLine[]
  loot: {
    gold: number
    serums: Record<string, number>
    mutagen: number
    routes: { common: number; rare: number; epic: number }
  }
  shipLost: boolean
  wreckedAtSec: number | null
  hp: number
  maxHp: number
  risk: number
}

export function ExpeditionPreviewPage() {
  const [seed, setSeed] = useState('')
  const [days, setDays] = useState('0')
  const [hours, setHours] = useState('0')
  const [minutes, setMinutes] = useState('10')
  const [income, setIncome] = useState('100000')
  const [revive, setRevive] = useState('0')
  const [recalled, setRecalled] = useState(false)
  const [data, setData] = useState<PreviewResp | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // дни:часы:минуты → секунды для движка.
  const totalSec =
    ((Number(days) || 0) * 24 + (Number(hours) || 0)) * 3600 +
    (Number(minutes) || 0) * 60

  const run = async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await api.get<PreviewResp>('/admin/expedition/preview', {
        params: {
          seed: seed || undefined,
          sec: totalSec,
          income,
          revive,
          recalled: recalled ? 1 : 0,
        },
      })
      setData(res.data)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Превью экспедиции (баланс)</h1>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <Field label="Seed (пусто=рандом)">
          <input
            className="border rounded px-2 py-1 w-28"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="random"
          />
        </Field>
        <Field label="Дни">
          <input
            className="border rounded px-2 py-1 w-16"
            type="number"
            min="0"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </Field>
        <Field label="Часы">
          <input
            className="border rounded px-2 py-1 w-16"
            type="number"
            min="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </Field>
        <Field label="Минуты">
          <input
            className="border rounded px-2 py-1 w-16"
            type="number"
            min="0"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </Field>
        <span className="text-xs text-gray-500 self-end pb-1.5">
          = {totalSec.toLocaleString('ru-RU')} сек
        </span>
        <Field label="Доход/сек">
          <input
            className="border rounded px-2 py-1 w-28"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
          />
        </Field>
        <Field label="Воскрешений">
          <input
            className="border rounded px-2 py-1 w-16"
            value={revive}
            onChange={(e) => setRevive(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={recalled}
            onChange={(e) => setRecalled(e.target.checked)}
          />
          С возвратом
        </label>
        <button
          onClick={() => void run()}
          disabled={loading}
          className="bg-emerald-600 text-white rounded px-4 py-1.5 font-semibold disabled:opacity-50"
        >
          {loading ? 'Считаю…' : 'Прогнать'}
        </button>
      </div>

      {err && <div className="text-red-600 mb-3">{err}</div>}

      {data && (
        <>
          <div className="text-sm text-gray-700 mb-2 flex flex-wrap gap-x-4 gap-y-1">
            <span>seed: {String(data.params.seed)}</span>
            <span>
              HP: {data.hp}/{data.maxHp}
            </span>
            <span>риск: {Math.round(data.risk * 100)}%</span>
            <span>
              {data.shipLost
                ? `💀 ПОТЕРЯН на ${data.wreckedAtSec}с`
                : '✅ цел'}
            </span>
          </div>
          <div className="text-sm font-semibold mb-3 flex flex-wrap gap-x-4">
            <span>💰 {fmt(data.loot.gold)}</span>
            <span>🧬 {data.loot.mutagen}</span>
            <span>
              🗺️ {data.loot.routes.common}/{data.loot.routes.rare}/
              {data.loot.routes.epic} (об/ред/эп)
            </span>
            <span>
              🧪{' '}
              {Object.entries(data.loot.serums)
                .map(([k, v]) => `${k}:${v}`)
                .join(' ') || '—'}
            </span>
          </div>

          <div
            className="rounded p-3 font-mono text-xs leading-relaxed"
            style={{ background: '#0a1a10', maxHeight: '60vh', overflow: 'auto' }}
          >
            {data.journal.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <span style={{ color: '#5a7a5a', minWidth: 92 }}>
                  {l.time} · {l.revealSec}s
                </span>
                <span style={{ color: CAT_COLOR[l.category] ?? '#7CFC7C' }}>
                  [{l.category}] {l.text}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-600">
      {label}
      {children}
    </label>
  )
}
