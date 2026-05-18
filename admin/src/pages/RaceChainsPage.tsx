// Phase 29 Plan 29-07: Race Chains admin page.
// Visualizes all ChainItem entries from race chains in order.
// 10 races × 20 items = 200 rows total. TanStack Virtual for smooth scroll.

import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ─── Types (matching server/src/data/chains.ts) ───────────────────────────────

type RaceId =
  | 'crystalloids'
  | 'gasouls'
  | 'mechanidons'
  | 'fireworms'
  | 'liquidoids'
  | 'tenebrians'
  | 'plasmaspirits'
  | 'forestcores'
  | 'timeweavers'
  | 'cometfolk'

type ChainItemType = 'msg' | 'dialog' | 'quest_hook' | 'event'

interface ChainItemSerialized {
  type: ChainItemType
  step: number
  text_key: string
  text?: string
  accept_delta?: number
  refuse_delta?: number
  quest_id?: string
  target?: RaceId | 'self'
  delta?: number
  description?: string
}

interface QuestRewardSerialized {
  kind: 'essence' | 'serum' | 'gold' | 'relationship_and_bonus'
  value?: number
  element?: string
  count?: number
  raceId?: string
  bonus_id?: string
}

interface QuestConfigSerialized {
  id: string
  raceId: RaceId
  type: 'delivery' | 'exploration' | 'merge' | 'diplomacy'
  target: Record<string, unknown>
  reward: QuestRewardSerialized
  description_key: string
  short_key: string
  difficulty: 'easy' | 'medium' | 'hard'
}

interface RaceChainResponse {
  id: RaceId
  name: string
  emojiIcon: string
  chain: ChainItemSerialized[]
}

