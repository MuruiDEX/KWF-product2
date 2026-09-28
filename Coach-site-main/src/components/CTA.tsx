"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import { CONTACTS } from "@/lib/constants"
import { LeadModal } from "@/components/LeadModal"

export default function CTA() {
  const [leadOpen, setLeadOpen] = useState(false)

  return (
    <section className="py-16 md:py-24 bg-dark-blue relative">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
        <div className="absolute inset-0 w-full h-full">
          <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
            <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth="1" />
          </svg>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 relative z-10">
        <motion.div
          className="text-center max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold mb-4">
            <span aria-hidden="true" className="font-black mr-2">10</span>
            Запись в клуб
            <span aria-hidden="true" className="ml-2 text-sm font-extrabold tracking-[0.2em]">押忍</span>
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold mb-4">
            <span aria-hidden="true" className="font-black mr-2">11</span>
            Контакт
          </p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            Начните путь вашего ребёнка
            <br />
            <span className="text-white/90">в мир Кёкушинкай</span>
          </h2>
          <p className="text-lg text-white/75 mt-6 leading-relaxed max-w-xl mx-auto">
            Запишитесь на бесплатное пробное занятие и познакомьте ребёнка с
            искусством карате. Первый шаг — самый важный.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-8 sm:mt-10">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-surface text-dark-blue hover:bg-white/90 dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
              onClick={() => setLeadOpen(true)}
            >
              Записаться на пробное
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto text-white hover:bg-white/10"
              onClick={() => window.open(CONTACTS.phoneHref, "_self")}
            >
              Позвонить: {CONTACTS.phoneLabel}
            </Button>
          </div>
        </motion.div>
      </div>
      <LeadModal
        open={leadOpen}
        onClose={() => setLeadOpen(false)}
        initialPlan="trial"
        source="cta"
      />
    </section>
  )
}
