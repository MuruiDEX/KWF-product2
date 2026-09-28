import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Inter, Manrope } from "next/font/google"
import { AuthProvider } from "@/lib/auth"
import { QueryProvider } from "@/components/QueryProvider"
import { ThemeProvider, themeInitScript } from "@/lib/theme"
import { Toaster } from "@/components/ui/Toaster"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"
import "./globals.css"

const inter = Inter({
  subsets: ["cyrillic", "latin"],
  display: "swap",
  variable: "--font-inter",
})

// Manrope — заголовки: сильный спортивный характер, кириллица + латиница.
// Текст и интерфейс остаются на Inter.
const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  display: "swap",
  variable: "--font-manrope",
})

// Базовый URL сайта для canonical/OG — задаётся окружением на деплое.
// Без него относительные OG-пути не резолвятся, поэтому metadataBase
// и OG-изображения подключаем только когда URL известен.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: "Кекушин Карате | Тренировки для детей",
  description:
    "Профессиональные тренировки по Кёкушинкай карате для детей. Воспитываем силу духа, дисциплину и уверенность.",
  // F3: PWA — manifest, иконки, iOS-режим приложения.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "KWF",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Кекушин Карате | Тренировки для детей",
    description:
      "Профессиональные тренировки по Кёкушинкай карате для детей.",
    type: "website",
    locale: "ru_RU",
    siteName: "KWF — Кёкушинкай карате",
    ...(siteUrl
      ? { url: "/", images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }] }
      : {}),
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#071426" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`${inter.variable} ${manrope.variable} min-h-screen antialiased`} suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        {/* M8: runtime URL API (window.__KWF_API_URL) — до интерактива,
            чтобы apiBaseUrl() видел его при первых запросах. */}
        <Script src="/env.js" strategy="beforeInteractive" />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        {/* SEO: структурированные данные организации (статично, без динамики). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SportsClub",
              name: "KWF — Кёкушинкай карате",
              sport: "Kyokushin Karate",
              inLanguage: "ru",
            }),
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <QueryProvider>{children}</QueryProvider>
          </AuthProvider>
          <Toaster />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
