// Phase 0: единый TanStack Query слой для /manage.
// Server state (турнир, regs, татами, спортсмены) живёт здесь, а не в
// десятке независимых useState+useEffect. Локальный UI state остаётся
// на useState/useReducer — Query только для данных сервера.
// Пока НЕ используется в page.tsx (визуальный layout не меняется):
// Phase 2 переведёт page.tsx на эти хуки.

import { QueryClient } from "@tanstack/react-query"
import { api, unwrapList } from "@/lib/api"
import type { Athlete, Tatami, Tournament } from "@/lib/types"
import type { RegistrationEntry } from "@/lib/controlCenter"

let browserClient: QueryClient | null = null

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Manage-данные меняются чужими руками (realtime), но не каждую секунду:
        // 10с свежести + ручная инвалидация по SSE/mutations.
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        // 401/403/404 — по существу, ретраить бессмысленно.
        retry: (count, err) => {
          const status = (err as { status?: unknown }).status
          if (status === 401 || status === 403 || status === 404) return false
          return count < 1
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/** Next.js: на сервере — новый клиент на запрос, в браузере — синглтон. */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeClient()
  if (!browserClient) browserClient = makeClient()
  return browserClient
}

/** Канонические ключи manage — инвалидация только через них. */
export const manageKeys = {
  tournament: (id: string) => ["manage", "tournament", id] as const,
  regs: (id: string) => ["manage", "regs", id] as const,
  tatamis: () => ["manage", "tatamis"] as const,
  athletes: () => ["manage", "athletes"] as const,
} as const

/** Тот же normalize-контракт, что в page.tsx:fetchData (массив или {results}). */
export async function fetchManageTournament(id: string): Promise<Tournament> {
  return api<Tournament>(`/api/tournament/tournaments/${id}/`)
}

export async function fetchManageAthletes(): Promise<Athlete[]> {
  const raw = await api<Athlete[] | { results: Athlete[] }>(
    "/api/tournament/athletes/"
  )
  return unwrapList(raw)
}

export async function fetchManageTatamis(): Promise<Tatami[]> {
  const raw = await api<Tatami[] | { results: Tatami[] }>(
    "/api/tournament/tatamis/"
  )
  const list = unwrapList(raw)
  return [...list].sort((a, b) => a.order - b.order)
}

/** Явка вторична: null НЕ бросаем — обзор покажет «недоступно». */
export async function fetchManageRegs(
  id: string
): Promise<RegistrationEntry[] | null> {
  try {
    return await api<RegistrationEntry[]>(
      `/api/tournament/tournaments/${id}/registrations/`
    )
  } catch {
    return null
  }
}

/** Одна точка инвалидации manage после mutations / realtime SSE. */
export async function invalidateManage(
  client: QueryClient,
  tournamentId: string
): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: manageKeys.tournament(tournamentId) }),
    client.invalidateQueries({ queryKey: manageKeys.regs(tournamentId) }),
    client.invalidateQueries({ queryKey: manageKeys.tatamis() }),
  ])
}
