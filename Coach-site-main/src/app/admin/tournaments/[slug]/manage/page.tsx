"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { api, unwrapList } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, Trash2, Save, Users } from "lucide-react"
import type { Tournament, TournamentCategory, Round, Match, Athlete } from "@/lib/types"

export default function ManageTournamentPage() {
  const params = useParams()
  const router = useRouter()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [params.slug])

  async function fetchData() {
    setLoading(true)
    try {
      const [t, a] = await Promise.all([
        api<Tournament>(`/api/tournament/tournaments/${params.slug}/`),
        api<Athlete[] | { results: Athlete[] }>("/api/tournament/athletes/")
      ])
      setTournament(t)
      setAthletes(unwrapList(a))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateMatch(match: Match, updates: Partial<Match>) {
    setSaving(true)
    try {
      await api(`/api/tournament/matches/${match.id}/`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      })
      await fetchData()
    } catch (e) {
      alert("Ошибка при обновлении матча")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCategory() {
    const name = prompt("Введите название категории")
    if (!name) return
    try {
      await api("/api/tournament/categories/", {
        method: "POST",
        body: JSON.stringify({
          tournament: tournament?.id,
          name: name,
          age_min: 0,
          age_max: 100,
          weight_max: "100",
          gender: "any",
          order: tournament?.categories?.length || 0
        }),
      })
      await fetchData()
    } catch (e) {
      alert("Ошибка при создании категории")
    }
  }

  async function handleAddRound(category: TournamentCategory) {
    const name = prompt("Введите название раунда (напр: 1/8 финала)")
    if (!name) return
    try {
      await api("/api/tournament/rounds/", {
        method: "POST",
        body: JSON.stringify({
          category: category.id,
          name: name,
          order: category.rounds.length || 0
        }),
      })
      await fetchData()
    } catch (e) {
      alert("Ошибка при создании раунда")
    }
  }

  async function handleAddMatch(round: Round) {
    try {
      await api("/api/tournament/matches/", {
        method: "POST",
        body: JSON.stringify({
          round: round.id,
          match_number: round.matches.length + 1,
          score1: 0,
          score2: 0,
          status: "pending"
        }),
      })
      await fetchData()
    } catch (e) {
      alert("Ошибка при создании матча")
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!tournament) {
    return <div className="text-center py-20">Турнир не найден</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
          <h1 className="text-3xl font-extrabold text-dark-text">Управление структурой</h1>
        </div>
        <Button onClick={handleAddCategory} className="gap-2">
          <Plus size={20} />
          Добавить категорию
        </Button>
      </div>

      <div className="space-y-8">
        {(tournament.categories || []).map((cat) => (
          <div key={cat.id} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="bg-light-gray p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-dark-text">{cat.name}</h2>
                <span className="text-xs px-2 py-0.5 bg-white border border-border rounded-full text-secondary-text">
                  {cat.gender} | {cat.age_min}-{cat.age_max} лет
                </span>
              </div>
              <Button onClick={() => handleAddRound(cat)} size="sm" className="gap-2">
                <Plus size={16} />
                Раунд
              </Button>
            </div>

            <div className="p-4 space-y-6">
              {cat.rounds.map((round) => (
                <div key={round.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-dark-text flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary-blue text-white text-xs flex items-center justify-center">
                        {round.order + 1}
                      </span>
                      {round.name}
                    </h3>
                    <Button onClick={() => handleAddMatch(round)} size="sm" variant="ghost" className="gap-2 text-xs">
                      <Plus size={14} />
                      Матч
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {round.matches.map((match) => (
                      <div key={match.id} className="p-4 bg-light-gray rounded-xl border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-secondary-text">Матч #{match.match_number}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${match.status === "finished" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {match.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <select
                              value={match.athlete1 || ""}
                              onChange={(e) => handleUpdateMatch(match, { athlete1: Number(e.target.value) || null })}
                              className="w-full p-2 text-xs rounded-lg border border-border bg-white"
                            >
                              <option value="">Выберите атлета 1</option>
                              {athletes.map(a => (
                                <option key={a.id} value={a.id}>{a.last_name} {a.first_name}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={match.score1}
                              onChange={(e) => handleUpdateMatch(match, { score1: Number(e.target.value) })}
                              className="w-full p-2 text-xs rounded-lg border border-border text-center font-bold"
                            />
                          </div>
                          <div className="space-y-2">
                            <select
                              value={match.athlete2 || ""}
                              onChange={(e) => handleUpdateMatch(match, { athlete2: Number(e.target.value) || null })}
                              className="w-full p-2 text-xs rounded-lg border border-border bg-white"
                            >
                              <option value="">Выберите атлета 2</option>
                              {athletes.map(a => (
                                <option key={a.id} value={a.id}>{a.last_name} {a.first_name}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={match.score2}
                              onChange={(e) => handleUpdateMatch(match, { score2: Number(e.target.value) })}
                              className="w-full p-2 text-xs rounded-lg border border-border text-center font-bold"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <select
                            value={match.winner || ""}
                            onChange={(e) => handleUpdateMatch(match, { winner: Number(e.target.value) || null })}
                            className="text-xs p-1 rounded border border-border bg-white"
                          >
                            <option value="">Победитель</option>
                            {athletes.map(a => (
                              <option key={a.id} value={a.id}>{a.last_name}</option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => handleUpdateMatch(match, { status: "finished" })}
                          >
                            <Save size={12} />
                            Завершить
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
