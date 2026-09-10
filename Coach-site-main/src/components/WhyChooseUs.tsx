"use client"

import { motion } from "framer-motion"
import { Award, Users, Shield, Star, Heart, Target } from "lucide-react"
import SectionHeader from "@/components/ui/SectionHeader"

const features = [
  {
    icon: Award,
    title: "Опытный тренер",
    desc: "Более 18 лет преподавания, мастер спорта по Кёкушинкай",
  },
  {
    icon: Users,
    title: "Малые группы",
    desc: "До 12 человек в группе — индивидуальный подход к каждому",
  },
  {
    icon: Shield,
    title: "Безопасность",
    desc: "Современная защитная экипировка и страховочные маты",
  },
  {
    icon: Star,
    title: "Соревнования",
    desc: "Регулярные выезды на турниры городского и всероссийского уровня",
  },
  {
    icon: Heart,
    title: "Воспитание",
    desc: "Развиваем дисциплину, уважение к старшим и силу духа",
  },
  {
    icon: Target,
    title: "Результат",
    desc: "15 воспитанников стали чемпионами и призёрами соревнований",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
}

export default function WhyChooseUs() {
  return (
    <section className="py-16 md:py-24 scroll-mt-24 relative section-gradient">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[110vmin] h-[110vmin] max-w-[860px] max-h-[860px] opacity-[0.06]">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle cx="100" cy="100" r="90" fill="none" stroke="#17488F" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="#17488F" strokeWidth="0.8" />
            <circle cx="100" cy="100" r="50" fill="none" stroke="#17488F" strokeWidth="0.5" />
          </svg>
        </div>
        <div className="absolute bottom-1/4 right-1/4 opacity-[0.08] text-[100px] md:text-[180px] font-black text-primary-blue leading-none select-none">
          心
        </div>
      </div>
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHeader
          eyebrow="Почему выбирают нас"
          title="Ваш ребёнок в надёжных руках"
          description="Мы создаём среду, где дети растут физически и духовно, становясь увереннее и дисциплинированнее"
        />

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                variants={cardVariants}
                className="group flex flex-col items-center text-center p-8 rounded-2xl border border-border bg-white shadow-sm hover:shadow-lg hover:-translate-y-1.5 hover:border-primary-blue/40 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-xl bg-light-gray flex items-center justify-center mb-5 group-hover:bg-primary-blue/10 transition-colors duration-300">
                  <Icon className="w-7 h-7 text-primary-blue" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-dark-text mb-2">
                  {feature.title}
                </h3>
                <p className="text-base text-secondary-text leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}