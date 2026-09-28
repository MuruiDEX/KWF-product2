const BUILD_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

/**
 * M8: runtime URL API без пересборки.
 * - Браузер: window.__KWF_API_URL из /env.js (beforeInteractive),
 *   fallback — запечённый NEXT_PUBLIC_API_URL.
 * - Сервер (SSR/route handlers): process.env.KWF_API_URL напрямую.
 * Старое поведение без KWF_API_URL — без изменений.
 */
export function apiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const w = window as unknown as { __KWF_API_URL?: unknown }
    if (typeof w.__KWF_API_URL === "string" && w.__KWF_API_URL) {
      return w.__KWF_API_URL
    }
    return BUILD_API_URL
  }
  return process.env.KWF_API_URL ?? BUILD_API_URL
}

// Совместимость: build-time значение (для кода вне запроса).
// Внутри запросов используйте apiBaseUrl().
const API_URL = BUILD_API_URL

if (
  !process.env.NEXT_PUBLIC_API_URL &&
  typeof process !== "undefined" &&
  process.env?.NODE_ENV === "production"
) {
  // Прод-сборка без явного API_URL уходила бы в localhost (см. выше) —
  // молчаливая поломка всего API. Кричим в консоль сборки/логов.
  console.error(
    "[kwf] NEXT_PUBLIC_API_URL is not set — API calls will target http://localhost:8000"
  )
}

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

/**
 * Токены живут в HttpOnly cookies (ставит backend) — JS их не видит.
 * Здесь: credentials:include, CSRF-токен для мутаций, refresh-retry.
 * Остатки localStorage-токенов прошлых версий подчищаем один раз.
 */
function clearLegacyTokens() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
  } catch {
    /* ignore */
  }
}

let csrfToken: string | null = null
let csrfPromise: Promise<string | null> | null = null

/**
 * Сбросить закэшированный CSRF-токен (после login/logout/register):
 * сервер вправе ротировать csrf-куку при смене сессии, а stale заголовок
 * даст ложный 403 на первой же мутации.
 */
export function resetCsrfToken() {
  csrfToken = null
  csrfPromise = null
}

async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken
  if (!csrfPromise) {
    csrfPromise = (async () => {
      try {
        // С таймаутом: зависший /csrf/ раньше вешал любую мутацию навсегда.
        const res = await fetchWithTimeout(`${apiBaseUrl()}/api/auth/csrf/`, {
          credentials: "include",
        })
        if (!res.ok) return null
        const data = (await res.json().catch(() => null)) as {
          csrfToken?: string
        } | null
        csrfToken = data?.csrfToken ?? null
        return csrfToken
      } catch {
        return null
      } finally {
        csrfPromise = null
      }
    })()
  }
  return csrfPromise
}

function isUnsafeMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

/**
 * Событие «сессия действительно мертва» (refresh не помог).
 * AuthProvider слушает и сбрасывает user → консистентный редирект на login.
 * Стреляет только после попытки refresh, НЕ при обычном 401 логина.
 */
export const AUTH_EXPIRED_EVENT = "kwf-auth-expired"

function notifyAuthExpired(reason: string) {
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function"
  ) {
    window.dispatchEvent(
      new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason } })
    )
  }
}

/**
 * Какие запросы имеют право на один silent retry через refresh.
 * Всё вне /api/auth/* — да. Внутри — только чтение профиля и сохранение
 * профиля: /me/, /cabinet/ (GET) и PATCH /me/ страдают от той же протухшей
 * access-куки, а их 401 фронт раньше трактовал как «не залогинен»
 * (ложный логаут при живом refresh). Остальное из /api/auth/*
 * (login/register/logout/refresh/link/...) не повторяем: там 401 — это
 * ответ по существу.
 */
function canRetryWithRefresh(path: string, method: string): boolean {
  if (!path.startsWith("/api/auth/")) return true
  const clean = path.split("?", 1)[0]
  if (method === "GET") {
    return clean === "/api/auth/me/" || clean === "/api/auth/cabinet/"
  }
  // Сохранение профиля идемпотентно — безопасно повторить один раз.
  return method === "PATCH" && clean === "/api/auth/me/"
}

