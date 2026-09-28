import { redirect } from "next/navigation"

// Волна A (N2): отдельный конструктор сетки схлопнут в таб manage.
// Оставлен редирект, чтобы не ломать сохранённые ссылки.
export default async function TournamentBracketAliasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/cabinet/tournaments/${id}/manage?tab=bracket`)
}
