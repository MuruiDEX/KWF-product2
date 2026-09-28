// Phase 3: превью «Рейтинги · Клубы · Спортсмены».
// Публичных ranking/club/athlete endpoints пока нет (club_stats и stats —
// staff/auth-only), поэтому честные заглушки без выдуманных данных.

import Link from "next/link"
import { Medal, Shield, Users } from "lucide-react"
import SectionHeader from "@/components/ui/SectionHeader"
import { SideKanji } from "@/components/JapaneseAccent"

const ITEMS = [
  {
    icon: Medal,
    title: "Рейтинги",
    hint: "Рейтинг будет доступен после публикации сезона",
    href: "/rankings",
    cta: "Все рейтинги",
  },
  {
    icon: Shield,
    title: "Клубы",
    hint: "Каталог клубов-участников появится вместе с сезоном",
    href: "/clubs",
    cta: "Все клубы",
  },
  {
    icon: Users,
    title: "Спортсмены",
    hint: "Профили спортсменов откроются после первых турниров сезона",
    href: "/athletes",
    cta: "Все спортсмены",
  },
]

export default function HomeDirectory() {
  return (
    <section aria-label="Рейтинги, клубы и спортсмены" className="kwf-section relative">
      <SideKanji className="absolute right-4 top-10">極真</SideKanji>
      <div className="kwf-container">
        <SectionHeader
          align="left"
          number="08"
          eyebrow="Сообщество"
          title="Рейтинги, клубы и спортсмены"
          description="Публичные каталоги платформы"
        />
        <div className="rounded-2xl border border-border bg-white p-6 md:p-8 shadow-sm">
        <ul className="grid md:grid-cols-3 gap-6 md:divide-x md:divide-border/70">
          {ITEMS.map((item) => (
            <li key={item.href} className="flex items-start gap-4 md:px-6 md:first:pl-0 md:last:pr-0">
              <div className="w-12 h-12 rounded-xl bg-light-gray border border-border flex items-center justify-center text-secondary-text shrink-0">
                <item.icon size={22} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-dark-text">{item.title}</h3>
                <p className="text-sm text-secondary-text mt-1 leading-relaxed">
                  {item.hint}
                </p>
                <Link
                  href={item.href}
                  className="inline-block mt-2 text-sm font-bold text-primary-blue hover:text-primary-blue-light transition-colors"
                >
                  {item.cta} →
                </Link>
              </div>
            </li>
          ))}
        </ul>
        </div>
      </div>
    </section>
  )
}
