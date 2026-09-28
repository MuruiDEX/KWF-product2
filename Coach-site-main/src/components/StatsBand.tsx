"use client"

import { motion } from "framer-motion"
import AnimatedCounter from "@/components/AnimatedCounter"

const stats = [
  { value: 18, suffix: "+", label: "лет школы", hint: "традиции Кёкушинкай" },
  { value: 250, suffix: "+", label: "учеников", hint: "от 4 до 17 лет" },
  { value: 30, suffix: "+", label: "турниров", hint: "город и Россия" },
  { value: 15, suffix: "", label: "чемпионов", hint: "воспитано школой" },
]

export default function StatsBand() {
  return (
    <section className="relative bg-dark-blue border-y border-white/10 overflow-hidden" aria-label="Статистика школы">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      </div>
      <div className="mx-auto max-w-[1280px] px-6 py-12 md:py-16 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: Math.min(i, 3) * 0.08 }}
              className="text-center lg:text-left flex lg:flex-col items-center gap-4 lg:gap-1"
            >
              <div className="text-4xl md:text-5xl font-extrabold tracking-tight text-white tabular-nums">
                <AnimatedCounter value={s.value} suffix={s.suffix} />
              </div>
              <div>
                <div className="text-sm font-bold uppercase tracking-[0.16em] text-gold">{s.label}</div>
                <div className="text-[13px] text-white/70 mt-1">{s.hint}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
