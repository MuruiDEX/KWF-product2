// Phase 3: заглушка публичного каталога спортсменов.
// Public athletes API пока нет (список — auth-only), PII не публикуем.

import Link from "next/link"
import { Users } from "lucide-react"
import AppShell from "@/components/AppShell"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { PageHeader } from "@/components/ui/PageHeader"
import EmptyState from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/button"

export default function AthletesPage() {
  return (
    <AppShell>
      <div className="kwf-page">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Спортсмены" }]} />
        <PageHeader
          eyebrow="Сообщество"
          title="Спортсмены"
          description="Участники турниров платформы"
          className="mt-4"
        />
        <div className="rounded-2xl border border-border bg-white dark:bg-[#0E2035]">
          <EmptyState
            icon={<Users size={26} />}
            title="Каталог спортсменов скоро появится"
            hint="Публичные профили с турнирной историей откроются после первых турниров сезона"
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
