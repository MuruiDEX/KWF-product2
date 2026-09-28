import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // L4: http-origins localhost убраны — next/image в проекте не
    // используется (картинки через plain <img>), whitelist держать
    // минимальным. Понадобится next/image для медиа backend —
    // добавить https-хост явно, не http.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async redirects() {
    // Фаза 0: legacy-прототипы /tournament* удалены — ведём на актуальные /tournaments.
    return [
      // Волна A (N1): сломанный форк визарда удалён — единый визард в кабинете.
      { source: "/admin/tournaments/new", destination: "/cabinet/tournaments/create", permanent: true },
      { source: "/tournament", destination: "/tournaments", permanent: true },
      { source: "/tournament/:path*", destination: "/tournaments/:path*", permanent: true },
      { source: "/tournament_view", destination: "/tournaments", permanent: true },
      { source: "/tournament_view/:path*", destination: "/tournaments/:path*", permanent: true },
    ];
  },
  async headers() {
    // M3: baseline CSP. script/style 'unsafe-inline' обязательны для
    // Next.js (inline-скрипты фреймворка + theme-init); img/connect
    // открыты широко (unsplash, медиа backend, API на :8000/кросс-домен).
    // Ценность: object-src/base-uri/frame-ancestors закрыты.
    // React/Next dev-tooling (Fast Refresh, реконструкция стеков) требует
    // eval() только в development — 'unsafe-eval' добавляем только там.
    // Production остаётся без 'unsafe-eval'.
    const isDev = process.env.NODE_ENV !== "production";
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
    // Dev HMR/Fast Refresh открывает WebSocket к dev-серверу — без ws:/wss:
    // connect-src блокирует живой релоад. В production HMR нет — prod строже.
    const connectSrc = isDev
      ? "connect-src 'self' http: https: ws: wss:"
      : "connect-src 'self' http: https:";
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      connectSrc,
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ]
  },
};

export default nextConfig;
