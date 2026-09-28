"use client"

import { useRouter } from "next/navigation"
import { motion, MotionConfig } from "framer-motion"
import { Clock, CalendarDays, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import SectionHeader from "@/components/ui/SectionHeader"
import { groupColorVarsByIndex } from "@/lib/groupColors"
import { openWhatsApp } from "@/lib/constants"

const groups = [
  {
    icon: Users,
    age: "4–6 лет",
    days: "ПН / СР / ПТ",
    time: "16:00 – 17:00",
    desc: "Общая физическая подготовка, знакомство с карате",
  },
  {
    icon: Users,
    age: "7–10 лет",
    days: "ПН / СР / ПТ",
    time: "17:15 – 18:30",
    desc: "Базовая техника, работа с партнёром",
  },
  {
    icon: Users,
    age: "11–14 лет",
    days: "ВТ / ЧТ / СБ",
    time: "16:00 – 17:30",
    desc: "Углублённая техника, спарринги",
  },
  {
    icon: Users,
    age: "15–17 лет",
    days: "ВТ / ЧТ / СБ",
    time: "18:00 – 19:30",
    desc: "Спортивная подготовка, турнирные сборы",
  },
]

export default function Schedule() {
  const router = useRouter()
  return (
    <MotionConfig reducedMotion="user">
    <section id="schedule" className="py-16 md:py-24 bg-light-gray scroll-mt-24 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 right-1/4 md:right-1/3 opacity-[0.08] rotate-12">
          <svg viewBox="0 0 100 100" className="w-[100px] md:w-[180px]">
            <path d="M20 50 L50 20 L80 50 L50 80 Z" fill="none" stroke="#17488F" strokeWidth="1" />
            <path d="M30 50 L50 30 L70 50 L50 70 Z" fill="none" stroke="#17488F" strokeWidth="0.5" />
          </svg>
        </div>
        <div className="absolute bottom-1/3 left-1/4 opacity-[0.06]">
          <svg viewBox="0 0 60 60" className="w-[60px] md:w-[100px]">
            <rect x="5" y="5" width="50" height="50" fill="none" stroke="#17488F" strokeWidth="1" rx="4" />
            <rect x="15" y="15" width="30" height="30" fill="none" stroke="#17488F" strokeWidth="0.5" rx="2" />
          </svg>
        </div>
      </div>
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHeader
          eyebrow="Расписание"
          title="Выберите свою группу"
          description="Занятия проходят в современном зале с профессиональным оборудованием. Все группы разделены по возрасту и уровню подготовки."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {groups.map((group, idx) => {
            const Icon = group.icon
            return (
              <motion.div
                key={group.age}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, ease: "easeOut", delay: Math.min(idx, 3) * 0.06 }}
                whileHover={{ y: -4, scale: 1.015 }}
                className="group-card p-6 rounded-2xl overflow-hidden"
                style={groupColorVarsByIndex(idx)}
              >
                <div
                  aria-hidden
                  className="group-blob absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none"
                />
                <div className="group-chip w-12 h-12 rounded-xl flex items-center justify-center mb-5 relative">
                  <Icon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-extrabold text-dark-text mb-3 relative">
                  {group.age}
                </h3>
                <p className="text-sm text-secondary-text mb-4 leading-relaxed relative">
                  {group.desc}
                </p>
                <div className="space-y-2 mb-6 relative">
                  <div className="flex items-center gap-2 text-sm text-dark-text">
                    <CalendarDays className="group-meta w-4 h-4" />
                    <span className="font-semibold">{group.days}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-dark-text">
                    <Clock className="group-meta w-4 h-4" />
                    <span>{group.time}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mt-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Button size="lg" className="w-full sm:w-auto" onClick={() => openWhatsApp()}>
            Записаться на пробное занятие
          </Button>
          <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => router.push("/schedule")}>
            Полное расписание
          </Button>
        </motion.div>
      </div>
    </section>
    </MotionConfig>
  )
}
