// Phase 18: virtualized grid рендерит cells через TanStack Virtual.
// Layout: COLS колонок × ceil(cells / COLS) rows.

import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { BestiaryCell } from './BestiaryCell'
import type { BestiaryCellRef } from './useBestiaryView'
import { BESTIARY_GRID_COLS } from './useBestiaryView'
import type { Element, Rarity } from '../../../store/cosmic/types'

const CELL_SIZE = 64
const GAP = 8
const ROW_HEIGHT = CELL_SIZE + GAP // 72px

interface Props {
  cells: BestiaryCellRef[]
  onCellTap: (element: Element, rarity: Rarity, level: number) => void
}

export function BestiaryGrid({ cells, onCellTap }: Props) {
  const { t } = useTranslation()
  const parentRef = useRef<HTMLDivElement>(null)

  const rowCount = Math.ceil(cells.length / BESTIARY_GRID_COLS)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  })

  if (cells.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 text-white/40 px-6 py-12">
        <div className="text-4xl">🔍</div>
        <p className="text-sm text-center">
          {t('cosmic_hub.bestiary.empty_state')}
        </p>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto px-2 py-2"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtRow) => {
          const startIdx = virtRow.index * BESTIARY_GRID_COLS
          const endIdx = Math.min(startIdx + BESTIARY_GRID_COLS, cells.length)
          const rowCells = cells.slice(startIdx, endIdx)

          return (
            <div
              key={virtRow.key}
              data-row-index={virtRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ROW_HEIGHT,
                transform: `translateY(${virtRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${BESTIARY_GRID_COLS}, ${CELL_SIZE}px)`,
                gap: GAP,
                justifyContent: 'center',
              }}
            >
              {rowCells.map((cell) => (
                <BestiaryCell
                  key={cell.key}
                  element={cell.element}
                  rarity={cell.rarity}
                  level={cell.level}
                  unlocked={cell.unlocked}
                  onTap={onCellTap}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
