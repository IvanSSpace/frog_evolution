// Phase 15: BoxesTab — inventory непрочитанных боксов с element-icon + planet-name.
// Tap на box → mounts lazy CascadeRevealModal с onComplete callback.
// При boxes.length >= 5 — показывается «Открыть все» button → bulk-open flow.

import { useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../store/gameStore'
import type { BoxData } from '../../store/cosmic/types'
import { ELEMENT_TINT } from './ElementGrid'
import type { BulkOpenResult } from './BulkOpenSummary'

// Lazy-loaded modals — отдельные chunks (PERF-08).
const CascadeRevealModal = lazy(() => import('./CascadeRevealModal'))
const BulkOpenSummary = lazy(() => import('./BulkOpenSummary'))

interface Props {
  onClose: () => void // Закрыть Cosmic Hub при tap на box / open-all
}

export function BoxesTab({ onClose }: Props) {
  const { t } = useTranslation()
  const allBoxes = useGameStore((s) => s.boxes)
  const rollBoxRarity = useGameStore((s) => s.rollBoxRarity)
  const commitOpenedBox = useGameStore((s) => s.commitOpenedBox)

  // Filter: unopened only, sort by createdAt DESC (новые первыми).
  const boxes = allBoxes
    .filter((b) => !b.opened)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)

  const [activeBox, setActiveBox] = useState<BoxData | null>(null)
  const [bulkResults, setBulkResults] = useState<BulkOpenResult[] | null>(null)

  const handleTapBox = (box: BoxData) => {
    setActiveBox(box)
    onClose() // close Cosmic Hub чтобы CascadeRevealModal видна на full screen
  }

  const handleCascadeComplete = () => {
    setActiveBox(null)
    // Box уже remove'нут в store (commitOpenedBox); никаких дополнительных действий.
  }

  const handleOpenAll = () => {
    // Snapshot current unopened boxes (before mutation).
    const snapshot = boxes.slice()
    const results: BulkOpenResult[] = []

    for (const box of snapshot) {
      const rolled = rollBoxRarity(box.id)
      if (!rolled) continue
      commitOpenedBox(box.id)
      results.push({
        element: rolled.element,
        planetName: box.planetName,
      })
    }

    setBulkResults(results)
    onClose() // close Hub чтобы BulkOpenSummary видна fullscreen
  }

  const handleBulkClose = () => {
    setBulkResults(null)
  }

  // Empty state
  if (boxes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/60 px-6">
        <div className="text-4xl">🎁</div>
        <p className="text-sm text-center">
          {t('cosmic_hub.boxes.empty_placeholder')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-3 py-3 overflow-y-auto h-full">
        {/* Open-all button (≥5 boxes) — REQ SLOT-07 bulk-open */}
        {boxes.length >= 5 && (
          <button
            data-testid="boxes-open-all"
            onClick={handleOpenAll}
            className="ff-btn ff-btn-green text-sm py-2 w-full"
          >
            {t('cosmic_hub.boxes.open_all', { count: boxes.length })}
          </button>
        )}

        {/* Box list */}
        <div className="flex flex-col gap-2">
          {boxes.map((box) => (
            <BoxCard key={box.id} box={box} onTap={() => handleTapBox(box)} />
          ))}
        </div>
      </div>

      {/* Lazy-mounted cascade modal (single box flow) */}
      {activeBox && (
        <Suspense fallback={null}>
          <CascadeRevealModal
            box={activeBox}
            onComplete={handleCascadeComplete}
          />
        </Suspense>
      )}

      {/* Lazy-mounted bulk summary (open-all flow) */}
      {bulkResults && (
        <Suspense fallback={null}>
          <BulkOpenSummary results={bulkResults} onClose={handleBulkClose} />
        </Suspense>
      )}
    </>
  )
}

interface BoxCardProps {
  box: BoxData
  onTap: () => void
}

function BoxCard({ box, onTap }: BoxCardProps) {
  const { t } = useTranslation()
  const tint = ELEMENT_TINT[box.element] ?? '#888'
  const bonusBadge = box.bonusRarity ? t(`rarity.${box.bonusRarity}`) : null

  return (
    <button
      onClick={onTap}
      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 border-2"
      style={{ borderColor: tint }}
    >
      {/* Element tint dot */}
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          backgroundColor: tint,
          boxShadow: `0 0 12px ${tint}aa`,
        }}
      >
        <span style={{ fontSize: 18 }}>🎁</span>
      </div>

      {/* Box info */}
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-bold text-white truncate">
          {t(`cosmic_hub.elements.${box.element}`)}
        </div>
        <div className="text-xs text-white/60 truncate">
          {t('cosmic_hub.boxes.from_planet', { planet: box.planetName })}
        </div>
      </div>

      {/* Bonus rarity badge (if any) */}
      {bonusBadge && (
        <span
          className="text-xs font-bold px-2 py-1 rounded uppercase"
          style={{
            backgroundColor: bonusBadgeColor(box.bonusRarity!),
            color: 'white',
          }}
        >
          +{bonusBadge}
        </span>
      )}

      {/* Tap-to-open hint */}
      <span className="text-xs text-white/40 flex-shrink-0">
        {t('cosmic_hub.boxes.tap_to_open')}
      </span>
    </button>
  )
}

function bonusBadgeColor(rarity: 'rare' | 'epic' | 'legendary'): string {
  switch (rarity) {
    case 'rare':
      return '#3b82f6'
    case 'epic':
      return '#a855f7'
    case 'legendary':
      return '#f59e0b'
  }
}