interface ChainsResponse {
  races: RaceChainResponse[]
  quests: QuestConfigSerialized[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<ChainItemType, string> = {
  msg: '📩',
  dialog: '💬',
  quest_hook: '📋',
  event: '⚡',
}

const TYPE_LABELS: Record<ChainItemType, string> = {
  msg: 'Message',
  dialog: 'Dialog',
  quest_hook: 'Quest Hook',
  event: 'Event',
}

const TYPE_COLORS: Record<ChainItemType, string> = {
  msg: 'text-muted-foreground',
  dialog: 'text-blue-500',
  quest_hook: 'text-amber-500',
  event: 'text-red-500',
}

const DIFFICULTY_BADGE: Record<string, string> = {
  easy: 'bg-green-500/10 text-green-600',
  medium: 'bg-amber-500/10 text-amber-600',
  hard: 'bg-red-500/10 text-red-600',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatReward(reward: QuestRewardSerialized): string {
  switch (reward.kind) {
    case 'essence':
      return `+${reward.value} essence`
    case 'serum':
      return `+${reward.count} ${reward.element} serum`
    case 'gold':
      return `+${(reward.value ?? 0).toLocaleString()} gold`
    case 'relationship_and_bonus':
      return `rel + bonus:${reward.bonus_id}`
    default:
      return '?'
  }
}

function formatTarget(target: Record<string, unknown>): string {
  const kind = target.kind as string
  switch (kind) {
    case 'serum_count':
      return `${target.value}x ${target.element} serum`
    case 'gold_amount':
      return `${(target.value as number).toLocaleString()} gold`
    case 'planets_visited':
      return `visit ${target.value} planets`
    case 'missions_complete':
      return `${target.value} missions`
    case 'merge_to_level':
      return `merge to L${target.level}`
    case 'merge_count':
      return `${target.value} merges`
    case 'raise_relationship':
      return `rel ≥ tier ${target.tier} w/ ${target.raceId}`
    default:
      return kind
  }
}

// ─── Row component ────────────────────────────────────────────────────────────

interface ChainRowProps {
  item: ChainItemSerialized
  quest: QuestConfigSerialized | undefined
}

function ChainRow({ item, quest }: ChainRowProps) {
  return (
    <div className="grid grid-cols-[3rem_5rem_7rem_1fr_1fr] gap-2 px-3 py-2 border-b border-border text-sm items-start hover:bg-accent/30 transition-colors">
      {/* Step */}
      <span className="tabular-nums text-muted-foreground font-mono text-xs pt-0.5">
        {String(item.step).padStart(2, '0')}
      </span>

      {/* Type icon + badge */}
      <span className={`font-medium flex items-center gap-1 ${TYPE_COLORS[item.type]}`}>
        <span role="img" aria-label={item.type}>{TYPE_ICONS[item.type]}</span>
        <span className="text-xs hidden sm:inline">{TYPE_LABELS[item.type]}</span>
      </span>

      {/* Delta annotation */}
      <span className="text-xs text-muted-foreground pt-0.5">
        {item.type === 'dialog' || item.type === 'quest_hook' ? (
          <span>
            <span className="text-green-500">+{item.accept_delta}</span>
            {' / '}
            <span className="text-red-500">{item.refuse_delta}</span>
          </span>
        ) : item.type === 'event' ? (
          <span className="text-red-500">{item.delta}</span>
        ) : null}
      </span>

      {/* Text / description */}
      <span className="text-foreground leading-relaxed">
        {item.type === 'event' ? (
          <span className="italic text-muted-foreground">{item.description}</span>
        ) : (
          item.text ?? <span className="text-muted-foreground/50">{item.text_key}</span>
        )}
        {item.type === 'quest_hook' && item.quest_id && (
          <span className="ml-2 text-xs text-amber-400 font-mono">[{item.quest_id}]</span>
        )}
      </span>

      {/* Reward preview (quest_hook only) */}
      <span className="text-xs">
        {quest ? (
          <span className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">{formatTarget(quest.target)}</span>
            <span className="font-medium text-foreground">{formatReward(quest.reward)}</span>
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${DIFFICULTY_BADGE[quest.difficulty] ?? ''}`}>
              {quest.difficulty}
            </span>
          </span>
        ) : null}
      </span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function RaceChainsPage() {
  const [selectedRaceId, setSelectedRaceId] = useState<RaceId>('crystalloids')

  const { data, isLoading, isError } = useQuery<ChainsResponse>({
    queryKey: ['admin', 'chains'],
    queryFn: async () => {
      const res = await api.get<ChainsResponse>('/admin/chains')
      return res.data
    },
    staleTime: 5 * 60 * 1000, // 5 min — chain config doesn't change often
  })

  const selectedRace = data?.races.find((r) => r.id === selectedRaceId)
  const questsById = data
    ? Object.fromEntries(data.quests.map((q) => [q.id, q]))
    : {}

  const items = selectedRace?.chain ?? []

  // ─── TanStack Virtual ───────────────────────────────────────────────────────

  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-foreground">Race Chains</h1>
      <p className="text-sm text-muted-foreground">
        10 races × 20 items = 200 total chain entries. Select a race to browse its chain.
      </p>

      {/* Race selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground shrink-0" htmlFor="race-select">
          Race
        </label>
        <Select
          value={selectedRaceId}
          onValueChange={(v) => setSelectedRaceId(v as RaceId)}
        >
          <SelectTrigger id="race-select" className="w-56" aria-label="Select race">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(data?.races ?? []).map((race) => (
              <SelectItem key={race.id} value={race.id}>
                <span className="flex items-center gap-2">
                  <span>{race.emojiIcon}</span>
                  <span>{race.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedRace && (
          <span className="text-sm text-muted-foreground">
            {selectedRace.chain.length} items
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading chain data...
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardContent className="py-12 text-center text-destructive">
            Failed to load chains. Check server connection.
          </CardContent>
        </Card>
      )}

      {data && selectedRace && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span>{selectedRace.emojiIcon}</span>
              <span>{selectedRace.name}</span>
              <span className="text-sm font-normal text-muted-foreground">— {selectedRace.id}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Column headers */}
            <div className="grid grid-cols-[3rem_5rem_7rem_1fr_1fr] gap-2 px-3 py-1.5 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>#</span>
              <span>Type</span>
              <span>Delta</span>
              <span>Text / Description</span>
              <span>Reward (quest)</span>
            </div>

            {/* Virtualized list */}
            <div
              ref={parentRef}
              className="overflow-auto"
              style={{ height: '520px' }}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualItems.map((virtualRow) => {
                  const item = items[virtualRow.index]
                  const quest =
                    item.type === 'quest_hook' && item.quest_id
                      ? questsById[item.quest_id]
                      : undefined
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <ChainRow item={item} quest={quest} />
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
