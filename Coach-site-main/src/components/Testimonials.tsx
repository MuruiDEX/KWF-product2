"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, Star } from "lucide-react"
import SectionHeader from "@/components/ui/SectionHeader"

const testimonials = [
  {
    name: "Елена Смирнова",
    role: "Мама Артёма, 9 лет",
    text: "Сын ходит уже второй год. Очень довольны — стал дисциплинированнее, подтянулся по учёбе, появилась уверенность в себе. Тренер настоящий профессионал!",
    rating: 5,
  },
  {
    name: "Андрей Кузнецов",
    role: "Папа Софии, 7 лет",
    text: "Дочка всегда была стеснительной. После полугода занятий — совершенно другой ребёнок! Открытая, общительная, с правильными ценностями. Спасибо тренеру!",
    rating: 5,
  },
  {
    name: "Мария Петрова",
    role: "Мама Дмитрия, 12 лет",
    text: "За год занятий сын получил синий пояс и занял второе место на городском турнире. Отличная школа, современный подход и индивидуальное внимание к каждому.",
    rating: 5,
  },
  {
    name: "Иван Васильев",
    role: "Папа Александра, 14 лет",
    text: "Саша занимается карате 4 года. Благодаря тренеру стал чемпионом области. Огромное спасибо за профессионализм и вклад в воспитание!",
    rating: 5,
  },
  {
    name: "Ольга Новикова",
    role: "Мама Кирилла, 6 лет",
    text: "Привели сына в 4 года — боялись, что рано. Но тренер нашёл подход. Теперь Кирилл бежит на тренировки с радостью, и мы видим огромный прогресс.",
    rating: 5,
  },
]

export default function Testimonials() {
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(0)

  const paginate = (dir: number) => {
    setDirection(dir)
    setCurrent((prev) => {
      const next = prev + dir
      if (next < 0) return testimonials.length - 1
      if (next >= testimonials.length) return 0
      return next
    })
  }

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -200 : 200,
      opacity: 0,
    }),
  }

  const t = testimonials[current]

  return (
    <section id="testimonials" className="py-16 md:py-24 scroll-mt-24 relative section-gradient">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 right-1/4 -translate-x-1/2 -translate-y-1/2 w-[100vmin] h-[100vmin] max-w-[620px] max-h-[620px] opacity-[0.06]">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle cx="100" cy="100" r="90" fill="none" stroke="#17488F" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="#17488F" strokeWidth="0.8" />
            <circle cx="100" cy="100" r="50" fill="none" stroke="#17488F" strokeWidth="0.5" />
          </svg>
        </div>
      </div>
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHeader
          eyebrow="Отзывы"
          title="Что говорят родители"
          description="Мы дорожим доверием каждой семьи и стремимся дать лучшее образование нашим ученикам"
        />

        <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-white p-6 md:p-10 shadow-sm">
          <div className="relative min-h-[280px] flex items-center justify-center overflow-x-clip">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.figure
                key={current}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="w-full border-t-2 border-gold/60 pt-8"
              >
                <div className="flex items-center gap-1 mb-4" aria-label={`Оценка ${t.rating} из 5`}>
                  {[...Array(t.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-gold text-gold"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <blockquote className="text-xl md:text-2xl font-medium text-dark-text leading-relaxed text-balance">
                  &ldquo;{t.text}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span aria-hidden="true" className="text-sm font-extrabold tracking-[0.2em] text-gold-deep">
                    押忍
                  </span>
                  <span>
                    <span className="block font-bold text-dark-text">{t.name}</span>
                    <span className="block text-sm text-secondary-text">{t.role}</span>
                  </span>
                </figcaption>
              </motion.figure>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-center gap-3 md:gap-4 mt-8">
            <button
              onClick={() => paginate(-1)}
              className="w-10 md:w-12 h-10 md:h-12 rounded-xl border border-border bg-surface flex items-center justify-center hover:bg-light-gray hover:border-primary-blue/30 transition-all duration-200 cursor-pointer dark:bg-gold dark:border-gold dark:hover:bg-[#D4AF37]"
              aria-label="Предыдущий отзыв"
            >
              <ChevronLeft className="w-4 md:w-5 h-4 md:h-5 text-dark-blue" />
            </button>

            <div className="flex items-center gap-1.5 md:gap-2">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDirection(idx > current ? 1 : -1)
                    setCurrent(idx)
                  }}
                  className={`rounded-full transition-all duration-300 cursor-pointer ${
                    idx === current
                      ? "bg-primary-blue w-5 md:w-6 h-2"
                      : "bg-border hover:bg-primary-blue/50 w-2 h-2"
                  }`}
                  aria-label={`Отзыв ${idx + 1}`}
                />
              ))}
            </div>

            <button
              onClick={() => paginate(1)}
              className="w-10 md:w-12 h-10 md:h-12 rounded-xl border border-border bg-surface flex items-center justify-center hover:bg-light-gray hover:border-primary-blue/30 transition-all duration-200 cursor-pointer dark:bg-gold dark:border-gold dark:hover:bg-[#D4AF37]"
              aria-label="Следующий отзыв"
            >
              <ChevronRight className="w-4 md:w-5 h-4 md:h-5 text-dark-blue" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
