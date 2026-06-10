// Текущее значение метрики ачивки из снапшота gameStore (только чтение).

import { useGameStore } from '../../store/gameStore'
import type { AchMetric } from './config'

export function metricValue(metric: AchMetric): number {
  const s = useGameStore.getState()
  switch (metric) {
    case 'discoveredCount':
      return s.discoveredLevels.length
    case 'maxLevel':
      return s.discoveredLevels.length ? Math.max(...s.discoveredLevels) : 0
    case 'maxTier':
      return s.frogTiers.length ? Math.max(...s.frogTiers) : 0
    case 'gold':
      return s.gold
    case 'incomePerSec':
      return s.incomePerSec
    case 'frogsOwned':
      return s.locationFrogs.reduce((acc, frogs) => acc + frogs.length, 0)
    case 'boxesOpened':
      return s.boxOpenCount
    case 'shipsOwned':
      return s.upgrades.ships
    case 'cosmosUnlocked':
      return s.hasCosmosUnlocked ? 1 : 0
    case 'l18Merges':
      return s.l18MergesCount
  }
}
