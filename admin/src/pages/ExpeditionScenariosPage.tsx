import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'

// Цвета по категориям — зеркало клиентского CAT_COLOR.
const CAT_COLOR: Record<string, string> = {
  loot: '#d9a441',
  hazard: '#ff5d6c',
  departure: '#6ec1ff',
  arrival: '#6ec1ff',
  return: '#6ec1ff',
  discovery: '#10b981',
  encounter: '#f59e0b',
  lore: '#8b5cf6',
  travel: '#64748b',
  mundane: '#94a3b8',
}

interface ScenarioRow {
  pool: string
  id: string
  category: string
  reward: string
  weight: number
  minSec: number
  set: string[]
  needs: string | null
  loot: Record<string, unknown> | null
  lines: string[]
}
interface ScenariosResp {
  ok: true
  total: number
  byCategory: Record<string, number>
  byPool: Record<string, number>
  byReward: Record<string, number>
  hazardDmg: {
    min: number
    max: number
    maxHitFrac: number
    returnFactor: number
  }
  scenarios: ScenarioRow[]
}

// Подписи типов награды.
const REWARD_LABEL: Record<string, string> = {
  none: 'без награды',
  gold: '💰 золото',
  serum: '🧪 сыворотка',
  mutagen: '🧬 мутаген',
  route: '🗺️ маршрут',
}

export function ExpeditionScenariosPage() {
  const [data, setData] = useState<ScenariosResp | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [poolFilter, setPoolFilter] = useState<string | null>(null)
  const [rewardFilter, setRewardFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api
      .get<ScenariosResp>('/admin/expedition/scenarios')
      .then((r) => setData(r.data))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Ошибка'))
  }, [])

  const rows = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.scenarios.filter(
      (s) =>
        (!catFilter || s.category === catFilter) &&
        (!poolFilter || s.pool === poolFilter) &&
        (!rewardFilter || s.reward === rewardFilter) &&
        (!q ||
          s.id.toLowerCase().includes(q) ||
          s.lines.some((l) => l.toLowerCase().includes(q))),
    )
  }, [data, catFilter, poolFilter, rewardFilter, search])

  if (err) return <div className="p-6 text-red-600">{err}</div>
  if (!data) return <div className="p-6">Загрузка…</div>

  const cats = Object.entries(data.byCategory).sort((a, b) => b[1] - a[1])
  const pools = Object.entries(data.byPool)
  const rewards = Object.entries(data.byReward).sort((a, b) => b[1] - a[1])

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Каталог событий</h1>
      <div className="text-sm text-muted-foreground mb-2">
        Всего сценариев: <b>{data.total}</b> · показано:{' '}
        <b>{rows.length}</b>
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        Урон наносят только <b style={{ color: CAT_COLOR.hazard }}>hazard</b>
        -события: <b>{data.hazardDmg.min}–{data.hazardDmg.max} HP</b> при полном
        риске (× текущий риск, × резист брони; обратный путь ×
        {data.hazardDmg.returnFactor}). Кап одного удара —{' '}
        {Math.round(data.hazardDmg.maxHitFrac * 100)}% maxHP (анти-ваншот).
      </div>

      {/* Счётчики по категориям — клик = фильтр */}
      <div className="flex flex-wrap gap-2 mb-3">
        {cats.map(([cat, n]) => (
          <button
            key={cat}
            onClick={() => setCatFilter(catFilter === cat ? null : cat)}
            className="rounded px-2.5 py-1 text-xs font-semibold border"
            style={{
              borderColor: CAT_COLOR[cat] ?? '#999',
              background: catFilter === cat ? CAT_COLOR[cat] ?? '#999' : '#fff',
              color: catFilter === cat ? '#fff' : CAT_COLOR[cat] ?? '#333',
            }}
          >
            {cat}: {n}
          </button>
        ))}
      </div>

      {/* Счётчики по пулам + поиск */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {pools.map(([pool, n]) => (
          <button
            key={pool}
            onClick={() => setPoolFilter(poolFilter === pool ? null : pool)}
            className={`rounded px-2.5 py-1 text-xs border ${
              poolFilter === pool
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-background text-foreground border-border'
            }`}
          >
            {pool}: {n}
          </button>
        ))}
        <input
          className="border rounded px-2 py-1 text-sm ml-auto w-56"
          placeholder="Поиск по id / тексту…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Разбивка по награде — что событие даёт */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground">Награда:</span>
        {rewards.map(([rw, n]) => (
          <button
            key={rw}
            onClick={() => setRewardFilter(rewardFilter === rw ? null : rw)}
            className={`rounded px-2.5 py-1 text-xs border ${
              rewardFilter === rw
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-background text-foreground border-border'
            }`}
          >
            {REWARD_LABEL[rw] ?? rw}: {n}
          </button>
        ))}
      </div>

      {/* Список */}
      <div className="flex flex-col gap-2">
        {rows.map((s) => (
          <div
            key={`${s.pool}-${s.id}`}
            className="border rounded p-3 bg-card text-card-foreground"
            style={{ borderLeft: `4px solid ${CAT_COLOR[s.category] ?? '#999'}` }}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-1">
              <span className="font-mono font-semibold">{s.id}</span>
              <span
                className="rounded px-1.5 py-0.5 font-semibold text-white"
                style={{ background: CAT_COLOR[s.category] ?? '#999' }}
              >
                {s.category}
              </span>
              <span className="text-muted-foreground">пул: {s.pool}</span>
              <span className="text-muted-foreground">вес: {s.weight}</span>
              {s.category === 'hazard' && (
                <span
                  className="rounded px-1.5 py-0.5 font-semibold text-white"
                  style={{ background: CAT_COLOR.hazard }}
                >
                  💥 {data.hazardDmg.min}–{data.hazardDmg.max} HP
                </span>
              )}
              {s.minSec > 0 && (
                <span className="text-muted-foreground">
                  с {(s.minSec / 60).toFixed(0)}мин
                </span>
              )}
              {s.needs && (
                <span className="text-amber-600">needs: {s.needs}</span>
              )}
              {s.set.length > 0 && (
                <span className="text-blue-600">set: {s.set.join(',')}</span>
              )}
              {s.loot && (
                <span className="text-emerald-700">
                  лут: {JSON.stringify(s.loot)}
                </span>
              )}
            </div>
            <div className="text-sm text-foreground flex flex-col gap-0.5">
              {s.lines.map((l, i) => (
                <div key={i}>· {l}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
