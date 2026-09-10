"use client"

import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import StatusPill from "@/components/ui/StatusPill"
import TournamentBrackets from "@/components/TournamentBrackets"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"

export default function TournamentBracketPage() {
  const params = useParams()
  const [name, setName] = useState<string>("")
  const [status, setStatus] = useState<string>("draft")

  useEffect(() => {
    api<{ name?: string; status?: string }>(`/api/tournament/tournaments/${params.id}/`)
      .then((t) => {
        setName(t.name ?? "")
        setStatus(t.status ?? "draft")
      })
      .catch(() => {})
  }, [params.id])

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-secondary-text"
              onClick={() => window.history.back()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
              Назад
            </Button>
            <div>
              <h1 className="text-3xl font-extrabold text-dark-text">Конструктор сетки</h1>
              <p className="text-secondary-text">{name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={status} />
          </div>
        </div>

        <TournamentBrackets tournamentId={params.id as string} />
      </div>
    </div>
  )
}
