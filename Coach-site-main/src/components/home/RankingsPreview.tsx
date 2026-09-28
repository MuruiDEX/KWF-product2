"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Medal, Trophy } from "lucide-react"
import { api, unwrapList } from "@/lib/api"
import type { Match, Tournament } from "@/lib/types"
import SectionHeader from "@/components/ui/SectionHeader"
import EmptyState from "@/components/ui/EmptyState"
import { SkeletonGrid } from "@/components/ui/SkeletonCard"

interface WinnerRow {
  name: string
  tournament: string
  slug: string
  category: string
}

function collectWinners(t: Tournament): WinnerRow[] {
  const rows: WinnerRow[] = []
  for (const c of t.categories ?? []) {
    for (const r of c.rounds ?? []) {
      for (const m of (r.matches ?? []) as Match[]) {
        if (m.status === "finished" && m.winner_name) {
          rows.push({ name: m.winner_name, tournament: t.name, slug: t.slug, category: c.name })
        }
      }
    }
  }
  return rows
}

export default function RankingsPreview() {
  const [rows, setRows] = useState<WinnerRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api<Tournament[] | { results: Tournament[] }>("/api/tournament/tournaments/")
        const list = unwrapList(data)
        const finished = list.filter((t) => t.status === "finished").slice(-2).reverse()
        const all: WinnerRow[] = []
        for (const t of finished.slice(0, 1)) {
          try {
            const detail = await api<Tournament>(`/api/tournament/tournaments/${t.slug}/`)
            all.push(...collectWinners(detail))
          } catch {
            /* один турнир недоступен — пропускаем */
          }
        }
        // Дедуп по имени: последний титул важнее.
        const seen = new Set<string>()
        const top = all.filter((w) => {
          if (seen.has(w.name)) return false
          seen.add(w.name)
          return true
        }).slice(0, 5)
        if (!cancelled) setRows(top)
      } catch {
        /* offline — покажем empty */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section aria-label="Рейтинги и спортсмены" className="kwf-section bg-light-gray dark:bg-[#0B192B] border-y border-border">
      <div className="kwf-container">
        <SectionHeader
          eyebrow="Competition"
          title="Рейтинги и спортсмены"
          description="Победители последних турниров — только реальные данные протоколов"
          align="left"
        />
        <div className="mb-6 -mt-6 flex items-center gap-5">
          <Link href="/athletes" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-blue hover:text-primary-blue-light min-h-[44px]">
            Все спортсмены <ArrowRight size={15} />
          </Link>
          <Link href="/rankings" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-blue hover:text-primary-blue-light min-h-[44px]">
            Рейтинги <ArrowRight size={15} />
          </Link>
        </div>
        {loading ? (
          <SkeletonGrid count={3} label="Загрузка результатов…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Trophy className="w-7 h-7" strokeWidth={1.5} />}
            title="Рейтинги появятся после первых финалов"
            hint="Пока нет завершённых боёв с победителями — следите за live"
            action={<Link href="/live" className="text-sm font-bold text-primary-blue">Открыть live →</Link>}
          />
        ) : (
          <ol className="kwf-card divide-y divide-border overflow-hidden">
            {rows.map((w, i) => (
              <li key={`${w.name}-${i}`}>
                <Link href={`/tournaments/${w.slug}?tab=results`} className="flex items-center gap-4 px-5 py-4 hover:bg-primary-blue/5 transition-colors min-h-[56px]">
                  <span className="kwf-numeric w-8 text-lg font-extrabold text-secondary-text">{String(i + 1).padStart(2, "0")}</span>
                  <span className="w-9 h-9 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
                    <Medal size={16} className="text-gold" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold truncate">{w.name}</span>
                    <span className="block text-[13px] text-secondary-text truncate">{w.category} · {w.tournament}</span>
                  </span>
                  <ArrowRight size={16} className="text-secondary-text shrink-0" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
