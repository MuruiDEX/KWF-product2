import { beforeEach, describe, expect, it, vi, afterEach } from "vitest"

type Handler = (url: string, init: RequestInit) => Response

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("api() 401/refresh flow", () => {
  let calls: { url: string; init: RequestInit }[]
  let handlers: Handler[]
  let dispatched: string[]
  let apiMod: typeof import("@/lib/api")

  beforeEach(async () => {
    calls = []
    handlers = []
    dispatched = []
    vi.resetModules()
    ;(globalThis as unknown as Record<string, unknown>).window = {
      dispatchEvent: (e: Event) => {
        dispatched.push(e.type)
        return true
      },
    }
    globalThis.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      const handler = handlers.shift()
      if (!handler) throw new Error(`unexpected fetch: ${url}`)
      return handler(String(url), init ?? {})
    }) as typeof fetch
    apiMod = await import("@/lib/api")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as unknown as Record<string, unknown>).window
  })

  const csrfOk: Handler = () => json({ csrfToken: "csrf-1" })
  const refreshOk: Handler = () => json({ detail: "ok" })
  const refreshFail: Handler = () =>
    json({ detail: "Refresh token invalid or expired." }, 401)

  it("401 → refresh ok → повтор возвращает данные, refresh вызван один раз", async () => {
    handlers.push(
      () => json({ detail: "expired" }, 401), // GET /cabinet
      csrfOk, // getCsrfToken внутри refreshSession
      refreshOk, // POST refresh
      () => json({ athletes: [], tournaments: [], matches: [] }) // retry
    )
    const data = await apiMod.api<{ athletes: unknown[] }>(
      "/api/auth/cabinet/"
    )
    expect(data.athletes).toEqual([])
    const refreshCalls = calls.filter((c) =>
      c.url.endsWith("/api/auth/token/refresh/")
    )
    expect(refreshCalls).toHaveLength(1)
    expect(dispatched).not.toContain(apiMod.AUTH_EXPIRED_EVENT)
  })

  it("401 → refresh упал → одна ошибка 401 и событие expired, без цикла", async () => {
    handlers.push(
      () => json({ detail: "expired" }, 401),
      csrfOk,
      refreshFail
    )
    await expect(apiMod.api("/api/tournament/tournaments/")).rejects.toMatchObject({
      status: 401,
    })
    expect(
      calls.filter((c) => c.url.endsWith("/api/auth/token/refresh/"))
    ).toHaveLength(1)
    // Повтора исходного запроса не было: всего 3 вызова.
    expect(calls).toHaveLength(3)
    expect(dispatched).toContain(apiMod.AUTH_EXPIRED_EVENT)
  })

  it("два одновременных 401 делят один refresh (single-flight)", async () => {
    handlers.push(
      () => json({}, 401), // req1
      () => json({}, 401), // req2
      csrfOk,
      refreshOk,
      () => json({ ok: 1 }), // retry1
      () => json({ ok: 2 }) // retry2
    )
    const [a, b] = await Promise.all([
      apiMod.api<{ ok: number }>("/api/tournament/tournaments/"),
      apiMod.api<{ ok: number }>("/api/tournament/tatamis/"),
    ])
    expect([a.ok, b.ok].sort()).toEqual([1, 2])
    expect(
      calls.filter((c) => c.url.endsWith("/api/auth/token/refresh/"))
    ).toHaveLength(1)
  })

  it("login 401 не трогает refresh и не шлёт expired", async () => {
    // POST unsafe → сначала CSRF, затем сам логин.
    handlers.push(csrfOk, () => json({ detail: "No active account" }, 401))
    await expect(
      apiMod.api("/api/auth/token/", {
        method: "POST",
        body: JSON.stringify({ username: "x", password: "y" }),
      })
    ).rejects.toMatchObject({ status: 401 })
    expect(calls).toHaveLength(2)
    expect(
      calls.filter((c) => c.url.endsWith("/api/auth/token/refresh/"))
    ).toHaveLength(0)
    expect(dispatched).not.toContain(apiMod.AUTH_EXPIRED_EVENT)
  })

  it("GET /api/auth/me/ с протухшим access чинится через refresh", async () => {
    handlers.push(
      () => json({ detail: "expired" }, 401),
      csrfOk,
      refreshOk,
      () => json({ username: "coach" })
    )
    const me = await apiMod.api<{ username: string }>("/api/auth/me/")
    expect(me.username).toBe("coach")
    expect(dispatched).not.toContain(apiMod.AUTH_EXPIRED_EVENT)
  })

  it("diagnoseCookieSetup находит точную причину", () => {
    const base = {
      cookie_name: "refresh_token",
      path: "/",
      has_auth_cookie: false,
      has_refresh_cookie: false,
      has_csrf_cookie: true,
      origin: "http://localhost:3000",
      origin_allowed: true,
    }
    // Кросс-хост + Lax.
    expect(
      apiMod.diagnoseCookieSetup(
        { ...base, secure: false, samesite: "Lax", domain: null },
        "http://127.0.0.1:8000",
        "http://localhost:3000"
      )
    ).toHaveLength(1)
    // Secure по HTTP.
    const secureHints = apiMod.diagnoseCookieSetup(
      { ...base, secure: true, samesite: "None", domain: null },
      "https://api.x.com",
      "http://x.com"
    )
    expect(secureHints.some((h) => h.includes("HTTPS"))).toBe(true)
    // Domain mismatch.
    const domainHints = apiMod.diagnoseCookieSetup(
      { ...base, secure: false, samesite: "Lax", domain: ".other.com" },
      "http://localhost:8000",
      "http://localhost:3000"
    )
    expect(domainHints.some((h) => h.includes("Domain"))).toBe(true)
    // CORS origin.
    const corsHints = apiMod.diagnoseCookieSetup(
      {
        ...base,
        secure: false,
        samesite: "Lax",
        domain: null,
        origin_allowed: false,
      },
      "http://localhost:8000",
      "http://localhost:3000"
    )
    expect(corsHints.some((h) => h.includes("CORS"))).toBe(true)
    // Всё хорошо (единый хост localhost) — подсказок нет.
    expect(
      apiMod.diagnoseCookieSetup(
        { ...base, secure: false, samesite: "Lax", domain: null },
        "http://localhost:8000",
        "http://localhost:3000"
      )
    ).toEqual([])
  })

  it("2xx с не-JSON телом бросает ошибку, а не undefined", async () => {
    handlers.push(
      csrfOk,
      () =>
        new Response("<html>Bad Gateway</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
    )
    await expect(
      apiMod.api("/api/tournament/tournaments/", { method: "POST", body: "{}" })
    ).rejects.toMatchObject({ status: 200 })
  })

  it("cookies-blocked маркер распознаётся", () => {
    expect(apiMod.isCookiesBlockedError(apiMod.cookiesBlockedError())).toBe(
      true
    )
    expect(apiMod.isCookiesBlockedError(new Error("other"))).toBe(false)
    expect(apiMod.isCookiesBlockedError(null)).toBe(false)
  })

  it("resetCsrfToken сбрасывает кэш: следующий POST заново берёт CSRF", async () => {
    const csrfCalls = () =>
      calls.filter((c) => c.url.endsWith("/api/auth/csrf/")).length
    handlers.push(csrfOk, () => json({ ok: true }))
    await apiMod.api("/api/tournament/tatamis/", {
      method: "POST",
      body: JSON.stringify({ name: "T1", order: 1 }),
    })
    expect(csrfCalls()).toBe(1)
    handlers.push(() => json({ ok: true }))
    await apiMod.api("/api/tournament/tatamis/", {
      method: "POST",
      body: JSON.stringify({ name: "T2", order: 2 }),
    })
    expect(csrfCalls()).toBe(1)
    apiMod.resetCsrfToken()
    handlers.push(csrfOk, () => json({ ok: true }))
    await apiMod.api("/api/tournament/tatamis/", {
      method: "POST",
      body: JSON.stringify({ name: "T3", order: 3 }),
    })
    expect(csrfCalls()).toBe(2)
  })

  it("403 CSRF → сброс кэша и один повтор, затем успех", async () => {
    const posts = () =>
      calls.filter((c) => c.url.endsWith("/api/tournament/tatamis/")).length;
    const csrfFetches = () =>
      calls.filter((c) => c.url.endsWith("/api/auth/csrf/")).length;
    handlers.push(
      csrfOk, // CSRF перед первым POST
      () => json({ detail: "CSRF Failed: CSRF token missing." }, 403),
      csrfOk, // свежий CSRF после сброса
      () => json({ id: 7 })
    );
    const data = await apiMod.api<{ id: number }>(
      "/api/tournament/tatamis/",
      { method: "POST", body: JSON.stringify({ name: "T", order: 1 }) }
    );
    expect(data.id).toBe(7);
    expect(posts()).toBe(2);
    expect(csrfFetches()).toBe(2);
  });

  it("403 CSRF дважды → одна ошибка, без цикла", async () => {
    handlers.push(
      csrfOk,
      () => json({ detail: "CSRF Failed: CSRF cookie not set." }, 403),
      csrfOk,
      () => json({ detail: "CSRF Failed: CSRF cookie not set." }, 403)
    );
    await expect(
      apiMod.api("/api/tournament/tatamis/", {
        method: "POST",
        body: JSON.stringify({}),
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(
      calls.filter((c) => c.url.endsWith("/api/tournament/tatamis/"))
    ).toHaveLength(2);
  });

  it("403 без CSRF не повторяется и говорит про права", async () => {
    handlers.push(
      csrfOk,
      () => json({ detail: "You do not have permission to perform this action." }, 403)
    );
    const err = (await apiMod
      .api("/api/tournament/athletes/", {
        method: "POST",
        body: JSON.stringify({}),
      })
      .catch((e) => e)) as { status: number; message: string };
    expect(err.status).toBe(403);
    expect(err.message).toBe("Нет прав для этого действия.");
    expect(
      calls.filter((c) => c.url.endsWith("/api/tournament/athletes/"))
    ).toHaveLength(1);
  });

  it("apiErrorMessage достаёт полевые ошибки из ApiError.payload", () => {
    const err = {
      status: 400,
      payload: { weight: ["Вес должен быть положительным числом."] },
      message: "generic",
      name: "ApiError",
    }
    expect(apiMod.apiErrorMessage(err)).toBe(
      "Вес: Вес должен быть положительным числом."
    )
    // Прямая форма (сырой body) работает как раньше.
    expect(
      apiMod.apiErrorMessage({
        status: 400,
        first_name: ["Укажите настоящее имя (минимум 2 символа)."],
      })
    ).toBe("Имя: Укажите настоящее имя (минимум 2 символа).")
  })

  it("apiErrorMessage различает CSRF и права", () => {
    expect(
      apiMod.apiErrorMessage({ status: 403, detail: "CSRF Failed: x" })
    ).toContain("CSRF");
    expect(
      apiMod.apiErrorMessage({ status: 403, detail: "No permission" })
    ).toBe("Нет прав для этого действия.");
  });

  it("Phase 2: apiErrorMessage покрывает 409, сеть и apiErrorStatus", () => {
    // 409 с detail backend — показываем detail.
    expect(
      apiMod.apiErrorMessage({ status: 409, detail: "Уже заявлен." })
    ).toBe("Этот спортсмен уже заявлен.")
    // 409 без detail — общий текст про конфликт состояния.
    expect(apiMod.apiErrorMessage({ status: 409 })).toContain("конфликтует")
    // Сырой сетевой провал fetch — текст про соединение, а не «сохранить».
    expect(apiMod.apiErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "Нет соединения с сервером. Проверьте интернет."
    )
    expect(apiMod.apiErrorMessage({ status: 0 })).toBe(
      "Нет соединения с сервером. Проверьте интернет."
    )
    // Статус для ветвления UI; debug остаётся в самой ошибке.
    expect(apiMod.apiErrorStatus({ status: 404 })).toBe(404)
    expect(apiMod.apiErrorStatus(new TypeError("x"))).toBe(null)
    expect(apiMod.apiErrorStatus(null)).toBe(null)
  })

  it("P1: apiErrorMessage знает поля заявки и дружелюбные бизнес-ошибки", () => {
    expect(
      apiMod.apiErrorMessage({
        status: 400,
        phone: ["Укажите корректный телефон (7–15 цифр)."],
      })
    ).toBe("Телефон: Укажите корректный телефон (7–15 цифр).");
    expect(
      apiMod.apiErrorMessage({
        status: 400,
        new_password: ["Пароль должен содержать минимум 8 символов."],
      })
    ).toBe("Пароль: Пароль должен содержать минимум 8 символов.");
    expect(
      apiMod.apiErrorMessage({
        status: 400,
        detail: "Недействительная ссылка сброса.",
      })
    ).toBe("Ссылка сброса недействительна или устарела. Запросите новую.");
  });

  it("FormData повторяет отправку тем же телом без Content-Type", async () => {
    const form = new FormData()
    form.append("file", new Blob(["a,b"]), "kids.csv")
    let retryInit: RequestInit | undefined
    // POST unsafe → сначала CSRF, затем 401, затем refresh, затем повтор.
    handlers.push(
      csrfOk,
      () => json({}, 401),
      refreshOk,
      (_u, init) => {
        retryInit = init
        return json({ created: [], errors: [] })
      }
    )
    await apiMod.api("/api/tournament/athletes/import_csv/", {
      method: "POST",
      body: form,
    })
    expect(retryInit?.body).toBe(form)
    const headers = (retryInit?.headers ?? {}) as Record<string, string>
    expect(headers["Content-Type"]).toBeUndefined()
  })
})
