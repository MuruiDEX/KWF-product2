"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  EMPTY_TOURNAMENT_INFO,
  type CategoryDraft,
  type PublishMode,
  type TournamentDraft,
  type TournamentInfoState,
} from './wizardTypes'

const keyFor = (userId: number | string) => `kwf-tournament-draft-${userId}`

/** Черновик wizard'а: localStorage, привязка к пользователю, TTL 14 дней.
 * Повреждённый JSON — молча игнорируем, приложение не падает. */
export function readDraft(userId: number | string): TournamentDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TournamentDraft>
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.info || !Array.isArray(parsed.categories)) return null
    if (parsed.updatedAt) {
      const age = Date.now() - new Date(parsed.updatedAt).getTime()
      if (!Number.isFinite(age) || age > 14 * 86400000) return null
    }
    return {
      info: { ...EMPTY_TOURNAMENT_INFO, ...parsed.info },
      categories: parsed.categories as CategoryDraft[],
      selectedAthletes: (parsed.selectedAthletes ?? {}) as Record<number, number[]>,
      publishMode: parsed.publishMode === 'published' ? 'published' : 'draft',
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function clearDraftStorage(userId: number | string) {
  try {
    localStorage.removeItem(keyFor(userId))
  } catch {
    /* приватный режим — черновик просто не сохранится */
  }
}

interface DraftInput {
  info: TournamentInfoState
  categories: CategoryDraft[]
  selectedAthletes: Record<number, number[]>
  publishMode: PublishMode
}

/** True, когда в wizard'е есть что сохранять (не голая форма). */
export function isDraftDirty(input: DraftInput): boolean {
  return (
    input.info.name.trim() !== '' ||
    input.info.start_date !== '' ||
    input.categories.length > 0
  )
}

export function useTournamentDraft(userId: number | null | undefined, input: DraftInput) {
  const [draft, setDraft] = useState<TournamentDraft | null>(null)
  const [restoredAt, setRestoredAt] = useState<string | null>(null)
  // Попытка восстановления завершена (черновик найден или нет).
  // До этого момента автосейв молчит — пустое начальное состояние
  // никогда не должно затирать сохранённый черновик.
  const [restoreDone, setRestoreDone] = useState(false)
  const restoredRef = useRef(false)

  const clearDraft = useCallback(() => {
    if (userId == null) return
    clearDraftStorage(userId)
    setDraft(null)
    setRestoredAt(null)
  }, [userId])

  // Восстановление — один раз, когда стал известен пользователь.
  // Синхронизация с внешним хранилищем (localStorage), не с props.
  useEffect(() => {
    if (userId == null || restoredRef.current) return
    restoredRef.current = true
    const found = readDraft(userId)
    if (found && (found.info.name.trim() !== '' || found.categories.length > 0)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(found)
      setRestoredAt(found.updatedAt)
    }
    setRestoreDone(true)
  }, [userId])

  // Автосохранение write-through (без debounce): после каждого коммита
  // эффектов storage синхронен состоянию — детерминировано для тестов
  // и навигации. Пейлоад маленький (форма + категории), запись sub-ms.
  // Пустая форма ключ НЕ удаляет — удаление только через явный clearDraft.
  useEffect(() => {
    if (userId == null || !restoreDone) return
    const cur = input
    if (!isDraftDirty(cur)) return
    try {
      const payload: TournamentDraft = { ...cur, updatedAt: new Date().toISOString() }
      localStorage.setItem(keyFor(userId), JSON.stringify(payload))
    } catch {
      /* переполнение/приватный режим — молча пропускаем */
    }
    // Гранулярные deps намеренно: input пересоздаётся каждый рендер,
    // пишем только когда реально изменились данные.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreDone, userId, input.info, input.categories, input.selectedAthletes, input.publishMode])

  return { draft, restoredAt, clearDraft }
}
