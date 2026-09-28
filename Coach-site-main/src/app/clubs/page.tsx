// Phase 3: заглушка публичного каталога клубов.
// Public clubs API пока нет — честный EmptyState вместо выдуманных карточек.

import Link from "next/link"
import { Shield } from "lucide-react"
import AppShell from "@/components/AppShell"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { PageHeader } from "@/components/ui/PageHeader"
import EmptyState from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/button"

export default function ClubsPage() {
  return (
    <AppShell>
      <div className="kwf-page">
        <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Клубы" }]} />
        <PageHeader
          eyebrow="Сообщество"
          title="Клубы"
          description="Клубы-участники турниров платформы"
          className="mt-4"
        />
        <div className="rounded-2xl border border-border bg-white dark:bg-[#0E2035]">
          <EmptyState
            icon={<Shield size={26} />}
            title="Каталог клубов скоро появится"
            hint="Публичные профили клубов с составом и результатами откроются вместе с сезоном"
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
