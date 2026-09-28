"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Newspaper, Plus, Edit, Trash2, Eye } from "lucide-react"
import { api, apiErrorMessage, unwrapList } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { News } from "@/lib/types"
import { deleteNews } from "@/lib/news"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import StatusPill from "@/components/ui/StatusPill"
import { Breadcrumbs } from "@/components/ui/Breadcrumbs"
import { toast } from "@/components/ui/Toaster"

/** Кабинет тренера → Новости: только свои публикации.
 * Staff видит все (административные возможности сохранены).
 * Удаление — по slug (lookup_field бэкенда), с подтверждением. */
export default function CabinetNewsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<News[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<News | null>(null)
  const [deleting, setDeleting] = useState(false)

  const role = user?.profile?.role ?? "parent"
  const canAccess = !!user && (role === "trainer" || user.is_staff)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login?next=/cabinet/news")
      return
    }
    if (!canAccess) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    api<News[]>("/api/news/")
      .then((data) => {
        if (cancelled) return
        setItems(unwrapList<News>(data))
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, user, canAccess, router])

  async function doDelete(item: News) {
    setPendingDelete(null)
    setDeleting(true)
    try {
      await deleteNews(item.slug)
      setItems((prev) => prev.filter((n) => n.id !== item.id))
      toast("Новость удалена", "success")
    } catch (e) {
      toast(apiErrorMessage(e), "error")
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Кабинет", href: "/cabinet" }, { label: "Новости" }]} />
        <div className="bg-white rounded-2xl border border-border p-10 text-center">
          <Newspaper size={32} className="mx-auto mb-3 text-secondary-text" />
          <h1 className="text-xl font-extrabold text-dark-text">Раздел для тренеров</h1>
          <p className="text-sm text-secondary-text mt-2">
            Публиковать новости могут только тренеры клуба.
          </p>
          <Link href="/news" className="inline-block mt-5">
            <Button variant="secondary">Читать новости</Button>
          </Link>
        </div>
      </div>
    )
  }

  const mine = user.is_staff ? items : items.filter((n) => n.author === user.id)

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Кабинет", href: "/cabinet" }, { label: "Новости" }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-dark-text">Мои публикации</h1>
          <p className="text-secondary-text">
            {user.is_staff
              ? "Все новости клуба (режим администратора)"
              : "Черновики видите только вы, опубликованное — все посетители"}
          </p>
        </div>
        <Link href="/cabinet/news/new">
          <Button className="gap-2">
            <Plus size={18} />
            Новая публикация
          </Button>
        </Link>
      </div>

      {loadError && mine.length === 0 && (
        <div className="p-4 rounded-xl border border-error/30 bg-error-bg/40 text-sm text-error" role="alert">
          Не удалось загрузить список — проверьте соединение и обновите страницу.
        </div>
      )}

      {mine.length === 0 && !loadError ? (
        <div className="bg-white rounded-2xl border border-border p-10 text-center">
          <Newspaper size={32} className="mx-auto mb-3 text-secondary-text" />
          <p className="text-secondary-text">Публикаций пока нет — расскажите о жизни клуба.</p>
          <Link href="/cabinet/news/new" className="inline-block mt-5">
            <Button>Создать первую новость</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {mine.map((item) => (
            <li
              key={item.id}
              className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4 dojo-top-line"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover shrink-0 hidden sm:block"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-dark-text truncate">{item.title}</div>
                <div className="text-xs text-secondary-text mt-1 tabular-nums">
                  {new Date(item.created_at).toLocaleDateString("ru-RU")} ·{" "}
                  {item.author_name ?? "Клуб"}
                </div>
                <div className="mt-2">
                  <StatusPill status={item.is_published ? "published" : "draft"} />
                </div>
              </div>
              <div className="flex shrink-0">
                {item.is_published && (
                  <Link
                    href={`/news/${item.slug}`}
                    target="_blank"
                    className="p-2.5 text-secondary-text hover:text-primary-blue transition-colors"
                    title="Просмотр"
                    aria-label={`Просмотр: ${item.title}`}
                  >
                    <Eye size={18} />
                  </Link>
                )}
                <Link
                  href={`/cabinet/news/${item.slug}/edit`}
                  className="p-2.5 text-secondary-text hover:text-primary-blue transition-colors"
                  title="Редактировать"
                  aria-label={`Редактировать: ${item.title}`}
                >
                  <Edit size={18} />
                </Link>
                <button
                  type="button"
                  onClick={() => setPendingDelete(item)}
                  className="p-2.5 text-secondary-text hover:text-red-500 transition-colors cursor-pointer"
                  title="Удалить"
                  aria-label={`Удалить: ${item.title}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Удалить новость «${pendingDelete?.title ?? ""}»?`}
        confirmLabel="Удалить"
        danger
        busy={deleting}
        onConfirm={() => pendingDelete && doDelete(pendingDelete)}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}
