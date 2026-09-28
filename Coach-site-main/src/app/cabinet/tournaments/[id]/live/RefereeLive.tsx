"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Gavel } from "lucide-react"
import LiveQueue from "@/components/LiveQueue"

/** N6: интерфейс судьи — только очередь боёв, без manage-хрома.
 * Действия судейства выполняет backend (IsTrainer + owner-гарды),
 * ошибки видны через notice в LiveQueue. */
export function RefereeLive({
  tournamentId,
  initialTatamiId,
}: {
  tournamentId: string
  initialTatamiId: number | null
}) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-light-gray p-4 sm:p-6">
      <div className="mx-auto max-w-[900px] space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-secondary-text shrink-0"
            onClick={() => router.back()}
          >
            <ArrowLeft size={16} />
            Назад
          </Button>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-dark-blue text-gold flex items-center justify-center shrink-0">
              <Gavel size={18} />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-dark-text tracking-tight">
                Режим судьи
              </h1>
              <p className="text-sm text-secondary-text">
                Мой татами · текущий и следующий бои
              </p>
            </div>
          </div>
        </div>

        <LiveQueue
          tournamentId={tournamentId}
          refereeMode
          refereeTatamiId={initialTatamiId}
        />
      </div>
    </div>
  )
}
