// Клубное представление: editorial-типографика вместо фото и карточек.
// Только факты из репозитория (название, адрес, возрастные группы) —
// достижений, дат и аффилиаций не выдумываем. Без фотографий: вместо
// нерелевантного стока — композиция, линии и слабый watermark.

"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { MapPin } from "lucide-react"
import { CONTACTS, SITE_NAME } from "@/lib/constants"
import SectionHeader from "@/components/ui/SectionHeader"
import { KanjiBackdrop, SideKanji } from "@/components/JapaneseAccent"

const pillars = [
  {
    index: "01",
    title: "DISCIPLINE",
    name: "Дисциплина",
    desc: "Регулярные тренировки, уважение к тренеру и партнёру, порядок в зале и в голове.",
  },
  {
    index: "02",
    title: "TECHNIQUE",
    name: "Техника",
    desc: "Кихон, ката и кумитэ: базовая школа Кёкушинкай от первых стоек до свободных поединков.",
    href: "/schedule",
    link: "Расписание занятий",
  },
  {
    index: "03",
    title: "CHARACTER",
    name: "Характер",
    desc: "Физическая подготовка и сила духа. Тренировочные группы для детей и подростков от 4 до 17 лет.",
  },
  {
    index: "04",
    title: "COMPETITION",
    name: "Соревнования",
    desc: "Спортивный путь от первых стартов до турниров — ученики клуба выступают на соревнованиях.",
    href: "/tournaments",
    link: "Календарь турниров",
  },
]

export default function ClubAbout() {
  return (
    <section id="about" aria-label="О клубе" className="kwf-section relative overflow-hidden scroll-mt-24">
      <KanjiBackdrop className="-right-4 -bottom-12 text-[170px] md:text-[220px]">
        極
      </KanjiBackdrop>
      <div className="kwf-container relative">
        <SideKanji className="absolute -left-1 top-2">極真空手</SideKanji>
        <SectionHeader
          align="left"
          number="01"
          kanji="極真"
          eyebrow="О клубе"
          title={`${SITE_NAME} — характер, который формируется тренировкой`}
        />
        <div className="rounded-2xl border border-border bg-white p-6 md:p-10 shadow-sm">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="text-lg md:text-xl leading-relaxed text-dark-text max-w-3xl text-balance"
        >
          Каратэ — это не только техника. KWF — клуб Кёкушинкай карате,
          где дети и подростки учатся дисциплине, уважению и умению
          доводить начатое до конца — от первой тренировки до татами.
        </motion.p>
        <ul className="mt-10 divide-y divide-border/70 border-y border-border/70">
          {pillars.map((pillar, idx) => (
            <motion.li
              key={pillar.index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: idx * 0.06 }}
              className="grid gap-1 sm:grid-cols-[64px_220px_1fr] sm:gap-6 items-baseline py-5"
            >
              <span className="text-sm font-black tabular-nums text-gold-deep" aria-hidden="true">
                {pillar.index}
              </span>
              <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-dark-text">
                {pillar.title}
                <span className="block mt-1 text-sm font-bold normal-case tracking-normal text-secondary-text">
                  {pillar.name}
                </span>
              </span>
              <span className="text-sm md:text-base text-secondary-text leading-relaxed max-w-2xl">
                {pillar.desc}{" "}
                {pillar.href && (
                  <Link
                    href={pillar.href}
                    className="font-bold text-primary-blue hover:text-primary-blue-light transition-colors whitespace-nowrap"
                  >
                    {pillar.link} →
                  </Link>
                )}
              </span>
            </motion.li>
          ))}
        </ul>
        <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-text">
          <MapPin size={15} className="text-gold-deep shrink-0" aria-hidden="true" />
          {CONTACTS.address}
        </p>
        </div>
      </div>
    </section>
  )
}
