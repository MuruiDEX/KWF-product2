import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * H6: server-side guard приватных разделов.
 *
 * Раньше защиты роутов не было вовсе (middleware/proxy отсутствовали) —
 * вся авторизация была клиентской: прямой заход на /cabinet или /admin
 * без сессии рендерил страницу и лишь потом редиректил.
 *
 * Это presence-check, а не валидация: proxy не знает JWT-секрет и не
 * может проверить подпись/истечение. Источник истины — backend
 * (401 → AUTH_EXPIRED_EVENT → разлогин). Здесь только быстрый редирект
 * на /login при явном отсутствии access-куки, без flash незалогиненного UI.
 *
 * Имя куки по умолчанию — access_token (backend JWT_AUTH_COOKIE).
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("access_token")
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url)
    const next = request.nextUrl.pathname + request.nextUrl.search
    loginUrl.searchParams.set("next", next)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/cabinet/:path*", "/admin/:path*"],
}
