export const SITE_NAME = "Кекушин Карате"

export const SITE_TAGLINE = "Воспитываем чемпионов с детства"

/** Контакты школы в одном месте (переопределяются через env при сборке).
 * Значения по умолчанию = текущие, визуально ничего не меняется. */
export const CONTACTS = {
  whatsapp:
    process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? "https://wa.me/77476847442",
  phoneHref:
    process.env.NEXT_PUBLIC_CONTACT_PHONE_HREF ?? "tel:+77476847442",
  phoneLabel:
    process.env.NEXT_PUBLIC_CONTACT_PHONE_LABEL ?? "+7 (747) 684-74-42",
  email:
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "info@kyokushin-karate.ru",
  address:
    process.env.NEXT_PUBLIC_CONTACT_ADDRESS ??
    "г. Москва, ул. Спортивная, д. 15",
  addressShort:
    process.env.NEXT_PUBLIC_CONTACT_ADDRESS_SHORT ??
    "Москва · ул. Спортивная, 15",
  /** Telegram-бот клуба для записи. TODO(owner): вставить реальный URL
   * через NEXT_PUBLIC_CONTACT_TELEGRAM. Пусто = бот не настроен,
   * выдумывать username/URL запрещено — код это учитывает. */
  telegram: process.env.NEXT_PUBLIC_CONTACT_TELEGRAM ?? "",
}

/** Telegram URL is not configured yet — честная проверка вместо fake-ссылки. */
export function hasTelegram(): boolean {
  return CONTACTS.telegram.trim().length > 0
}

export function openWhatsApp() {
  window.open(CONTACTS.whatsapp, "_blank", "noopener,noreferrer")
}

export const NAV_LINKS = [
  { label: "Главная", href: "#hero" },
  { label: "О тренере", href: "#trainer" },
  { label: "Расписание", href: "#schedule" },
  { label: "Стоимость", href: "#pricing" },
  { label: "Галерея", href: "#gallery" },
  { label: "Отзывы", href: "#testimonials" },
  { label: "Контакты", href: "#footer" },
]

// Ссылки для внутренних страниц
export const ROUTE_LINKS = [
  { label: "Главная", href: "/" },
  { label: "Новости", href: "/news" },
  { label: "Турниры", href: "/tournaments" },
  { label: "Расписание", href: "/schedule" },
]

export const IMAGES = {
  hero: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=900&q=85",

  benefits:
    "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=700&q=85",

  trainer:
    "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=700&q=85",

  gallery: [
    "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=600&q=80",
    "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=600&q=80",
    "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=600&q=80",
    "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80",
    "https://images.unsplash.com/photo-1517438322307-e67111335449?w=600&q=80",
    "https://images.unsplash.com/photo-1583473848882-f6409b5f1e6e?w=600&q=80",
  ],

  testimonials: [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80",
    "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=80&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&q=80",
  ],
}