let refreshPromise: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      const csrf = await getCsrfToken()
      if (csrf) headers["X-CSRFToken"] = csrf
      // С таймаутом: зависший refresh раньше держал refreshPromise
      // и блокировал все ожидающие запросы.
      const res = await fetchWithTimeout(`${apiBaseUrl()}/api/auth/token/refresh/`, {
        method: "POST",
        credentials: "include",
        headers,
      })
      return res.ok
    } catch {
      return false
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
  // Не затираем внешний AbortSignal вызывающей стороны: отмена сверху
  // должна прерывать и наш внутренний запрос.
  const callerSignal = init.signal as AbortSignal | null | undefined
  const onCallerAbort = () => controller.abort()
  try {
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort()
      else callerSignal.addEventListener("abort", onCallerAbort, { once: true })
    }
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
    callerSignal?.removeEventListener?.("abort", onCallerAbort)
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${apiBaseUrl()}${path}`
  const method = (options.method ?? "GET").toUpperCase()

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData
  const baseHeaders: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  }
  if (!isFormData && !baseHeaders["Content-Type"]) {
    baseHeaders["Content-Type"] = "application/json"
  }

  // Заголовки строим заново перед каждой попыткой: после сброса CSRF-кэша
  // нужен свежий токен, а не закэшированный.
  const buildHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { ...baseHeaders }
    if (isUnsafeMethod(method) && !headers["X-CSRFToken"]) {
      const csrf = await getCsrfToken()
      if (csrf) headers["X-CSRFToken"] = csrf
    }
    return headers
  }

  const doFetch = (headers: Record<string, string>) =>
    fetchWithTimeout(url, { ...options, headers, credentials: "include" });

  let headers = await buildHeaders()

  let res: Response
  try {
    res = await doFetch(headers)
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError(0, null, "Превышено время ожидания. Проверьте соединение.")
    }
    throw e
  }

  // Цикла 401→refresh→401 здесь нет по построению:
  // - refresh-эндпоинт сам подпадает под canRetryWithRefresh=false;
  // - повтор исходного запроса — ровно один.
  if (res.status === 401 && canRetryWithRefresh(path, method)) {
    // Access протух — пробуем ротацию по refresh-cookie и повторяем один раз.
    if (await refreshSession()) {
      try {
        // Заголовки пересобираем: CSRF мог обновиться, закэшированный —
        // протухнуть. Иначе сразу после refresh ловили ложный 403 CSRF.
        headers = await buildHeaders()
        res = await doFetch(headers)
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          throw new ApiError(0, null, "Превышено время ожидания. Проверьте соединение.")
        }
        throw e
      }
      if (res.status === 401) {
        // Даже свежие токены не помогли (пользователь удалён/заблокирован).
        notifyAuthExpired("retry-unauthorized")
      }
    } else {
      // Refresh мёртв (нет куки / протух / отозван): сессия кончилась
      // по-настоящему. Сигналим один раз — AuthProvider разлогинит.
      notifyAuthExpired("refresh-failed")
    }
  }

  // CSRF-токен мог протухнуть/расcинхронизироваться на сервере
  // (ротация csrf-куки): сбрасываем кэш и повторяем РОВНО один раз.
  // Действует на все мутации сразу — единый механизм вместо костылей
  // на каждом endpoint. Цикла нет: флаг одноразовый.
  if (res.status === 403 && isUnsafeMethod(method)) {
    const peek = await res
      .clone()
      .json()
      .catch(() => ({}) as unknown)
    const detail =
      typeof peek === "object" && peek !== null
        ? String((peek as Record<string, unknown>).detail ?? "")
        : ""
    // M5: повторяем только точный сбой CSRF ("CSRF Failed: ..." от
    // CookieJWTAuthentication/DRF). Широкий includes("CSRF") ретраил бы
    // и настоящий 403-прав с упоминанием CSRF в тексте ошибки.
    if (detail.includes("CSRF Failed")) {
      resetCsrfToken()
      headers = await buildHeaders()
      try {
        res = await doFetch(headers)
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          throw new ApiError(0, null, "Превышено время ожидания. Проверьте соединение.")
        }
        throw e
      }
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
    // 2xx с не-JSON телом (напр. HTML-страница ошибки прокси) — раньше
    // маскировалось под успех с undefined и падало выше по стеку.
    throw new ApiError(
      res.status,
      { detail: text.slice(0, 200) },
      `Некорректный ответ сервера (статус ${res.status}). Попробуйте позже.`
    )
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
  return splitPage(data).items
}

/**
 * F2: нормализация + общее количество. DRF PageNumberPagination отдаёт
 * {count, next, previous, results}; count используем для счётчиков
 * (dashboard) и кнопки «Показать ещё», items — для рендера.
 */
export function splitPage<T>(data: ListResponse<T>): {
  items: T[]
  total: number | null
} {
  if (!data) return { items: [], total: 0 }
  if (Array.isArray(data)) return { items: data as T[], total: null }
  if (typeof data === "object" && Array.isArray((data as { results?: unknown }).results)) {
    const paged = data as PaginatedResponse<T>
    return {
      items: paged.results,
      total: typeof paged.count === "number" ? paged.count : null,
    }
  }
  return { items: [], total: 0 }
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
  // P2: тренировки.
  sets: "Подходы",
  reps: "Повторения",
  rest_seconds: "Отдых",
  workout: "Тренировка",
  athlete: "Спортсмен",
  due_date: "Срок",
  actual_sets: "Факт подходов",
  actual_reps: "Факт повторений",
  actual_weight: "Факт веса",
  // P1: заявки и сброс пароля.
  phone: "Телефон",
  plan: "Тариф",
  message: "Сообщение",
  source: "Источник",
  status: "Статус",
  email: "Email",
  username: "Имя пользователя",
  password: "Пароль",
  new_password: "Пароль",
  uid: "",
  token: "",
  detail: "",
  error: "",
  non_field_errors: "",
}

/** P1: человеческие пояснения для частых бизнес-ошибок backend
 * (вместо сырого detail). Возвращает null, если совпадений нет. */
function friendlyDetail(detail: string): string | null {
  const d = detail.toLowerCase()
  if (d.includes("уже участвует") || d.includes("проведённ")) return detail
  if (d.includes("завершён") || d.includes("finished"))
    return "Турнир завершён — изменения запрещены."
  if (d.includes("черновик") || d.includes("draft"))
    return "Сначала опубликуйте турнир — в черновике это действие недоступно."
  if (d.includes("не найден") || d.includes("not found"))
    return "Запись не найдена. Обновите страницу."
  if (d.includes("недействительная ссылка сброса"))
    return "Ссылка сброса недействительна или устарела. Запросите новую."
  if (d.includes("уже заявлен") || d.includes("already"))
    return "Этот спортсмен уже заявлен."
  return null
}

/** Phase 2: HTTP-статус ошибки для ветвления UI (403/404/офлайн).
 * Debug-информация никуда не теряется: ApiError.status + payload
 * остаются в самой ошибке для логов и devtools. */
export function apiErrorStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null
  const s = (err as { status?: unknown }).status
  return typeof s === "number" ? s : null
}

/** Сетевой провал без ответа сервера: сырой throw fetch (TypeError),
 * а не ApiError. AbortError к этому моменту уже превращён в ApiError(0). */
function isNetworkFailure(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  if ((err as { status?: unknown }).status === 0) return true
  if (err instanceof TypeError) return true
  const msg =
    err instanceof Error
      ? err.message
      : String((err as { message?: unknown }).message ?? "")
  return /failed to fetch|networkerror|load failed|net::/i.test(msg)
}

/** Человекочитаемый текст ошибки API (технические детали — в console). */
export function apiErrorMessage(err: unknown): string {
  const e = err as { status?: number; [k: string]: unknown } | null
  if (!e || typeof e !== "object") return "Не удалось сохранить. Проверьте данные и попробуйте снова."
  if (isNetworkFailure(e)) return "Нет соединения с сервером. Проверьте интернет."
  if (e?.status === 401) return "Сессия истекла. Войдите заново."
  // Полевые ошибки DRF могут лежать как прямо в объекте, так и в
  // ApiError.payload (единый клиент бросает ApiError) — смотрим оба места,
  // иначе вместо «Вес: …» всегда показывался generic-текст.
  const fields: Record<string, unknown> = { ...(e as Record<string, unknown>) }
  const payload = (e as { payload?: unknown }).payload
  if (payload && typeof payload === "object") {
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (!(k in fields)) fields[k] = v
    }
  }
  if (e?.status === 403) {
    // Различаем CSRF и права: тела ответов разные, сообщения — тоже.
    const detail = String(fields.detail ?? "")
    if (detail.toLowerCase().includes("csrf")) {
      return "Ошибка безопасности запроса (CSRF). Обновите страницу и попробуйте снова."
    }
    // H2: SimpleJWT при неверных credentials отвечает 403
    // "No active account found..." — это не «нет прав», а неверный пароль.
    if (detail.toLowerCase().includes("no active account")) {
      return "Неверное имя пользователя или пароль."
    }
    return "Нет прав для этого действия."
  }
  // H2: DB-lockout логина отвечает 429 с готовым русским detail —
  // показываем его, а не generic-текст.
  if (e?.status === 429) {
    const detail = String(fields.detail ?? "")
    return detail || "Слишком много попыток. Попробуйте позже."
  }
  if (e?.status === 404) return "Запись не найдена. Обновите страницу."
  if (e?.status === 409) {
    // Конфликт состояния (дубль, гонка, протухшие данные): сначала пробуем
    // дружелюбный detail backend, иначе — общий текст про обновление.
    const raw409 = String(fields.detail ?? fields.error ?? "")
    if (raw409) {
      const friendly = friendlyDetail(raw409)
      if (friendly) return friendly
      return raw409
    }
    return "Действие конфликтует с текущим состоянием. Обновите страницу и попробуйте снова."
  }
  // P1: дружелюбные тексты для известных бизнес-ошибок (400 с detail).
  const rawDetail = String(fields.detail ?? fields.error ?? "")
  if (rawDetail) {
    const friendly = friendlyDetail(rawDetail)
    if (friendly) return friendly
  }
  if (typeof fields === "object") {
    const parts: string[] = []
    for (const [k, v] of Object.entries(fields)) {
      if (k === "status") continue
      if (k === "payload") continue
      if (k === "message" || k === "name") continue
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

/**
 * Маркер «сервер ответил 200, но браузер не сохранил cookies»
 * (Secure-over-HTTP, чужой Domain, cross-site без SameSite=None).
 * Без него login/register показывали бы ложное «сессия истекла»
 * сразу после успешного входа.
 */
export const COOKIES_BLOCKED = "cookies-blocked"

export function cookiesBlockedError(): Error {
  return new Error(COOKIES_BLOCKED)
}

export function isCookiesBlockedError(err: unknown): boolean {
  return err instanceof Error && err.message === COOKIES_BLOCKED
}

export interface CookieDebug {
  cookie_name: string
  secure: boolean
  samesite: string
  domain: string | null
  path: string
  has_auth_cookie: boolean
  has_refresh_cookie: boolean
  has_csrf_cookie: boolean
  origin: string | null
  origin_allowed: boolean | null
}

/**
 * Чистая функция: точная причина потери cookies по данным диагностики
 * backend + сравнению хостов. Покрыта unit-тестами.
 */
export function diagnoseCookieSetup(
  debug: CookieDebug,
  apiUrl: string,
  pageOrigin: string
): string[] {
  const hints: string[] = []
  let apiHost = ""
  let pageHost = ""
  try {
    apiHost = new URL(apiUrl).hostname
  } catch {
    /* ignore */
  }
  try {
    pageHost = new URL(pageOrigin).hostname
  } catch {
    /* ignore */
  }
  const pageHttps = pageOrigin.startsWith("https://")
  if (apiHost && pageHost && apiHost !== pageHost && debug.samesite !== "None") {
    hints.push(
      `Сайт открыт на «${pageHost}», а API — на «${apiHost}»: для браузера это разные сайты, и cookies SameSite=${debug.samesite} не отправляются. Откройте оба на одном хосте.`
    )
  }
  if (debug.secure && !pageHttps) {
    hints.push(
      "Cookies требуют Secure, а страница открыта по HTTP — браузер их отклоняет. Откройте сайт по HTTPS."
    )
  }
  if (debug.domain && apiHost) {
    const suffix = debug.domain.replace(/^\./, "")
    if (!apiHost.endsWith(suffix)) {
      hints.push(
        `Cookie-Domain «${debug.domain}» не совпадает с хостом API «${apiHost}» — браузер отбрасывает такие куки.`
      )
    }
  }
  if (debug.origin_allowed === false) {
    hints.push(
      `Origin «${debug.origin ?? "?"}» не разрешён CORS — добавьте его в CORS_EXTRA_ORIGINS на backend.`
    )
  }
  return hints
}

/** Best-effort диагностика для экрана входа (пусто = generic-текст). */
export async function fetchCookieHints(): Promise<string[]> {
  try {
    const debug = await api<CookieDebug>("/api/auth/cookie-debug/")
    if (typeof window === "undefined") return []
    return diagnoseCookieSetup(debug, apiBaseUrl(), window.location.origin)
  } catch {
    return []
  }
}

export { API_URL, clearLegacyTokens }
