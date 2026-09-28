import Link from "next/link"
import { ArrowRight } from "lucide-react"
import AppShell from "@/components/AppShell"
import { PageHeader } from "@/components/ui/PageHeader"
import { CONTACTS } from "@/lib/constants"

export const metadata = {
  title: "Клуб | KWF Tournament Platform",
  description: "Клуб Kyokushin KWF: тренировки, расписание, контакты.",
}

export default function ClubPage() {
  return (
    <AppShell className="dark:bg-[#07111F]">
        <div className="kwf-container py-10 md:py-14">
          <PageHeader
            eyebrow="Dojo"
            title="Клуб"
            description="База KWF Tournament Platform: тренировки и команда"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="kwf-card p-6">
              <p className="kwf-meta text-gold mb-2">Тренировки</p>
              <p className="font-bold">Группы 4–17 лет · кихон, ката, кумитэ</p>
              <p className="text-sm text-secondary-text mt-2 leading-relaxed">
                Дисциплина, техника и подготовка к турнирным татами — от первого занятия до пьедестала.
              </p>
              <Link href="/schedule" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-blue">
                Расписание <ArrowRight size={15} />
              </Link>
            </div>
            <div className="kwf-card p-6">
              <p className="kwf-meta text-gold mb-2">Контакты</p>
              <p className="font-bold">{CONTACTS.address}</p>
              <p className="text-sm text-secondary-text mt-2">{CONTACTS.phoneLabel} · {CONTACTS.email}</p>
              <Link href="/news" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-blue">
                Новости клуба <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
    </AppShell>
  )
}
