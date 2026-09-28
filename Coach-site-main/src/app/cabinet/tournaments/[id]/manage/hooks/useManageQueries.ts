"use client"

// Query-хуки /manage. API-контракты 1-в-1 как бывший page.tsx:fetchData,
// поэтому поведение не меняется — меняется только владелец кэша.
// page.tsx, CheckinPanel и WeighInSection (через page) читают эти ключи:
// один запрос на ключ вместо дублей. Мутации — через invalidateManage
// из @/lib/queryClient.

import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import {
  fetchManageAthletes,
  fetchManageRegs,
  fetchManageTatamis,
  fetchManageTournament,
  manageKeys,
} from "@/lib/queryClient"
import type { RegistrationEntry } from "@/lib/controlCenter"
import type { Athlete, Tatami, Tournament } from "@/lib/types"

function resolveId(raw: string | string[] | undefined): string | null {
  if (typeof raw === "string" && raw.length > 0) return raw
  return null
}

export function useManageTournamentQuery(
  rawId: string | string[] | undefined
): UseQueryResult<Tournament, Error> {
  const id = resolveId(rawId)
  return useQuery({
    queryKey: id ? manageKeys.tournament(id) : ["manage", "tournament", "none"],
    queryFn: () => fetchManageTournament(id as string),
    enabled: id !== null,
  })
}

export function useManageRegsQuery(
  rawId: string | string[] | undefined
): UseQueryResult<RegistrationEntry[] | null, Error> {
  const id = resolveId(rawId)
  return useQuery({
    queryKey: id ? manageKeys.regs(id) : ["manage", "regs", "none"],
    queryFn: () => fetchManageRegs(id as string),
    enabled: id !== null,
  })
}

export function useManageTatamisQuery(): UseQueryResult<Tatami[], Error> {
  return useQuery({
    queryKey: manageKeys.tatamis(),
    queryFn: fetchManageTatamis,
  })
}

export function useManageAthletesQuery(): UseQueryResult<Athlete[], Error> {
  return useQuery({
    queryKey: manageKeys.athletes(),
    queryFn: fetchManageAthletes,
    // Ростер для селектов: меняется редко, кэш дольше.
    staleTime: 60_000,
  })
}
