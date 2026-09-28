// Переход «клуб → соревнования → платформа»: technology как продолжение
// организации, а не случайный SaaS. Компактная полоса, без новых сущностей.

"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import SectionHeader from "@/components/ui/SectionHeader"
import { KanjiBackdrop } from "@/components/JapaneseAccent"

export default function ClubToPlatform() {
  return (
    <section aria-label="От тренировок к турнирам" className="bg-dark-blue relative overflow-hidden">
      <KanjiBackdrop className="right-[2%] top-1/2 -translate-y-1/2 text-[110px] md:text-[210px]">
        空手
      </KanjiBackdrop>
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-100"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(212,175,55,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(212,175,55,0.10) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(115deg, black 0%, transparent 45%)",
          WebkitMaskImage: "linear-gradient(115deg, black 0%, transparent 45%)",
        }}
      />
      <div className="kwf-container relative py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <SectionHeader
            dark
            align="left"
            number="06"
            kanji="空手"
            eyebrow="От тренировок — к соревнованиям"
            title="Турниры клуба проходят в собственной платформе KWF"
            description="Сетки, расписание по татами, live-результаты и табло для зала — всё, что нужно спортсмену, тренеру и зрителю в день соревнований."
            className="mb-0 md:mb-0"
          />
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link href="/tournaments" className="w-full sm:w-auto">
              <span className="inline-flex w-full sm:w-auto items-center justify-center h-12 px-7 rounded-lg bg-gold text-dark-blue font-bold hover:bg-accent-warm-light transition-colors">
                Календарь турниров
                <ChevronRight className="ml-2 h-5 w-5" aria-hidden="true" />
              </span>
            </Link>
            <Link href="/live" className="w-full sm:w-auto">
              <span className="inline-flex w-full sm:w-auto items-center justify-center h-12 px-7 rounded-lg border border-white/25 text-white font-bold hover:bg-white/10 hover:border-white/40 transition-colors">
                Смотреть LIVE
              </span>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
