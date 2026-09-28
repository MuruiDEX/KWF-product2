/**
 * M8: runtime URL API без пересборки образа.
 *
 * layout подкладывает /env.js через <Script beforeInteractive>, и
 * window.__KWF_API_URL имеет приоритет над запечённым NEXT_PUBLIC_API_URL.
 * Источник: server-only env KWF_API_URL (compose), fallback — build-time
 * NEXT_PUBLIC_API_URL. no-store: смена env видна сразу после рестарта.
 */
export async function GET() {
  const url =
    process.env.KWF_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000"
  const body = `window.__KWF_API_URL=${JSON.stringify(url)};`
  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
