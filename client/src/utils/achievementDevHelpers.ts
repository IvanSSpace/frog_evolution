// DEV-хелперы для ачивок. Подключаются в App.tsx через
// `if (import.meta.env.DEV) installAchievementDevHelpers()`.
//
// __testAchievement(id?)  — показать тост ачивки (по id или первой/случайной)
// __listAchievements()    — таблица всех ачивок + статус (locked/claimable/claimed)

import { eventBus } from '../store/eventBus'
import { ACHIEVEMENTS } from '../game/achievements/config'
import { useAchievementsStore } from '../store/achievementsStore'

declare global {
  interface Window {
    __testAchievement: (id?: string) => string
    __listAchievements: () => void
  }
}

export function installAchievementDevHelpers(): void {
  // Показать тост ачивки (для теста уведомления). Без id — случайная.
  window.__testAchievement = (id?: string): string => {
    const def = id
      ? ACHIEVEMENTS.find((a) => a.id === id)
      : ACHIEVEMENTS[Math.floor(Math.random() * ACHIEVEMENTS.length)]
    if (!def) {
      console.warn(
        `[ach-dev] нет ачивки "${id}". Доступные:`,
        ACHIEVEMENTS.map((a) => a.id).join(', '),
      )
      return 'not found'
    }
    eventBus.emit('achievement:unlocked', { id: def.id })
    return `toast: ${def.id} — ${def.title}`
  }

  // Таблица ачивок + текущий статус.
  window.__listAchievements = (): void => {
    const store = useAchievementsStore.getState()
    console.table(
      ACHIEVEMENTS.map((a) => ({
        id: a.id,
        title: a.title,
        metric: a.metric,
        target: a.target,
        reward: a.reward,
        status: store.status(a.id),
      })),
    )
  }

  console.log(
    '[ach-dev] helpers installed: __testAchievement(id?), __listAchievements()',
  )
}
