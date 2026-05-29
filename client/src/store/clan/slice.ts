import { create } from 'zustand'
import type { ClanSnapshot, ClanListItem } from '../../api/clan'
import { fetchClanMe } from '../../api/clan'
import { mergeServerMessages } from './mergeMessages'

export interface ClanState {
  snapshot: ClanSnapshot | null
  cooldownUntil: string | null
  list: ClanListItem[]
  listTotal: number
  listSearch: string
  listPage: number
  isLoading: boolean
  setSnapshot(s: ClanSnapshot | null): void
  setCooldown(iso: string | null): void
  setList(items: ClanListItem[], total: number): void
  setListQuery(search: string, page: number): void
  setLoading(v: boolean): void
  reset(): void
  fetchClanMe(): Promise<void>
}

export const useClanStore = create<ClanState>((set, get) => ({
  snapshot: null,
  cooldownUntil: null,
  list: [],
  listTotal: 0,
  listSearch: '',
  listPage: 0,
  isLoading: false,

  setSnapshot: (s) => set({ snapshot: s }),
  setCooldown: (iso) => set({ cooldownUntil: iso }),
  setList: (items, total) => set({ list: items, listTotal: total }),
  setListQuery: (search, page) => set({ listSearch: search, listPage: page }),
  setLoading: (v) => set({ isLoading: v }),
  reset: () =>
    set({
      snapshot: null,
      cooldownUntil: null,
      list: [],
      listTotal: 0,
      listSearch: '',
      listPage: 0,
      isLoading: false,
    }),

  fetchClanMe: async () => {
    try {
      const r = await fetchClanMe()
      if (r.clan) {
        set({
          snapshot: {
            clan: r.clan,
            me: r.me!,
            members: r.members!,
            messages: mergeServerMessages(get().snapshot?.messages, r.messages!),
            requests: r.requests!,
            pin: r.pin ?? null,
          } as ClanSnapshot,
          cooldownUntil: r.cooldownUntil,
        })
      } else {
        set({ snapshot: null, cooldownUntil: r.cooldownUntil })
      }
    } catch (e) {
      console.error('[clan] fetchClanMe failed', e)
    }
  },
}))
