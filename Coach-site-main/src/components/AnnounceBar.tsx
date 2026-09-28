"use client"

import { useState } from "react"
import { Megaphone } from "lucide-react"
import { api, apiErrorMessage } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/Toaster"

/** Фаза 2 (N8): объявление организатора в ленту турнира. */
export function AnnounceBar({
  tournamentId,
  inputId = "announce-input",
  onSent,
}: {
  tournamentId: string | number
  /** Уникальный id поля (вкладка «Связь» рендерит второй экземпляр). */
  inputId?: string
  onSent?: () => void
}) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)

  const send = async () => {
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    try {
      await api(`/api/tournament/tournaments/${tournamentId}/announce/`, {
        method: "POST",
        body: JSON.stringify({ text: value }),
      })
      setText("")
      toast("Объявление опубликовано", "success")
      onSent?.()
    } catch (e) {
      toast(apiErrorMessage(e), "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gold/40 bg-gold-soft/50 p-4 shadow-sm dark:bg-gold/10">
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="flex items-center gap-2 flex-1 min-w-0">
          <Megaphone size={16} className="text-dark-blue shrink-0 dark:text-gold-pale" />
          <span className="sr-only">Текст объявления</span>
          <input
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send()
            }}
            placeholder="Объявление для всех: «Финал на татами 1 через 5 минут»…"
            maxLength={255}
            className="w-full h-10 px-3 rounded-xl border border-gold/40 bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 dark:bg-white/5 dark:text-white"
          />
        </label>
        <Button
          onClick={() => void send()}
          disabled={busy || text.trim().length === 0}
          size="sm"
          className="h-10 shrink-0"
        >
          {busy ? "Публикация…" : "Объявить"}
        </Button>
      </div>
    </div>
  )
}
