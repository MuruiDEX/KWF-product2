"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ChevronRight, MapPin, ShieldCheck, Trophy } from "lucide-react"
import { IMAGES } from "@/lib/constants"

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
}

const stats = [
  { value: "18+", label: "лет школы" },
  { value: "250+", label: "учеников" },
  { value: "15", label: "чемпионов" },
]

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-[100dvh] pt-[5.5rem] flex items-center scroll-mt-24 bg-dark-blue"
    >
      {/* Background image + cinematic overlays */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <img
          src={IMAGES.hero}
          alt=""
          className="w-full h-full object-cover object-center opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-blue via-dark-blue/85 to-dark-blue/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-blue via-transparent to-dark-blue/60" />
        <div className="absolute -top-32 -right-32 w-[90vmin] h-[90vmin] max-w-[720px] max-h-[720px] rounded-full bg-primary-blue/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[70vmin] h-[70vmin] max-w-[520px] max-h-[520px] rounded-full bg-gold/10 blur-[110px]" />
        <div className="absolute bottom-1/3 right-[8%] opacity-[0.07] text-[140px] md:text-[220px] font-black text-white leading-none select-none hidden md:block">
          極
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 w-full relative z-10 py-16">
        <div className="max-w-3xl">
          <motion.div
            initial="initial"
            animate="animate"
            variants={fadeUp}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2.5 pl-2 pr-4 py-1.5 bg-white/5 border border-white/15 backdrop-blur-md rounded-full text-[13px] font-semibold text-white/85 mb-7">
              <span className="px-2.5 py-0.5 rounded-full bg-gold text-dark-blue text-[11px] font-extrabold uppercase tracking-wider">
                Набор 2026
              </span>
              Группы для детей 4–17 лет
            </div>
            <h1 className="text-[2.75rem] sm:text-6xl lg:text-7xl font-extrabold leading-[1.04] tracking-tight text-white mb-6 text-balance">
              Кёкушинкай карате
              <br />
              <span className="text-gold drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]">
                для детей
              </span>
            </h1>
            <p className="text-base sm:text-lg leading-relaxed text-white/80 max-w-xl mb-9">
              Профессиональная школа восточных единоборств. Воспитываем
              силу духа, дисциплину и уверенность — от первой тренировки
              до чемпионского пьедестала.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-gold text-dark-blue hover:bg-accent-warm-light font-bold shadow-lg shadow-gold/25"
                onClick={() => window.open("https://wa.me/77476847442", "_blank", "noopener,noreferrer")}
              >
                Записаться на пробное
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="w-full sm:w-auto text-white border border-white/25 hover:bg-white/10 hover:border-white/40 backdrop-blur-sm"
                onClick={() => document.getElementById("trainer")?.scrollIntoView({ behavior: "smooth" })}
              >
                Узнать больше
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mt-11 pt-8 border-t border-white/10">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {s.value}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65 mt-1">
                    {s.label}
                  </div>
                </div>
              ))}
              <div className="hidden sm:flex items-center gap-2 text-white/65 text-sm ml-auto">
                <MapPin size={15} className="text-gold/80" />
                Москва · ул. Спортивная, 15
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 text-[13px] text-white/65">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-gold/70" />
                Безопасные татами и экипировка
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Trophy size={14} className="text-gold/70" />
                Турниры от городских до всероссийских
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden sm:flex flex-col items-center gap-2 text-white/35" aria-hidden="true">
        <span className="text-[10px] font-bold uppercase tracking-[0.28em]">Листайте</span>
        <span className="w-5 h-9 rounded-full border border-white/25 flex justify-center pt-1.5">
          <motion.span
            className="w-1 h-2 rounded-full bg-gold/80"
            animate={{ y: [0, 10, 0], opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </span>
      </div>
    </section>
  )
}
