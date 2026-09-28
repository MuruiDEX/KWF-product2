// Мелкие display-хелперы: подписи без задвоений и русская плюрализация.

/** Название татами без задвоения префикса: «Татами 1» остаётся как есть,
 * «1» / «A» получают префикс, пустое даёт «—». */
export function formatTatamiName(name: string | null | undefined): string {
  const t = (name ?? "").trim()
  if (!t) return "—"
  if (/^татами(\s|$|[-–—:])/iu.test(t)) return t
  return `Татами ${t}`
}

/** Русская плюрализация: 1 категория, 3 категории, 5 категорий. */
export function pluralize(n: number, one: string, few: string, many: string): string {
  const m10 = Math.abs(n) % 10
  const m100 = Math.abs(n) % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
