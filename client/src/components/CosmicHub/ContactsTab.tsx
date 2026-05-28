// 2026-05-28: контент рас/контактов вырезан из игры. Вкладка осталась как
// placeholder (чтобы CosmicHubModal не сломать), но без race list / detail view
// / pending pull. Source-файлы рас (races.ts, raceChains.ts, FirstContact*,
// pendingEngine, RaceDetailView, RelationshipBar) — мёртвый код, удалить
// отдельным проходом.

export function ContactsTab() {
  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-10 text-center"
      style={{ minHeight: 240 }}
    >
      <div className="text-5xl mb-3 opacity-60">📡</div>
      <div
        className="ff-display text-xl mb-2"
        style={{ color: '#15803d' }}
      >
        Связи нет
      </div>
      <div
        className="ff-body text-sm font-bold"
        style={{ color: '#365314', opacity: 0.7 }}
      >
        Эфир молчит. Возможно, никого там нет.
      </div>
    </div>
  )
}
