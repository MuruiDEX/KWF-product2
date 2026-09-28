import { redirect } from "next/navigation"
import { RefereeLive } from "./RefereeLive"

// Волна A (N2): отдельная live-страница схлопнута в таб manage.
// Волна B (N6): исключение — ?referee=1 открывает выделенный
// интерфейс судьи (только свой татами, крупные кнопки).
// Остальные заходы редиректят, чтобы не ломать сохранённые ссылки.
export default async function LiveTournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ referee?: string; tatami?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  if (sp.referee) {
    const tatami = sp.tatami ? Number(sp.tatami) : null
    return (
      <RefereeLive
        tournamentId={id}
        initialTatamiId={Number.isFinite(tatami) ? tatami : null}
      />
    )
  }
  redirect(`/cabinet/tournaments/${id}/manage?tab=live`)
}
