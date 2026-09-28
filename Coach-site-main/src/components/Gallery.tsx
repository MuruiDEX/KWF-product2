"use client"

import { motion } from "framer-motion"
import SectionHeader from "@/components/ui/SectionHeader"

/** Бренд-плейсхолдеры вместо «Фото N»: честные заглушки до появления
 * реальных фотографий клуба. Неинтерактивные figure — никакого ложного
 * «Смотреть», которое ничего не открывает. */
const tiles = [
  { label: "Кихон", en: "Kihon · базовая техника" },
  { label: "Ката", en: "Kata · форма" },
  { label: "Кумитэ", en: "Kumite · спарринг" },
  { label: "Детские группы", en: "Kids · 4–12 лет" },
  { label: "Турниры", en: "Tournaments" },
  { label: "Сборы", en: "Camps" },
]

export default function Gallery() {
  return (
    <section id="gallery" className="py-16 md:py-24 bg-light-gray scroll-mt-24">
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHeader
          number="09"
          eyebrow="Галерея"
          title="Жизнь нашего клуба"
          description="Моменты тренировок, соревнований и повседневной жизни нашего коллектива"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
          {tiles.map((t) => (
            <motion.figure
              key={t.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4 }}
              className="relative rounded-xl overflow-hidden border border-border bg-dark-blue"
            >
              <div className="aspect-[4/3] w-full relative flex items-end bg-gradient-to-br from-navy via-dark-blue to-navy-950">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center text-[92px] md:text-[120px] font-black text-white opacity-[0.08] select-none leading-none"
                >
                  極
                </span>
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gold/50" />
                <figcaption className="relative z-10 p-4 md:p-5">
                  <span className="block font-display text-base md:text-lg font-extrabold text-white">
                    {t.label}
                  </span>
                  <span className="block text-[11px] md:text-xs font-semibold uppercase tracking-[0.14em] text-gold-pale/90 mt-1">
                    {t.en}
                  </span>
                </figcaption>
                <span className="absolute right-3 top-3 rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
                  Фото скоро
                </span>
              </div>
            </motion.figure>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-secondary-text">
          Здесь появятся фотографии тренировок и турниров клуба
        </p>
      </div>
    </section>
  )
}
