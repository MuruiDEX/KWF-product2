import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { AuthProvider } from "@/lib/auth"
import { ThemeProvider, themeInitScript } from "@/lib/theme"
import "./globals.css"

const inter = Inter({
  subsets: ["cyrillic", "latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Кекушин Карате | Тренировки для детей",
  description:
    "Профессиональные тренировки по Кёкушинкай карате для детей. Воспитываем силу духа, дисциплину и уверенность.",
  openGraph: {
    title: "Кекушин Карате | Тренировки для детей",
    description:
      "Профессиональные тренировки по Кёкушинкай карате для детей.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`${inter.variable} min-h-screen antialiased`} suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        {/* Обычный script в Server Component рендерится в статичный HTML
            до paint: без warning React и без мигания темы. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
