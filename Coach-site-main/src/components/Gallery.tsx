"use client"

import { motion } from "framer-motion"
import { ExternalLink } from "lucide-react"
import SectionHeader from "@/components/ui/SectionHeader"

const images = [1, 2, 3, 4, 5, 6]

export default function Gallery() {
  return (
    <section id="gallery" className="py-16 md:py-24 bg-light-gray scroll-mt-24">
      <div className="mx-auto max-w-[1280px] px-6">
        <SectionHeader
          eyebrow="Галерея"
          title="Жизнь нашего клуба"
          description="Моменты тренировок, соревнований и повседневной жизни нашего коллектива"
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
          {images.map((id, idx) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="group relative cursor-pointer rounded-xl overflow-hidden bg-white border border-border hover:border-primary-blue/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="aspect-[4/3] w-full bg-gradient-to-br from-light-gray to-border flex items-center justify-center relative">
                <div className="absolute inset-0 opacity-[0.03]">
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage: `radial-gradient(circle at 50% 50%, #17488F 1px, transparent 1px)`,
                      backgroundSize: "24px 24px",
                    }}
                  />
                </div>
                <div className="text-center relative z-10">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-white/80 border border-border flex items-center justify-center">
                    <svg className="w-6 h-6 text-secondary-text/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium text-secondary-text/60">
                    Фото {id}
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 bg-dark-blue/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-xl backdrop-blur-sm">
                <div className="text-center text-white">
                  <ExternalLink className="w-8 h-8 mx-auto mb-2" />
                  <span className="text-sm font-semibold">Смотреть</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
