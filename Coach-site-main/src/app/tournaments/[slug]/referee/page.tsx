import { Suspense } from "react"
import Link from "next/link"
import { ArrowLeft, Gavel } from "lucide-react"
import LiveQueue from "@/components/LiveQueue"

/** Referee Mode v1: Fighter A/B, счёт, penalties через finish, next fight.
 * Доступ — owner/staff (гарды на backend: IsTrainer + owner). Без новых ролей/миграций. */
export default async function RefereePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tatami?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const tatami = sp.tatami ? Number(sp.tatami) : null

  return (
    <div className="min-h-screen bg-light-gray dark:bg-[#0B192B] p-4 sm:p-6">
      <div className="mx-auto max-w-[900px] space-y-5">
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href={`/tournaments/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-blue hover:text-primary-blue-light min-h-[44px]"
          >
            <ArrowLeft size={15} />К турниру
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-dark-blue text-gold flex items-center justify-center shrink-0">
              <Gavel size={18} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Режим судьи</h1>
              <p className="text-sm text-secondary-text">Только свой татами · крупные кнопки · следующий бой</p>
            </div>
          </div>
        </div>
        <Suspense fallback={<div role="status" className="kwf-card p-8 animate-pulse">Загрузка очереди…</div>}>
          <LiveQueue tournamentId={slug} refereeMode refereeTatamiId={Number.isFinite(tatami) ? tatami : null} />
        </Suspense>
      </div>
    </div>
  )
}
