// Phase 18: filter pills + element search + sort + locked toggle.
// Stateless — все из props.

import { useTranslation } from 'react-i18next'
import { RARITIES, type Rarity } from '../../../store/cosmic/types'
import { RARITY_LABEL_KEY } from './rarityStyles'
import type { SortKey } from './useBestiaryView'

interface Props {
  rarityFilter: Rarity | 'all'
  onRarityFilter: (r: Rarity | 'all') => void
  elementSearch: string
  onElementSearch: (s: string) => void
  showLocked: boolean
  onToggleLocked: (v: boolean) => void
  sortBy: SortKey
  onSortBy: (k: SortKey) => void
}

export function FilterPills(props: Props) {
  const { t } = useTranslation()
  const {
    rarityFilter, onRarityFilter,
    elementSearch, onElementSearch,
    showLocked, onToggleLocked,
    sortBy, onSortBy,
  } = props

  return (
    <div className="flex flex-col gap-2 px-2 py-2 border-b border-white/10 bg-gray-950/50">
      {/* Row 1: rarity pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onRarityFilter('all')}
          className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
            rarityFilter === 'all'
              ? 'bg-emerald-500 text-white'
              : 'bg-white/10 text-white/60 hover:bg-white/20'
          }`}
        >
          {t('cosmic_hub.bestiary.filter_all')}
        </button>
        {RARITIES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onRarityFilter(r)}
            className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              rarityFilter === r
                ? 'bg-emerald-500 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            {t(RARITY_LABEL_KEY[r])}
          </button>
        ))}
      </div>

      {/* Row 2: search + sort + locked toggle */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={elementSearch}
          onChange={(ev) => onElementSearch(ev.target.value)}
          placeholder={t('cosmic_hub.bestiary.search_placeholder')}
          className="flex-1 min-w-[120px] px-2 py-1 rounded text-xs bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-emerald-400"
        />

        <select
          value={sortBy}
          onChange={(ev) => onSortBy(ev.target.value as SortKey)}
          className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10 text-white focus:outline-none focus:border-emerald-400"
        >
          <option value="level-asc">{t('cosmic_hub.bestiary.sort_level_asc')}</option>
          <option value="level-desc">{t('cosmic_hub.bestiary.sort_level_desc')}</option>
          <option value="element">{t('cosmic_hub.bestiary.sort_element')}</option>
          <option value="rarity">{t('cosmic_hub.bestiary.sort_rarity')}</option>
        </select>

        <label className="flex items-center gap-1 text-xs text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={showLocked}
            onChange={(ev) => onToggleLocked(ev.target.checked)}
            className="accent-emerald-500"
          />
          {t('cosmic_hub.bestiary.show_locked')}
        </label>
      </div>
    </div>
  )
}
