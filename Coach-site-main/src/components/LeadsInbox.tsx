"use client"

import { useCallback, useEffect, useState } from "react"
import { Inbox } from "lucide-react"
import { api, apiErrorMessage, unwrapList } from "@/lib/api"
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import EmptyState from "@/components/ui/EmptyState"
import { toast } from "@/components/ui/Toaster"

/** P1: инбокс заявок с лендинга для тренера.
 * Список + смена статуса + удаление. Только role==='trainer'. */
export function LeadsInbox() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await api<Lead[] | { results: Lead[] }>("/api/leads/")
      setLeads(unwrapList(data))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetch-effect: сброс loading перед запросом намеренный.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    if (lead.status === status || busyId !== null) return
    setBusyId(lead.id)
    try {
      const updated = await api<Lead>(`/api/leads/${lead.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)))
      toast("Статус заявки обновлён", "success")
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (lead: Lead) => {
    if (busyId !== null) return
    setBusyId(lead.id)
    try {
      await api(`/api/leads/${lead.id}/`, { method: "DELETE" })
      setLeads((prev) => prev.filter((l) => l.id !== lead.id))
      toast("Заявка удалена", "success")
    } catch (err) {
      toast(apiErrorMessage(err), "error")
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <EmptyState
        icon={<Inbox size={26} />}
        title="Не удалось загрузить заявки"
        hint="Проверьте соединение и попробуйте ещё раз"
        action={<Button size="sm" onClick={() => void load()}>Повторить</Button>}
      />
    )
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={26} />}
        title="Заявок пока нет"
        hint="Заявки с лендинга (тарифы, пробное занятие) появятся здесь"
      />
    )
  }

  const newCount = leads.filter((l) => l.status === "new").length

  return (
    <div>
      {newCount > 0 && (
        <p className="text-xs font-bold text-gold uppercase tracking-wider mb-3">
          Новых: {newCount}
        </p>
      )}
      <div className="space-y-3">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className="p-3.5 bg-light-gray rounded-xl border border-border"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-dark-text truncate">
                  {lead.name}
                </p>
                <a
                  href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}
                  className="text-sm font-semibold text-primary-blue hover:text-primary-blue-light"
                >
                  {lead.phone}
                </a>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white border border-border text-secondary-text shrink-0">
                {lead.plan_display ?? lead.plan}
              </span>
            </div>
            {lead.message && (
              <p className="text-xs text-secondary-text mt-1.5 line-clamp-2">
                {lead.message}
              </p>
            )}
            <p className="text-[11px] text-secondary-text mt-1.5">
              {new Date(lead.created_at).toLocaleString("ru-RU", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {lead.source ? ` · ${lead.source}` : ""}
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <select
                value={lead.status}
                disabled={busyId === lead.id}
                onChange={(e) => void setStatus(lead, e.target.value as LeadStatus)}
                aria-label={`Статус заявки ${lead.name}`}
                className="h-9 flex-1 min-w-0 px-2 rounded-lg border border-border bg-white text-dark-text text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue disabled:opacity-50"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busyId === lead.id}
                onClick={() => void remove(lead)}
                className="h-9 px-3 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
