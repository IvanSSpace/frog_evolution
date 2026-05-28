import { useState, useEffect, useCallback, useRef } from 'react'
import { useClanStore } from '../../store/clan/slice'
import { useGameStore } from '../../store/gameStore'
import { fetchClanList } from '../../api/clan'
import { ClanListItem } from './ClanListItem'
import { CreateClanDialog } from './CreateClanDialog'

const PAGE_SIZE = 20

function formatCountdown(until: Date): string {
  const diff = Math.max(0, until.getTime() - Date.now())
  const totalSec = Math.floor(diff / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function NoClanView() {
  const list = useClanStore((s) => s.list)
  const listTotal = useClanStore((s) => s.listTotal)
  const setList = useClanStore((s) => s.setList)
  const cooldownUntil = useClanStore((s) => s.cooldownUntil)
  const playerEssence = useGameStore((s) => s.essence)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [, setTick] = useState(0)

  const cooldownDate = cooldownUntil ? new Date(cooldownUntil) : null
  const cooldownActive = cooldownDate != null && cooldownDate > new Date()

  useEffect(() => {
    if (!cooldownActive) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [cooldownActive])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadList = useCallback(
    (q: string, p: number) => {
      fetchClanList(q || undefined, p)
        .then((r) => setList(r.clans, r.total))
        .catch(console.error)
    },
    [setList],
  )

  useEffect(() => {
    loadList('', 0)
  }, [loadList])

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadList(value, 0)
    }, 300)
  }

  function handlePage(delta: number) {
    const newPage = page + delta
    if (newPage < 0) return
    if (newPage * PAGE_SIZE >= listTotal) return
    setPage(newPage)
    loadList(search, newPage)
  }

  const totalPages = Math.ceil(listTotal / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      {/* Cooldown banner */}
      {cooldownActive && cooldownDate && (
        <div
          className="ff-card px-3 py-2 text-xs"
          style={{ color: '#92400e', borderColor: '#b45309' }}
        >
          ⏳ Смена клана недоступна до {formatCountdown(cooldownDate)}
        </div>
      )}

      {/* Sub-header: search + create */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Поиск союза..."
          className="flex-1 text-sm focus:outline-none"
          style={{
            border: '2px solid #8b6914',
            background: 'rgba(255,253,230,0.9)',
            borderRadius: 999,
            padding: '8px 14px',
            color: '#2f1f0e',
          }}
        />
        <button
          onClick={() => setShowCreate(true)}
          className="ff-btn ff-btn-amber flex-shrink-0 text-xs py-2 px-3"
        >
          Создать (3💎)
        </button>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {list.length === 0 ? (
          <div className="text-center py-6" style={{ color: '#7a5a2f' }}>Союзов не найдено</div>
        ) : (
          list.map((item) => {
            const isFull = item.memberCount >= 30
            const noEssence = item.minEssence > 0 && playerEssence < item.minEssence
            const isDisabled = cooldownActive || isFull || noEssence
            let reason: 'cooldown' | 'essence' | 'full' | null = null
            if (cooldownActive) reason = 'cooldown'
            else if (isFull) reason = 'full'
            else if (noEssence) reason = 'essence'

            return (
              <ClanListItem
                key={item.id}
                item={item}
                disabled={isDisabled}
                disabledReason={reason}
              />
            )
          })
        )}
      </div>

      {/* Pagination */}
      {listTotal > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={() => handlePage(-1)}
            disabled={page === 0}
            className="ff-btn ff-btn-grey text-xs py-1.5 px-3"
          >
            {'<'}
          </button>
          <span className="text-xs ff-display" style={{ color: '#7a5a2f' }}>Стр. {page + 1}/{totalPages}</span>
          <button
            onClick={() => handlePage(1)}
            disabled={(page + 1) * PAGE_SIZE >= listTotal}
            className="ff-btn ff-btn-grey text-xs py-1.5 px-3"
          >
            {'>'}
          </button>
        </div>
      )}

      {showCreate && (
        <CreateClanDialog
          playerEssence={playerEssence}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
