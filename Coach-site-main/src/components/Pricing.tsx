"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import SectionHeader from "@/components/ui/SectionHeader"

const plans = [
  {
    name: "Базовая",
    price: "3 500",
    period: "в месяц",
    desc: "2 тренировки в неделю",
    features: [
      "2 занятия по 60 мин",
      "Общая группа",
      "Базовая программа",
      "Без экипировки",
    ],
  },
  {
    name: "Оптимальная",
    price: "5 500",
    period: "в месяц",
    desc: "3 тренировки в неделю",
    featured: true,
    features: [
      "3 занятия по 90 мин",
      "Малая группа до 10 чел",
      "Полная программа",
      "Экипировка в подарок",
      "Участие в соревнованиях",
    ],
  },
  {
    name: "Премиум",
    price: "8 500",
    period: "в месяц",
    desc: "Индивидуальный подход",
    features: [
      "4 занятия по 90 мин",
      "Индивидуальные тренировки",
      "Расширенная программа",
      "Экипировка в подарок",
      "Личный план развития",
      "Сопровождение на турнирах",
    ],
  },
]

export default function Pricing() {
  return (
    <section id="pricing" className="py-16 md:py-24 scroll-mt-24 relative section-gradient">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-[5%] -translate-y-1/2 opacity-[0.1] text-[120px] md:text-[200px] font-black text-primary-blue leading-none select-none">
          武
        </div>
      </div>
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHeader
          eyebrow="Стоимость"
          title="Прозрачные цены"
          description="Выберите подходящий абонемент. Первое пробное занятие — бесплатно."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`relative p-8 rounded-3xl border-2 bg-white transition-all duration-300 hover:shadow-xl ${
                plan.featured
                  ? "border-primary-blue shadow-lg lg:scale-105"
                  : "border-border hover:border-primary-blue/30"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-gold text-dark-blue text-sm font-bold rounded-full shadow-md shadow-gold/30">
                  Популярный
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-dark-text mb-1">
                  {plan.name}
                </h3>
                <p className="text-sm text-secondary-text mb-4">{plan.desc}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-extrabold text-dark-text">
                    {plan.price}
                  </span>
                  <span className="text-sm text-secondary-text">₽</span>
                </div>
                <p className="text-xs text-secondary-text mt-1">{plan.period}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3 text-sm">
                    <Check className={`w-5 h-5 shrink-0 mt-0.5 ${plan.featured ? "text-accent-warm" : "text-primary-blue"}`} />
                    <span className="text-dark-text">{feat}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.featured ? "primary" : "secondary"}
                size="default"
                onClick={() => window.open("https://wa.me/77476847442", "_blank", "noopener,noreferrer")}
              >
                Выбрать абонемент
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
