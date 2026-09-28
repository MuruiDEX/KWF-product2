"use client"

import { useState, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/queryClient"

// Phase 0: тонкий провайдер без визуала. Монтируется в RootLayout
// поверх children — server state доступен везде, layout не меняется.
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => getQueryClient())
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
