import { api } from "@/lib/api"
import type { News } from "@/lib/types"

export const NEWS_TITLE_MAX = 255
export const NEWS_TEXT_MIN = 10
export const NEWS_TEXT_MAX = 20000
export const NEWS_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const NEWS_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

export interface NewsFormValues {
  title: string
  description: string
  imageFile: File | null
  is_published: boolean
}

export interface NewsFormErrors {
  title?: string
  description?: string
  imageFile?: string
}

/** Клиентская валидация зеркалит сервер (title ≤255, image ≤5МБ/jpeg-png-webp). */
export function validateNewsForm(values: NewsFormValues): NewsFormErrors {
  const errors: NewsFormErrors = {}
  const title = values.title.trim()
  if (!title) {
    errors.title = "Укажите заголовок"
  } else if (title.length > NEWS_TITLE_MAX) {
    errors.title = `Заголовок слишком длинный (максимум ${NEWS_TITLE_MAX} символов)`
  }
  const text = values.description.trim()
  if (!text) {
    errors.description = "Напишите текст новости"
  } else if (text.length < NEWS_TEXT_MIN) {
    errors.description = `Текст слишком короткий (минимум ${NEWS_TEXT_MIN} символов)`
  } else if (text.length > NEWS_TEXT_MAX) {
    errors.description = `Текст слишком длинный (максимум ${NEWS_TEXT_MAX} символов)`
  }
  if (values.imageFile) {
    if (!NEWS_IMAGE_TYPES.includes(values.imageFile.type)) {
      errors.imageFile = "Недопустимый формат (разрешены JPEG, PNG, WebP)"
    } else if (values.imageFile.size > NEWS_IMAGE_MAX_BYTES) {
      errors.imageFile = "Изображение слишком большое (максимум 5 МБ)"
    }
  }
  return errors
}

const RU_TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e",
  ю: "yu", я: "ya",
}

/** Slug из заголовка (тот же подход, что в визарде турниров). */
export function newsSlug(title: string): string {
  const base = title
    .toLowerCase()
    .split("")
    .map((ch) => RU_TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  const rand = (
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 6)
      : Math.random().toString(36).substring(2, 8)
  ).toLowerCase()
  return `${base || "novost"}-${rand}`
}

function toFormData(values: NewsFormValues, slug?: string): FormData {
  const fd = new FormData()
  fd.set("title", values.title.trim())
  fd.set("description", values.description.trim())
  fd.set("is_published", values.is_published ? "true" : "false")
  if (slug) fd.set("slug", slug)
  // Картинку шлём только если выбрана новая — иначе сервер оставит старую.
  if (values.imageFile) fd.set("image", values.imageFile)
  return fd
}

export function createNews(values: NewsFormValues): Promise<News> {
  return api<News>("/api/news/", {
    method: "POST",
    body: toFormData(values, newsSlug(values.title)),
  })
}

export function updateNews(slug: string, values: NewsFormValues): Promise<News> {
  return api<News>(`/api/news/${slug}/`, {
    method: "PATCH",
    body: toFormData(values),
  })
}

export function deleteNews(slug: string): Promise<void> {
  return api<void>(`/api/news/${slug}/`, { method: "DELETE" })
}
