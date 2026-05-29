import { useEffect, useRef } from 'react'
import { fetchClanMe } from '../api/clan'
import { useClanStore } from '../store/clan/slice'
import { mergeServerMessages } from '../store/clan/mergeMessages'
import type { ClanSnapshot } from '../api/clan'

export function useClanPolling(enabled: boolean) {
  const setSnapshot = useClanStore((s) => s.setSnapshot)
  const setCooldown = useClanStore((s) => s.setCooldown)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!enabled) return

    const id = setInterval(() => {
      fetchClanMe()
        .then((r) => {
          if (!enabledRef.current) return
          if (r.clan) {
            setSnapshot({
              clan: r.clan,
              me: r.me!,
              members: r.members!,
              messages: mergeServerMessages(useClanStore.getState().snapshot?.messages, r.messages!),
              requests: r.requests!,
              pin: r.pin ?? null,
            } as ClanSnapshot)
          } else {
            setSnapshot(null)
          }
          setCooldown(r.cooldownUntil)
        })
        .catch(() => {})
    }, 4000)

    return () => clearInterval(id)
  }, [enabled, setSnapshot, setCooldown])
}
