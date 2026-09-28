// Hero клуба: сначала Kyokushin/люди, платформа — ниже по странице.
// CTA записи ведёт в Telegram-бота (CONTACTS.telegram); пока URL не задан —
// честный fallback на контактный блок, не выдуманная ссылка.

"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { ChevronRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CONTACTS, IMAGES, hasTelegram } from "@/lib/constants"

export default function Hero() {
  const signupHref = hasTelegram() ? CONTACTS.telegram : "#contact"
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative flex items-center scroll-mt-24 bg-dark-blue overflow-hidden"
    >
      {/* Атмосфера: вуали + сетка-фрагмент, без тяжёлых эффектов. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-dark-blue via-dark-blue/95 to-dark-blue" />
        <div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "linear-gradient(to bottom, black 0%, transparent 70%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 70%)",
          }}
        />
        <div className="absolute -top-24 right-[10%] w-[60vmin] h-[60vmin] max-w-[480px] max-h-[480px] rounded-full bg-gold/10 blur-[110px]" />
        <div className="absolute bottom-0 left-[8%] opacity-[0.06] text-[150px] font-black text-white leading-none select-none hidden md:block">
          道
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 w-full relative z-10 py-12 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold mb-5">
              KWF · Kyokushin Karate
            </p>
            <h1 id="hero-title" className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.02] tracking-tight text-white text-balance">
              Сила.
              <br />
              Дисциплина.
              <br />
              <span className="text-gold">Характер.</span>
            </h1>
            <blockquote className="mt-6 border-l-2 border-gold/70 pl-4 max-w-xl">
              <p className="text-base sm:text-lg leading-relaxed text-white/80 italic">
                «Победа начинается с дисциплины.»
              </p>
              <cite className="block mt-2 text-xs font-bold uppercase tracking-[0.2em] text-white/50 not-italic">
                OSU — путь Кёкушинкай
              </cite>
            </blockquote>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-gold text-dark-blue hover:bg-accent-warm-light font-bold shadow-lg shadow-gold/25"
                onClick={() => window.open(signupHref, signupHref.startsWith("#") ? "_self" : "_blank", "noopener,noreferrer")}
              >
                <MessageCircle className="mr-2 h-5 w-5" aria-hidden="true" />
                Записаться на тренировку
              </Button>
              <Link href="#about" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full sm:w-auto text-white border border-white/25 hover:bg-white/10 hover:border-white/40"
                >
                  Узнать о клубе
                  <ChevronRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-3xl border border-gold/25 shadow-2xl shadow-black/50">
              <Image
                src={IMAGES.hero}
                alt="Боец Кёкушинкай на тренировке"
                width={900}
                height={1125}
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="w-full aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/5] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-blue/70 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center text-dark-blue font-extrabold text-sm">
                  極
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-white/90">
                  KWF Dojo
                </span>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="absolute -right-2 top-6 hidden xl:block text-xs font-extrabold tracking-[0.6em] text-white/30 select-none"
              style={{ writingMode: "vertical-rl" }}
            >
              極真空手
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
