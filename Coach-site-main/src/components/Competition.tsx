// «От зала — к татами»: путь от тренировок к соревнованиям.
// Без выдуманных цифр и без нерелевантных фото — editorial-типографика
// и честные ссылки на реальные разделы платформы.

"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import SectionHeader from "@/components/ui/SectionHeader"
import { KanjiBackdrop } from "@/components/JapaneseAccent"

const paths = [
  {
    index: "01",
    title: "Соревнования",
    desc: "Городские и всероссийские старты — календарь и заявки.",
    href: "/tournaments",
    link: "Календарь",
  },
  {
    index: "02",
    title: "Категории",
    desc: "Возраст, вес и пол — каждый выступает со своими.",
    href: "/tournaments",
    link: "Турниры",
  },
  {
    index: "03",
    title: "Спортсмены",
    desc: "Профили, история боёв и медали участников.",
    href: "/athletes",
    link: "Спортсмены",
  },
  {
    index: "04",
    title: "Результаты",
    desc: "Сетки, протоколы и итоги — live и в архиве.",
    href: "/live",
    link: "Смотреть LIVE",
  },
]

export default function Competition() {
  return (
    <section aria-label="От зала — к татами" className="kwf-section relative overflow-hidden bg-light-gray border-y border-border/60">
      <KanjiBackdrop className="-left-4 -bottom-10 text-[150px] md:text-[200px]">
        道
      </KanjiBackdrop>
      <div className="kwf-container relative">
        <SectionHeader
          align="left"
          number="05"
          eyebrow="Соревнования"
          title="От зала — к татами"
          description="Тренировки ведут сюда: категории, соперники, медали и честные результаты."
        />
        <div className="rounded-2xl border border-border bg-white p-6 md:p-10 shadow-sm">
        <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {paths.map((path, idx) => (
            <motion.li
              key={path.index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: idx * 0.06 }}
              className="border-t-2 border-dark-blue/15 pt-4"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-sm font-black tabular-nums text-gold-deep" aria-hidden="true">
                  {path.index}
                </span>
                <h3 className="text-lg md:text-xl font-extrabold text-dark-text tracking-tight">
                  {path.title}
                </h3>
              </div>
              <p className="mt-1.5 text-sm text-secondary-text leading-relaxed">
                {path.desc}{" "}
                <Link
                  href={path.href}
                  className="font-bold text-primary-blue hover:text-primary-blue-light transition-colors whitespace-nowrap"
                >
                  {path.link} →
                </Link>
              </p>
            </motion.li>
          ))}
        </ul>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-8"
        >
          <Link
            href="/live/tv"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-blue hover:text-primary-blue-light transition-colors"
          >
            Табло для зала — режим TV
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </motion.div>
        </div>
      </div>
    </section>
  )
}
