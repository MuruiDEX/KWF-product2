"use client"

import { motion } from "framer-motion"
import { Medal, Weight, Cake, Tag } from "lucide-react"
import SectionHeader from "@/components/ui/SectionHeader"

interface ShowcaseAthlete {
  name: string
  initials: string
  age: string
  weight: string
  category: string
  achievement: string
  belt: string
}

const athletes: ShowcaseAthlete[] = [
  {
    name: "Александр Васильев",
    initials: "АВ",
    age: "14 лет",
    weight: "55 кг",
    category: "Юноши 14–15",
    achievement: "Чемпион области",
    belt: "Синий пояс",
  },
  {
    name: "Дмитрий Петров",
    initials: "ДП",
    age: "12 лет",
    weight: "42 кг",
    category: "Мальчики 12–13",
    achievement: "Призёр городского турнира",
    belt: "Зелёный пояс",
  },
  {
    name: "София Кузнецова",
    initials: "СК",
    age: "10 лет",
    weight: "32 кг",
    category: "Девочки 10–11",
    achievement: "Победитель клубного первенства",
    belt: "Оранжевый пояс",
  },
  {
    name: "Кирилл Новиков",
    initials: "КН",
    age: "9 лет",
    weight: "30 кг",
    category: "Мальчики 8–9",
    achievement: "Лучший боец месяца",
    belt: "Жёлтый пояс",
  },
]

export default function Athletes() {
  return (
    <section id="athletes" className="py-16 md:py-24 bg-white scroll-mt-24">
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHeader
          eyebrow="Спортсмены"
          title="Наши воспитанники"
          description="Ребята, которые уже сегодня показывают характер, технику и волю к победе"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {athletes.map((a, i) => (
            <motion.article
              key={a.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="group rounded-2xl bg-white border border-border overflow-hidden shadow-sm hover:shadow-xl hover:shadow-dark-blue/10 hover:border-primary-blue/25 transition-all duration-300"
            >
              <div className="relative bg-gradient-to-br from-dark-blue via-navy to-primary-blue px-6 pt-7 pb-6 overflow-hidden">
                <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-gold/15 blur-2xl" aria-hidden="true" />
                <div className="absolute bottom-2 right-4 text-[64px] font-black text-white/[0.06] leading-none select-none" aria-hidden="true">
                  極
                </div>
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-center text-lg font-extrabold text-gold shrink-0">
                    {a.initials}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white truncate">{a.name}</h3>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold/90 mt-0.5">{a.belt}</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-2.5">
                <div className="flex items-center gap-2 text-[13px] text-secondary-text">
                  <Cake size={14} className="text-primary-blue shrink-0" />
                  {a.age}
                  <span className="text-border">·</span>
                  <Weight size={14} className="text-primary-blue shrink-0" />
                  {a.weight}
                </div>
                <div className="flex items-center gap-2 text-[13px] text-secondary-text">
                  <Tag size={14} className="text-primary-blue shrink-0" />
                  {a.category}
                </div>
                <div className="flex items-start gap-2 pt-2 mt-1 border-t border-border text-[13px] font-semibold text-dark-text leading-snug">
                  <Medal size={14} className="text-gold shrink-0 mt-0.5" />
                  {a.achievement}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
