import type { ClanMessageDto } from '../../api/clan'

// Мерж серверного списка сообщений с локальным:
// 1. Подтверждённые сообщения сохраняют clientId (стабильный React key → нет
//    перемонтирования пузыря → нет мигания).
// 2. Оптимистичные сообщения (id < 0), которых сервер ещё не вернул, переносятся,
//    чтобы они не пропадали при перезаписи snapshot (polling / fetchClanMe).
export function mergeServerMessages(
  prev: ClanMessageDto[] | undefined,
  server: ClanMessageDto[],
): ClanMessageDto[] {
  const prevById = new Map<number, ClanMessageDto>()
  for (const m of prev ?? []) prevById.set(m.id, m)

  const merged = server.map((s) => {
    const p = prevById.get(s.id)
    return p?.clientId ? { ...s, clientId: p.clientId } : s
  })

  const pending = (prev ?? []).filter(
    (m) =>
      m.id < 0 &&
      !server.some((s) => s.userId === m.userId && s.text === m.text),
  )

  return [...merged, ...pending]
}
