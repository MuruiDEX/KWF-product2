"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { api, splitPage, type ListResponse } from "@/lib/api"

/**
 * F2: постраничный список с кнопкой «Показать ещё».
 *
 * Backend пагинирует все list-эндпоинты (PAGE_SIZE=20); раньше фронт брал
 * только первую страницу и молча обрезал остатки. Хук держит счётчик
 * страниц локально (next-URL DRF абсолютный и не годится для api()),
 * при смене resetKey сбрасывается на страницу 1.
 *
 * @param buildUrl страница (1-based) → относительный путь с query
 * @param resetKey любая смена (поиск, фильтр) перезапускает список
 */
export interface PagedList<T> {
  items: T[]
  /** Всего записей (null — сервер отдал plain-массив без count). */
  total: number | null
  hasMore: boolean
  loading: boolean
  loadingMore: boolean
  loadError: boolean
  loadMore: () => void
  reload: () => void
}

export function usePagedList<T>(
  buildUrl: (page: number) => string,
  resetKey: string
): PagedList<T> {
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [lastBatch, setLastBatch] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const buildUrlRef = useRef(buildUrl)
  // Свежий buildUrl для loadMore без рефетча на каждый рендер
  // (страницы передают инлайн-стрелки). Присваивание в effect —
  // чтение ref только вне рендера.
  useEffect(() => {
    buildUrlRef.current = buildUrl
  })

  useEffect(() => {
    let cancelled = false
    // Загрузка данных по смене resetKey/reloadKey — штатный fetch-effect:
    // синхронный setLoading здесь намеренный (сброс скелетона).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setLoadError(false)
    api<ListResponse<T>>(buildUrlRef.current(1))
      .then((data) => {
        if (cancelled) return
        const { items: first, total: count } = splitPage(data)
        setItems(first)
        setTotal(count)
        setPage(1)
        setLastBatch(first.length)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [resetKey, reloadKey])

  // total известен → точное сравнение; иначе эвристика «последний батч пуст».
  const hasMore =
    total !== null ? items.length < total : lastBatch > 0 && !loading

  const loadMore = useCallback(() => {
    const nextPage = page + 1
    setLoadingMore(true)
    api<ListResponse<T>>(buildUrlRef.current(nextPage))
      .then((data) => {
        const { items: more, total: count } = splitPage(data)
        if (count !== null) setTotal(count)
        setItems((prev) => [...prev, ...more])
        setLastBatch(more.length)
        setPage(nextPage)
      })
      .catch(() => {
        // Тихо: список уже показан, кнопка остаётся для повтора.
      })
      .finally(() => {
        setLoadingMore(false)
      })
  }, [page])

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1)
  }, [])

  return { items, total, hasMore, loading, loadingMore, loadError, loadMore, reload }
}
