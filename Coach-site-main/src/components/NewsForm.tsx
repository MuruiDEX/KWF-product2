"use client"

import { useRef, useState } from "react"
import { ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormField, TextInput } from "@/components/ui/FormField"
import {
  NEWS_TEXT_MAX,
  NEWS_TITLE_MAX,
  validateNewsForm,
  type NewsFormErrors,
  type NewsFormValues,
} from "@/lib/news"

/** Общая форма новости (кабинет тренера + админка).
 * controlled-поля без key/remount; файл — через input ref, в state только File.
 * Родитель выполняет запрос и показывает toast/redirect. */
export function NewsForm({
  initial,
  currentImage,
  submitDraftLabel,
  submitPublishLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: NewsFormValues
  /** URL текущей картинки (режим редактирования) — только превью. */
  currentImage?: string | null
  submitDraftLabel: string
  submitPublishLabel: string
  busy: boolean
  onSubmit: (values: NewsFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<NewsFormValues>(initial)
  const [errors, setErrors] = useState<NewsFormErrors>({})
  const fileRef = useRef<HTMLInputElement | null>(null)

  const set = <K extends keyof NewsFormValues>(field: K, value: NewsFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const submit = (publish: boolean) => {
    const next = { ...values, is_published: publish }
    const validation = validateNewsForm(next)
    setErrors(validation)
    if (Object.keys(validation).length > 0) return
    onSubmit(next)
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        submit(true)
      }}
    >
      <FormField label="Заголовок" error={errors.title} hint={`До ${NEWS_TITLE_MAX} символов`}>
        <TextInput
          value={values.title}
          invalid={!!errors.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Например: Открытый турнир на призы клуба"
          maxLength={NEWS_TITLE_MAX}
          autoComplete="off"
        />
      </FormField>

      <FormField
        label="Текст новости"
        error={errors.description}
        hint={`Минимум 10 символов, максимум ${NEWS_TEXT_MAX}`}
      >
        <textarea
          value={values.description}
          aria-invalid={errors.description ? true : undefined}
          onChange={(e) => set("description", e.target.value)}
          rows={8}
          maxLength={NEWS_TEXT_MAX}
          placeholder="Расскажите, что произошло, когда и где…"
          className={`w-full p-4 rounded-xl border bg-white text-sm text-dark-text placeholder:text-secondary-text/80 focus-visible:outline-none focus-visible:ring-2 focus:ring-primary-blue/60 resize-y min-h-[180px] ${
            errors.description ? "border-error" : "border-border"
          }`}
        />
      </FormField>

      <FormField
        label="Изображение"
        error={errors.imageFile}
        hint="Необязательно. JPEG, PNG или WebP до 5 МБ"
      >
        <div className="flex flex-wrap items-center gap-3">
          {currentImage && !values.imageFile && (
            <img
              src={currentImage}
              alt=""
              className="w-20 h-20 rounded-xl object-cover border border-border"
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-invalid={errors.imageFile ? true : undefined}
            onChange={(e) => set("imageFile", e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            <ImagePlus size={16} />
            {values.imageFile ? "Заменить изображение" : currentImage ? "Заменить изображение" : "Выбрать изображение"}
          </Button>
          {values.imageFile && (
            <span className="text-sm text-secondary-text truncate max-w-[220px]">
              {values.imageFile.name}
            </span>
          )}
        </div>
      </FormField>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          Отмена
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => submit(false)}
        >
          {busy ? "Сохранение…" : submitDraftLabel}
        </Button>
        <Button type="submit" disabled={busy} className="px-8">
          {busy ? "Публикация…" : submitPublishLabel}
        </Button>
      </div>
    </form>
  )
}
