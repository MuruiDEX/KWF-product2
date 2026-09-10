"use client"

import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import LiveQueue from "@/components/LiveQueue"

export default function LiveTournamentPage() {
  const params = useParams()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-light-gray p-6">
      <div className="mx-auto max-w-[1400px] space-y-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-secondary-text"
            onClick={() => router.back()}
          >
            <ArrowLeft size={16} />
            Назад
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold text-dark-text">Управление боями</h1>
            <p className="text-secondary-text">Живая очередь турнира</p>
          </div>
        </div>

        <LiveQueue tournamentId={params.id as string} />
      </div>
    </div>
  )
}
