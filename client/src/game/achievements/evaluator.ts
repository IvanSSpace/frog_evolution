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
    case 'gold':
      return s.gold
    case 'frogsOwned':
      return s.locationFrogs.reduce((acc, frogs) => acc + frogs.length, 0)
    case 'l18Merges':
      return s.l18MergesCount
  }
}
