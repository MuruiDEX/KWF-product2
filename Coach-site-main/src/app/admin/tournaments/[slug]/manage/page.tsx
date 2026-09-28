"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { api } from "@/lib/api"
import type { Tournament } from "@/lib/types"

/** Фаза 4: legacy ручного CRUD сетки больше нет — единая точка управления
 * в кабинете (там live-контроль, журнал и guards). Эта страница только
 * резолвит slug в id и ведёт туда. */
export default function AdminManageRedirectPage() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    api<Tournament>(`/api/tournament/tournaments/${params.slug}/`)
      .then((t) => {
        if (!cancelled) router.replace(`/cabinet/tournaments/${t.id}/manage`)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [params.slug, router])

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-secondary-text">
        Открываем управление турниром…{" "}
        <Link
          href="/admin/tournaments"
          className="font-semibold text-primary-blue hover:text-primary-blue-light"
        >
          К списку турниров
        </Link>
      </p>
    </div>
  )
}
