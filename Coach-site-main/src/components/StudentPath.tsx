// Путь ученика: generic training journey без выдуманных сроков,
// процентов и гарантий. Только этапы и их смысл.

"use client"

import { motion } from "framer-motion"
import SectionHeader from "@/components/ui/SectionHeader"

const steps = [
  {
    index: "01",
    title: "Пробная тренировка",
    desc: "Познакомиться с залом, тренером и основами — без обязательств.",
  },
  {
    index: "02",
    title: "Регулярные тренировки",
    desc: "Техника, физическая форма и дисциплина. Три занятия в неделю.",
  },
  {
    index: "03",
    title: "Кю и пояса",
    desc: "Постепенное развитие: аттестации фиксируют рост мастерства.",
  },
  {
    index: "04",
    title: "Первые старты",
    desc: "Внутренние спарринги и клубные старты — первый опыт татами.",
  },
  {
    index: "05",
    title: "Турниры",
    desc: "Городские и всероссийские соревнования. Рост спортсмена.",
  },
]

export default function StudentPath() {
  return (
    <section aria-label="Путь ученика" className="kwf-section">
      <div className="kwf-container">
        <SectionHeader
          align="left"
          kanji="押忍"
          eyebrow="Путь ученика"
          title="От первой тренировки — до татами"
          description="Понятный маршрут для новичка: что происходит на каждом этапе."
        />
        <div className="rounded-2xl border border-border bg-white p-6 md:p-10 shadow-sm">
        <ol className="relative ml-1 border-l border-border/80 pl-6 md:pl-10 space-y-7">
          {steps.map((step, idx) => (
            <motion.li
              key={step.index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: idx * 0.05 }}
              className="relative"
            >
              <span
                aria-hidden="true"
                className="absolute -left-6 md:-left-10 top-1.5 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-gold ring-4 ring-gold/15"
              />
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-sm font-black tabular-nums text-gold-deep" aria-hidden="true">
                  {step.index}
                </span>
                <h3 className="text-lg md:text-xl font-extrabold text-dark-text tracking-tight">
                  {step.title}
                </h3>
              </div>
              <p className="mt-1 text-sm md:text-base text-secondary-text leading-relaxed">
                {step.desc}
              </p>
            </motion.li>
          ))}
        </ol>
        </div>
      </div>
    </section>
  )
}
