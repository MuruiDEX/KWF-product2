// Тонкая обёртка: вся логика табло — в components/TournamentBoard
// (переиспользуется /live/tv). Маршрут и поведение без изменений.

"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import { TournamentBoard } from "@/components/TournamentBoard"

function BoardRoute() {
  const params = useParams()
  const slug = params.slug as string
  return <TournamentBoard slug={slug} backHref={`/tournaments/${slug}`} />
}

export default function TournamentBoardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-dark-blue flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BoardRoute />
    </Suspense>
  )
}
