// Phase 1: page-based навигация платформы.
// RU only (решение Phase 0): строки централизованы здесь, а не разбросаны
// по компонентам — структура готова под словари будущего i18n.

import type { Tournament } from "@/lib/types"

export const NAV_STRINGS = {
  home: "Главная",
  tournaments: "Турниры",
  live: "Live",
  news: "Новости",
  schedule: "Расписание",
  cabinet: "Кабинет",
  myTournaments: "Мои турниры",
  createTournament: "Создать турнир",
  athletesAdmin: "Спортсмены",
  login: "Войти",
  register: "Регистрация",
  logout: "Выйти",
  navigation: "Навигация",
  account: "Кабинет",
  organizer: "Организатор",
  openMenu: "Открыть меню",
  closeMenu: "Закрыть меню",
  liveNow: "Сейчас live",
  watchLive: "Смотреть live",
} as const

export interface NavLinkItem {
  label: string
  href: string
}

/** Публичная page-based навигация (вместо якорей лендинга). */
export const PUBLIC_LINKS: NavLinkItem[] = [
  { label: NAV_STRINGS.home, href: "/" },
  { label: NAV_STRINGS.tournaments, href: "/tournaments" },
  { label: NAV_STRINGS.live, href: "/live" },
  { label: NAV_STRINGS.news, href: "/news" },
  { label: NAV_STRINGS.schedule, href: "/schedule" },
]

export const ACCOUNT_LINKS: NavLinkItem[] = [
  { label: NAV_STRINGS.cabinet, href: "/cabinet" },
  { label: NAV_STRINGS.myTournaments, href: "/cabinet/tournaments" },
]

export const ORGANIZER_LINKS: NavLinkItem[] = [
  { label: NAV_STRINGS.myTournaments, href: "/cabinet/tournaments" },
  { label: NAV_STRINGS.createTournament, href: "/cabinet/tournaments/create" },
  { label: NAV_STRINGS.athletesAdmin, href: "/admin/athletes" },
]

/** Активна ли ссылка для текущего pathname (точное совпадение + вложенные). */
export function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Турнир считается идущим сейчас: опубликован и сегодня внутри [start, end]. */
export function isRunningTournament(t: Tournament, now: Date = new Date()): boolean {
  if (t.status !== "published") return false
  const start = new Date(`${t.start_date}T00:00:00`)
  const end = new Date(`${t.end_date}T23:59:59`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  return start <= now && now <= end
}

export interface TournamentPartition {
  running: Tournament[]
  upcoming: Tournament[]
  finished: Tournament[]
}

/** Делит список турниров на идущие / предстоящие / завершённые (и черновики — в upcoming только для staff; публично их нет). */
export function partitionTournaments(
  tournaments: Tournament[],
  now: Date = new Date()
): TournamentPartition {
  const running: Tournament[] = []
  const upcoming: Tournament[] = []
  const finished: Tournament[] = []
  for (const t of tournaments) {
    if (t.status === "finished") {
      finished.push(t)
      continue
    }
    if (isRunningTournament(t, now)) {
      running.push(t)
      continue
    }
    upcoming.push(t)
  }
  const byStart = (a: Tournament, b: Tournament) =>
    a.start_date.localeCompare(b.start_date)
  running.sort(byStart)
  upcoming.sort(byStart)
  finished.sort((a, b) => b.start_date.localeCompare(a.start_date))
  return { running, upcoming, finished }
}


