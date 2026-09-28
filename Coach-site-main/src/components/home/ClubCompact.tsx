"use client"

import Link from "next/link"
import { ArrowRight, CalendarDays, MapPin } from "lucide-react"
import { CONTACTS } from "@/lib/constants"
import SectionHeader from "@/components/ui/SectionHeader"

export default function ClubCompact() {
  return (
    <section aria-label="Клуб" id="club" className="kwf-section bg-white dark:bg-[#07111F] scroll-mt-24">
      <div className="kwf-container">
        <SectionHeader
          eyebrow="Dojo"
          title="Клуб"
          description="База платформы: тренировки, тренерский состав и расписание"
          align="left"
        />
        <div className="mb-6 -mt-6">
          <Link href="/club" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-blue hover:text-primary-blue-light min-h-[44px]">
            О клубе <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="kwf-card p-5">
            <p className="kwf-meta text-gold mb-2">Тренировки</p>
            <p className="font-bold text-[15px]">Группы 4–17 лет · кихон, ката, кумитэ</p>
            <p className="text-sm text-secondary-text mt-1.5 leading-relaxed">Дисциплина и техника — от первого пояса до турнирных татами.</p>
            <Link href="/schedule" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-blue">
              <CalendarDays size={15} /> Расписание
            </Link>
          </div>
          <div className="kwf-card p-5">
            <p className="kwf-meta text-gold mb-2">Адрес</p>
            <p className="font-bold text-[15px]">{CONTACTS.addressShort}</p>
            <p className="text-sm text-secondary-text mt-1.5">{CONTACTS.address}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-text">
              <MapPin size={15} className="text-gold" /> {CONTACTS.phoneLabel}
            </p>
          </div>
          <div className="kwf-card p-5 border-gold/30">
            <p className="kwf-meta text-gold mb-2">Родителям</p>
            <p className="font-bold text-[15px]">Привяжите ребёнка по коду — и следите за его боями</p>
            <p className="text-sm text-secondary-text mt-1.5">Tatami · Fight # · ETA старта. Уведомления о вызове на татами.</p>
            <Link href="/register" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-blue">
              Создать кабинет <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
