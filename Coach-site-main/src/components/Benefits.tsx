"use client"

import { motion } from "framer-motion"
import { Brain, Dumbbell, Users2, Zap } from "lucide-react"
import ImagePlaceholder from "@/components/ImagePlaceholder"

const benefits = [
  {
    icon: Brain,
    title: "Концентрация",
    desc: "Улучшаем внимательность и способность фокусироваться на задачах",
  },
  {
    icon: Dumbbell,
    title: "Физподготовка",
    desc: "Развиваем силу, выносливость, координацию и гибкость",
  },
  {
    icon: Zap,
    title: "Самооборона",
    desc: "Практические навыки защиты в реальных жизненных ситуациях",
  },
  {
    icon: Users2,
    title: "Социализация",
    desc: "Учим работать в команде, находить друзей и уважать других",
  },
]

export default function Benefits() {
  return (
    <section className="py-16 md:py-24 bg-light-gray scroll-mt-24">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-20">
          <motion.div
            className="flex-1 w-full"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-xs font-bold text-primary-blue uppercase tracking-[0.2em]">
              <span aria-hidden="true" className="text-gold-deep font-black mr-2">03</span>
              Преимущества
            </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-dark-text mt-4 tracking-tight">
            Больше, чем просто спорт
          </h2>
            <p className="text-lg text-secondary-text mt-4 mb-10 leading-relaxed max-w-lg">
              Карате — это комплексное развитие ребёнка. Мы работаем над
              физическими и личностными качествами.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {benefits.map((benefit, idx) => {
                const Icon = benefit.icon
                return (
                  <motion.div
                    key={benefit.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: Math.min(idx, 3) * 0.08 }}
                    className="p-6 rounded-xl bg-white border border-border hover:shadow-md hover:border-primary-blue/20 transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-light-gray flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-primary-blue" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-bold text-dark-text mb-1">
                      {benefit.title}
                    </h3>
                    <p className="text-sm text-secondary-text leading-relaxed">
                      {benefit.desc}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

            <motion.div
            className="flex-1 w-full"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <ImagePlaceholder label="Фото тренировки" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
