"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { Athlete, Tournament } from "@/lib/types"
import { Users, Trophy, Plus, Trash2 } from "lucide-react"

interface TrainerViewProps {
  athletes: Athlete[]
  onUpdate: () => void
  onAddAthlete: (athlete: Athlete) => void
  setShowAddAthlete: (show: boolean) => void
}

export default function TrainerView({ athletes, onUpdate, onAddAthlete, setShowAddAthlete }: TrainerViewProps) {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loadingT, setLoadingT] = useState(false)
  const [registrationList, setRegistrationList] = useState<number[]>([])

  useEffect(() => {
    api<Tournament[]>("/api/tournament/tournaments/")
      .then(setTournaments)
      .catch(() => {})
  }, [])

  async function handleRegister() {
    if (!selectedTournament) return
    try {
      await Promise.all(
        registrationList.map(id =>
          api(`/api/tournament/tournaments/${selectedTournament.slug}/register_athlete/`, {
            method: "POST",
            body: JSON.stringify({ athlete_id: id })
          })
        )
      )
      setRegistrationList([])
      alert("Спортсмены успешно зарегистрированы")
    } catch (e) {
      alert("Ошибка при регистрации")
    }
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-blue/10 text-primary-blue rounded-lg">
              <Users size={24} />
            </div>
            <h2 className="text-xl font-bold text-dark-text">Мои спортсмены</h2>
          </div>
          <Button onClick={() => setShowAddAthlete(true)} className="gap-2">
            <Plus size={20} />
            Добавить ребёнка
          </Button>
        </div>

        {athletes.length === 0 ? (
          <p className="text-secondary-text text-center py-8">Спортсмены не найдены</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {athletes.map(a => (
              <div key={a.id} className="p-4 bg-light-gray rounded-xl border border-border flex justify-between items-center">
                <div>
                  <p className="font-semibold text-dark-text">{a.last_name} {a.first_name}</p>
                  <p className="text-xs text-secondary-text">
                    {a.age} лет · {a.weight} кг · {a.gender === 'male' ? 'Мальчик' : 'Девочка'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={async () => {
                    if(confirm("Удалить спортсмена?")) {
                      await api(`/api/tournament/athletes/${a.id}/`, { method: "DELETE" });
                      onUpdate();
                    }
                  }}>
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary-blue/10 text-primary-blue rounded-lg">
            <Trophy size={24} />
          </div>
          <h2 className="text-xl font-bold text-dark-text">Регистрация на соревнование</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-2">Выберите турнир</label>
            <select
              className="w-full h-12 px-4 rounded-xl border border-border bg-white text-sm focus:ring-2 focus:ring-primary-blue/30 outline-none"
              onChange={(e) => setSelectedTournament(tournaments.find(t => t.slug === e.target.value) || null)}
              value={selectedTournament?.slug || ""}
            >
              <option value="">-- Выберите турнир --</option>
              {tournaments.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}
            </select>
          </div>

          {selectedTournament && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-dark-text">Выберите спортсменов для участия:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {athletes.map(a => (
                  <label key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-light-gray transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary-blue rounded"
                      checked={registrationList.includes(a.id)}
                      onChange={(e) => {
                        if(e.target.checked) setRegistrationList([...registrationList, a.id])
                        else setRegistrationList(registrationList.filter(id => id !== a.id))
                      }}
                    />
                    <span className="text-sm text-dark-text">{a.last_name} {a.first_name}</span>
                  </label>
                ))}
              </div>
              <Button
                className="w-full h-12 text-lg"
                disabled={registrationList.length === 0}
                onClick={handleRegister}
              >
                Зарегистрировать {registrationList.length} спортсмена
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
