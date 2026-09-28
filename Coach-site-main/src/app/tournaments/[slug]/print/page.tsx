"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Printer, ArrowLeft } from "lucide-react"
import { api } from "@/lib/api"
import type { Tournament } from "@/lib/types"
import { championOf } from "@/lib/bracketUtils"
import EmptyState from "@/components/ui/EmptyState"
import { Trophy } from "lucide-react"

/** Фаза 7: печатный протокол турнира (вместо PDF — без бинарных шрифтов
 * в репозитории; браузерная печать кириллицы работает из коробки). */
export default function TournamentPrintPage() {
  const params = useParams()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<Tournament>(`/api/tournament/tournaments/${params.slug}/`)
      .then((data) => {
        if (!cancelled) setTournament(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [params.slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div
          role="status"
          aria-label="Загрузка протокола"
          className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin"
        />
      </div>
    )
  }

  if (failed || !tournament) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-border">
          <EmptyState
            icon={<Trophy size={26} />}
            title="Протокол недоступен"
            hint="Турнир не найден или нет доступа"
          />
        </div>
      </div>
    )
  }

  const dateRange = `${new Date(tournament.start_date).toLocaleDateString("ru-RU")} — ${new Date(tournament.end_date).toLocaleDateString("ru-RU")}`
  const categories = [...(tournament.categories || [])].sort(
    (a, b) => a.order - b.order
  )

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-[900px] px-6 py-8 print:px-0 print:py-0 print:max-w-none">
        <div className="flex items-center justify-between gap-4 mb-6 print:hidden">
          <Link
            href={`/tournaments/${params.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-blue hover:text-primary-blue-light"
          >
            <ArrowLeft size={15} />К турниру
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-dark-blue text-white text-sm font-bold hover:bg-primary-blue transition-colors cursor-pointer"
          >
            <Printer size={16} />
            Печать протокола
          </button>
        </div>

        <header className="text-center mb-8">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
            Протокол соревнований
          </div>
          <h1 className="text-2xl font-extrabold mt-1">{tournament.name}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {dateRange}
            {tournament.location ? ` · ${tournament.location}` : ""}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Онлайн-табло: {typeof window !== "undefined" ? window.location.origin : ""}/tournaments/{tournament.slug}/board
          </p>
        </header>

        {categories.length === 0 && (
          <p className="text-center text-gray-500">Категорий пока нет.</p>
        )}

        {categories.map((cat) => {
          const rounds = [...(cat.rounds || [])].sort((a, b) => a.order - b.order)
          // N8: клуб/вес из состава категории (у анонимов их может не быть — fallback).
          const infoById = new Map(
            (cat.athletes || []).map((a) => [a.id, a] as const)
          )
          const detailOf = (id: number | null, name: string | null) => {
            if (id === null) return name ?? "TBD"
            const a = infoById.get(id)
            if (!a) return name ?? "TBD"
            const bits = [a.club?.trim(), a.weight ? `${a.weight} кг` : ""].filter(Boolean)
            return bits.length > 0 ? `${name ?? "TBD"} (${bits.join(", ")})` : (name ?? "TBD")
          }
          const allMatches = rounds.flatMap((r) =>
            (r.matches || []).map((m) => ({ ...m, roundName: r.name }))
          )
          // N8: автопроходы не печатаем (мусор в протоколе), считаем для сноски.
          const byeCount = allMatches.filter((m) => m.status === "bye").length
          const fights = allMatches.filter((m) => m.status !== "bye")
          const champion = championOf(
            rounds.map((r) => ({
              matches: (r.matches || []).map((m) => ({
                winnerId: m.winner ?? null,
                winnerName: m.winner_name ?? null,
                athlete1: { id: m.athlete1, name: m.athlete1_name },
                athlete2: { id: m.athlete2, name: m.athlete2_name },
              })),
            }))
          )
          return (
            <section key={cat.id} className="mb-8 break-inside-avoid">
              <h2 className="text-lg font-extrabold border-b-2 border-black pb-1 mb-3">
                {cat.name}
                <span className="ml-2 text-xs font-semibold text-gray-500">
                  {cat.gender === "male"
                    ? "Мальчики"
                    : cat.gender === "female"
                      ? "Девочки"
                      : "Смешанная"}{" "}
                  · {cat.age_min}–{cat.age_max} лет · до {cat.weight_max} кг
                </span>
              </h2>
              {champion && (
                <p className="text-sm font-bold mb-2">
                  Чемпион: {champion}
                </p>
              )}
              {fights.length === 0 ? (
                <p className="text-sm text-gray-500">Сетка ещё не создана.</p>
              ) : (
                <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[560px] text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="text-left py-1.5 pr-2 font-bold">Раунд</th>
                      <th className="text-left py-1.5 pr-2 font-bold">№</th>
                      <th className="text-left py-1.5 pr-2 font-bold">Участники</th>
                      <th className="text-center py-1.5 pr-2 font-bold">Счёт</th>
                      <th className="text-left py-1.5 pr-2 font-bold">Победитель</th>
                      <th className="text-left py-1.5 font-bold">Татами</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fights.map((m) => (
                      <tr key={m.id} className="border-b border-gray-300">
                        <td className="py-1.5 pr-2">{m.roundName}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{m.match_number}</td>
                        <td className="py-1.5 pr-2">
                          {detailOf(m.athlete1, m.athlete1_name)} — {detailOf(m.athlete2, m.athlete2_name)}
                        </td>
                        <td className="py-1.5 pr-2 text-center tabular-nums">
                          {m.score1}:{m.score2}
                        </td>
                        <td className="py-1.5 pr-2 font-bold">
                          {m.winner_name ?? "—"}
                        </td>
                        <td className="py-1.5">{m.tatami_name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
              {byeCount > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Автопроходы (BYE): {byeCount} — не печатаются.
                </p>
              )}
            </section>
          )
        })}

        {(() => {
          const diplomas: { champion: string; category: string }[] = []
          for (const cat of categories) {
            const rounds = [...(cat.rounds || [])].sort((a, b) => a.order - b.order)
            const champion = championOf(
              rounds.map((r) => ({
                matches: (r.matches || []).map((m) => ({
                  winnerId: m.winner ?? null,
                  winnerName: m.winner_name ?? null,
                  athlete1: { id: m.athlete1, name: m.athlete1_name },
                  athlete2: { id: m.athlete2, name: m.athlete2_name },
                })),
              }))
            )
            if (champion) diplomas.push({ champion, category: cat.name })
          }
          if (diplomas.length === 0) return null
          return (
            <section aria-label="Дипломы чемпионов" className="mt-10">
              <h2 className="text-lg font-extrabold border-b-2 border-black pb-1 mb-4">
                Дипломы чемпионов
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {diplomas.map((d, i) => (
                  <div
                    key={`${d.category}-${i}`}
                    className="rounded-2xl border-2 border-black p-6 text-center break-inside-avoid"
                  >
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
                      Диплом · 1-е место
                    </div>
                    <div className="text-xl font-extrabold mt-2">{d.champion}</div>
                    <div className="text-sm text-gray-600 mt-1">{d.category}</div>
                    <div className="text-xs text-gray-500 mt-2">
                      {tournament.name} · {dateRange}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })()}

        <footer className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="text-gray-500 text-xs mb-6">Главный судья</div>
            <div className="border-t border-black pt-1">подпись / ФИО</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-6">Главный секретарь</div>
            <div className="border-t border-black pt-1">подпись / ФИО</div>
          </div>
        </footer>
      </div>
    </div>
  )
}
