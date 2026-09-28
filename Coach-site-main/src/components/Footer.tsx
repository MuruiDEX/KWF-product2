"use client"

import { motion } from "framer-motion"
import { MapPin, Phone, Mail, Clock, MessageCircle } from "lucide-react"
import { CONTACTS, NAV_LINKS, ROUTE_LINKS, SITE_NAME, openWhatsApp } from "@/lib/constants"

const socials = [
  { label: "WhatsApp", href: CONTACTS.whatsapp, Icon: MessageCircle },
  { label: "Телефон", href: CONTACTS.phoneHref, Icon: Phone },
  { label: "Почта", href: `mailto:${CONTACTS.email}`, Icon: Mail },
]

export default function Footer() {
  return (
    <footer id="footer" className="bg-dark-blue text-white border-t border-white/5">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-white font-extrabold text-sm">極</span>
              </div>
              <span className="font-bold text-lg">{SITE_NAME}</span>
            </div>
            <p className="text-sm text-white/75 leading-relaxed max-w-xs">
              Профессиональная школа Кёкушинкай карате для детей. Воспитываем
              чемпионов с детства.
            </p>
            <div className="flex items-center gap-3 mt-6">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-primary-blue transition-colors duration-200"
                >
                  <Icon size={18} aria-hidden="true" />
                </a>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h4 className="font-bold text-base mb-5">Навигация</h4>
            <nav aria-label="Навигация в подвале" className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-white/75 hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
              {ROUTE_LINKS.filter((l) => l.href !== "/").map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-white/75 hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h4 className="font-bold text-base mb-5">Контакты</h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                <span className="text-sm text-white/75">
                  {CONTACTS.address}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gold shrink-0" />
                <a
                  href={CONTACTS.phoneHref}
                  className="text-sm text-white/75 hover:text-white transition-colors"
                >
                  {CONTACTS.phoneLabel}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gold shrink-0" />
                <a
                  href={`mailto:${CONTACTS.email}`}
                  className="text-sm text-white/75 hover:text-white transition-colors"
                >
                  {CONTACTS.email}
                </a>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                <span className="text-sm text-white/75">
                  Пн–Сб: 10:00 – 20:00
                  <br />
                  Вс: выходной
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h4 className="font-bold text-base mb-5">Напишите нам</h4>
            <p className="text-sm text-white/75 leading-relaxed mb-5">
              Ответим на вопросы и поможем записаться на пробное занятие
            </p>
            <button
              onClick={() => openWhatsApp()}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 bg-surface text-dark-blue font-semibold rounded-xl text-sm hover:bg-white/90 transition-all duration-200 cursor-pointer dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </button>
          </motion.div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-[1280px] px-6 py-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-sm text-white/70">
            © {new Date().getFullYear()} {SITE_NAME}. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  )
}
