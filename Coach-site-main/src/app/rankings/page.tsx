// Phase 3: заглушка публичных рейтингов.
// Global ranking API пока нет — честный EmptyState вместо выдуманных данных.

import Link from "next/link"
import { Medal } from "lucide-react"
import AppShell from "@/components/AppShell"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { PageHeader } from "@/components/ui/PageHeader"
import EmptyState from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/button"

export default function RankingsPage() {
  return (
    <AppShell>
      <div className="kwf-page">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Рейтинги" }]} />
        <PageHeader
          eyebrow="Сообщество"
          title="Рейтинги"
          description="Турнирный рейтинг спортсменов и клубов"
          className="mt-4"
        />
        <div className="rounded-2xl border border-border bg-white dark:bg-[#0E2035]">
          <EmptyState
            icon={<Medal size={26} />}
            title="Рейтинг будет доступен после публикации сезона"
            hint="Баллы начисляются за официальные турниры платформы — методология будет опубликована вместе с первым сезоном"
            action={
              <Link href="/tournaments">
                <Button>Смотреть турниры</Button>
              </Link>
            }
          />
        </div>
      </div>
    </AppShell>
  )
}
