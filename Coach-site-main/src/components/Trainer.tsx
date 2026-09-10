"use client"

import { motion } from "framer-motion"
import { CheckCircle, Calendar, Users, Trophy, Award } from "lucide-react"
import ImagePlaceholder from "@/components/ImagePlaceholder"
import AnimatedCounter from "@/components/AnimatedCounter"

const stats = [
  { value: 18, suffix: "+", label: "Лет опыта", icon: Calendar },
  { value: 250, suffix: "+", label: "Воспитанников", icon: Users },
  { value: 30, suffix: "+", label: "Турниров", icon: Trophy },
  { value: 15, suffix: "+", label: "Чемпионов", icon: Award },
]

const achievements = [
  "Мастер спорта по Кёкушинкай",
  "Чёрный пояс, 2 дан",
  "Судья международной категории",
  "Победитель Чемпионата России 2019",
]

export default function Trainer() {
  return (
    <section id="trainer" className="py-16 md:py-24 scroll-mt-24 relative section-gradient">
      <div className="absolute inset-0 pointer-events-none dark:hidden"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(8,26,53,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(8,26,53,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      />
      <div className="absolute inset-0 pointer-events-none hidden dark:block"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(212,175,55,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(212,175,55,0.14) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      />
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-20">
          <motion.div
            className="flex-1 w-full lg:max-w-[45%]"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <ImagePlaceholder label="Фото тренера" aspect="aspect-[3/4]" />
            <div className="flex flex-wrap gap-3 mt-6">
              {["3 дан Кёкушинкай", "Мастер спорта", "Судья"].map((cert) => (
                <span
                  key={cert}
                  className="px-4 py-2 bg-light-gray rounded-xl text-sm font-semibold text-primary-blue"
                >
                  {cert}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="flex-1"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <span className="text-sm font-semibold text-primary-blue uppercase tracking-widest">
              О тренере
            </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-dark-text mt-4 tracking-tight">
            Бакыт Алмаз
          </h2>
            <p className="text-lg text-secondary-text mt-4 leading-relaxed max-w-xl">
              Основатель школы, действующий тренер с 18-летним стажем. За годы
              работы подготовил более 250 учеников, среди которых 15 чемпионов
              России и призёров международных турниров.
            </p>

            <div className="mt-8 space-y-3">
              {achievements.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-primary-blue shrink-0" />
                  <span className="text-base text-dark-text">{item}</span>
                </div>
              ))}
            </div>

            <motion.div
              className="relative mt-14"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              <div className="absolute left-1/2 -translate-x-1/2 -top-3 w-12 h-px bg-border" />
              <div className="relative rounded-3xl bg-gradient-to-br from-dark-blue to-navy text-white shadow-xl overflow-hidden">
                <div className="absolute inset-0 opacity-[0.04]">
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage: `radial-gradient(circle at 25% 50%, #17488F 1px, transparent 1px)`,
                      backgroundSize: "32px 32px",
                    }}
                  />
                </div>
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary-blue/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-blue/5 rounded-full blur-3xl" />
                <div className="grid grid-cols-2 relative">
                  {stats.map((stat, idx) => {
                    const Icon = stat.icon
                    return (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: idx * 0.15 }}
                        className={`p-6 flex flex-col items-center gap-2 ${
                          idx < 2 ? "border-b border-white/10" : ""
                        } ${idx % 2 === 0 ? "border-r border-white/10" : ""}`}
                      >
                        <Icon className="w-7 h-7 text-white" strokeWidth={1.5} />
                        <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                          <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                        </div>
                        <div className="text-sm text-white/70">{stat.label}</div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            <div className="relative mt-14">
              <div className="absolute left-1/2 -translate-x-1/2 -top-3 w-12 h-px bg-border" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
