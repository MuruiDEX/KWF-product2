const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"

export class ApiError extends Error {
  status: number
  payload: unknown
  constructor(status: number, payload: unknown, message?: string) {
    super(message || `Request failed with status ${status}`)
    this.name = "ApiError"
    this.status = status
    this.payload = payload
  }
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem("access_token")
  } catch {
    return null
  }
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem("refresh_token")
  } catch {
    return null
  }
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access)
  localStorage.setItem("refresh_token", refresh)
}

function clearTokens() {
  try {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
  } catch {
    /* ignore */
  }
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  const refresh = getRefreshToken()
  if (!refresh) return null

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      })
      if (!res.ok) {
        clearTokens()
        return null
      }
      const data = await res.json().catch(() => null)
      if (!data?.access) {
        clearTokens()
        return null
      }
      setTokens(data.access, refresh)
      return data.access as string
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

const REQUEST_TIMEOUT_MS = 20000

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`
  const token = getAccessToken()

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  }
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetchWithTimeout(url, { ...options, headers })
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError(0, null, "Превышено время ожидания. Проверьте соединение.")
    }
    throw e
  }

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`
      try {
        res = await fetchWithTimeout(url, { ...options, headers })
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          throw new ApiError(0, null, "Превышено время ожидания. Проверьте соединение.")
        }
        throw e
      }
    } else {
      clearTokens()
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new ApiError(res.status, error, apiErrorMessage({ status: res.status, ...error }))
  }

  if (res.status === 204) return undefined as T
  const text = await res.text().catch(() => "")
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined as T
  }
}

/** DRF-пагинация: list-эндпоинты возвращают объект, а не массив. */
export interface PaginatedResponse<T> {
  count?: number
  next?: string | null
  previous?: string | null
  results: T[]
}

/** Всё, что может прийти с list-эндпоинта до нормализации. */
export type ListResponse<T> =
  | T[]
  | PaginatedResponse<T>
  | null
  | undefined

/**
 * Единая точка нормализации list-ответов.
 * Принимает массив, пагинированный объект, null/undefined —
 * всегда возвращает массив. Неполные элементы НЕ фильтрует (это задача
 * доменной нормализации, напр. normalizeSessions), только envelope.
 */
export function unwrapList<T>(data: ListResponse<T>): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data as T[]
  if (typeof data === "object" && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results
  }
  return []
}

const API_FIELD_LABELS: Record<string, string> = {
  first_name: "Имя",
  last_name: "Фамилия",
  birth_date: "Дата рождения",
  weight: "Вес",
  height: "Рост",
  gender: "Пол",
  name: "Название",
  start_date: "Дата начала",
  end_date: "Дата окончания",
  detail: "",
  error: "",
  non_field_errors: "",
}

/** Человекочитаемый текст ошибки API (технические детали — в console). */
export function apiErrorMessage(err: unknown): string {
  const e = err as { status?: number; [k: string]: unknown } | null
  if (!e || typeof e !== "object") return "Не удалось сохранить. Проверьте данные и попробуйте снова."
  if (e?.status === 0) return "Нет соединения с сервером. Проверьте интернет."
  if (e?.status === 401) return "Сессия истекла. Войдите заново."
  if (e?.status === 403) return "Нет прав для этого действия."
  if (e?.status === 404) return "Запись не найдена. Обновите страницу."
  if (typeof e === "object") {
    const parts: string[] = []
    for (const [k, v] of Object.entries(e)) {
      if (k === "status") continue
      if (k === "payload") continue
      const label = API_FIELD_LABELS[k] ?? k
      const msgs = Array.isArray(v) ? v.map(String).join(" ") : String(v)
      if (!msgs || msgs === "undefined" || msgs === "[object Object]") continue
      parts.push(label ? `${label}: ${msgs}` : msgs)
    }
    if (parts.length) return parts.join(" ")
  }
  if (e?.status && e.status >= 500) return "Ошибка сервера. Попробуйте позже."
  return "Не удалось сохранить. Проверьте данные и попробуйте снова."
}

export { setTokens, clearTokens, getAccessToken, API_URL }
