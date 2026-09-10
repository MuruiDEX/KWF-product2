"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { Plus, ChevronRight, ChevronLeft, Trophy, Layout, Users, Search, CheckCircle2, XCircle, UserPlus, X } from 'lucide-react'
import { api, apiErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Athlete } from '@/lib/types'

export type TournamentStep = 'info' | 'categories' | 'participants' | 'review'

interface Category {
  id: number
  name: string
  gender: string
  age_min: number
  age_max: number
  weight_max: number
}

interface CandidateAthlete extends Athlete {
  is_weight_match: boolean
  trainer: string
  club: string
}

export default function CreateTournamentPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [step, setStep] = useState<TournamentStep>('info')

  // Tournament Basic Info
  const [info, setInfo] = useState({
    name: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    location: '',
    description: '',
    mats_count: 1,
  })

  // Categories
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState({
    name: '',
    gender: 'male',
    age_min: 10,
    age_max: 12,
    weight_max: 45,
  })

  // Participants Selection
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [candidates, setCandidates] = useState<CandidateAthlete[]>([])
  const [selectedAthletes, setSelectedAthletes] = useState<Record<number, number[]>>({}) // categoryId -> athleteIds[]
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [candidatesError, setCandidatesError] = useState("")
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false)
  const [isSavingAthlete, setIsSavingAthlete] = useState(false)
  const [manualAthleteForm, setManualAthleteForm] = useState({
    first_name: '',
    last_name: '',
    birth_date: '',
    weight: '',
    height: '',
    gender: 'male' as 'male' | 'female',
    club: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [manualAthleteError, setManualAthleteError] = useState("")
  const todayStr = new Date().toISOString().slice(0, 10)

  const handleNext = async () => {
    if (step === 'info') {
      if (!info.name || !info.name.trim() || !info.start_date || !info.end_date) {
        return alert('Пожалуйста, заполните название, дату начала и дату окончания турнира')
      }
      setStep('categories')
    }
    else if (step === 'categories') {
      if (categories.length === 0) return alert('Добавьте хотя бы одну категорию')
      setStep('participants')
    }
    else if (step === 'participants') setStep('review')
  }

  const handlePrev = () => {
    if (step === 'categories') setStep('info')
    else if (step === 'participants') setStep('categories')
    else if (step === 'review') setStep('participants')
  }

  const addCategory = () => {
    const ageMin = Number(newCategory.age_min)
    const ageMax = Number(newCategory.age_max)
    const weightMax = Number(newCategory.weight_max)
    if (!Number.isFinite(ageMin) || !Number.isFinite(ageMax) || ageMin < 0 || ageMax < 0) {
      return alert('Укажите корректный возрастной диапазон')
    }
    if (ageMin > ageMax) {
      return alert('Минимальный возраст не может быть больше максимального')
    }
    if (!Number.isFinite(weightMax) || weightMax <= 0) {
      return alert('Укажите корректный максимальный вес')
    }
    setCategories([...categories, { ...newCategory, age_min: ageMin, age_max: ageMax, weight_max: weightMax, id: Date.now() }])
    setNewCategory({
      name: '',
      gender: 'male',
      age_min: 10,
      age_max: 12,
      weight_max: 45,
    })
  }

  const removeCategory = (id: number) => {
    setCategories(categories.filter(c => c.id !== id))
  }

  const loadCandidates = async (category: Category) => {
    setIsLoadingCandidates(true)
    setCandidatesError("")
    try {
      const params = new URLSearchParams({
        gender: category.gender,
        age_min: category.age_min.toString(),
        age_max: category.age_max.toString(),
        weight_max: category.weight_max.toString(),
      })
      // Возраст всех кандидатов считаем относительно даты начала турнира,
      // а не сегодняшнего дня.
      if (info.start_date) {
        params.set("date", info.start_date)
      }
      const res = await api<CandidateAthlete[]>(`/api/tournament/categories/search_candidates/?${params.toString()}`)
      setCandidates(res)
    } catch (e) {
      console.error("Failed to load candidates", e)
      setCandidates([])
      setCandidatesError(apiErrorMessage(e))
    } finally {
      setIsLoadingCandidates(false)
    }
  }

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
      return
    }
    if (user && user.profile?.role !== "trainer") {
      router.push("/cabinet")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const currentCat = categories.find(c => c.id === selectedCategoryId)
    if (currentCat) {
      loadCandidates(currentCat)
    }
  }, [selectedCategoryId, categories, info.start_date])

  if (!user || user.profile?.role !== "trainer") return null

  const toggleAthlete = (athleteId: number) => {
    if (!selectedCategoryId) return
    const current = selectedAthletes[selectedCategoryId] || []
    const next = current.includes(athleteId)
      ? current.filter(id => id !== athleteId)
      : [...current, athleteId]

    setSelectedAthletes({
      ...selectedAthletes,
      [selectedCategoryId]: next
    })
  }

  const handleSaveManualAthlete = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingAthlete(true)
    setManualAthleteError("")
    try {
      const newAthlete = await api<Athlete>("/api/tournament/athletes/", {
        method: "POST",
        body: JSON.stringify({
          first_name: manualAthleteForm.first_name.trim(),
          last_name: manualAthleteForm.last_name.trim(),
          birth_date: manualAthleteForm.birth_date,
          weight: manualAthleteForm.weight.replace(",", ".").trim(),
          height: manualAthleteForm.height.trim() === "" ? null : manualAthleteForm.height.replace(",", ".").trim(),
          gender: manualAthleteForm.gender,
          club: manualAthleteForm.club.trim(),
        }),
      })

      if (selectedCategoryId) {
        toggleAthlete(newAthlete.id)
      }

      const currentCat = categories.find(c => c.id === selectedCategoryId)
      if (currentCat) {
        loadCandidates(currentCat)
      }

      setIsManualAddModalOpen(false)
      setManualAthleteForm({
        first_name: '',
        last_name: '',
        birth_date: '',
        weight: '',
        height: '',
        gender: 'male',
        club: '',
      })
    } catch (e) {
      console.error("Ошибка при создании атлета:", e)
      setManualAthleteError(apiErrorMessage(e))
    } finally {
      setIsSavingAthlete(false)
    }
  }

  const handleSubmit = async () => {
    const trimmedName = info.name?.trim()
    if (!trimmedName || !info.start_date || !info.end_date) {
      return alert('Пожалуйста, заполните название, дату начала и дату окончания турнира')
    }

    if (info.start_date > info.end_date) {
      return alert('Дата начала не может быть позже даты окончания')
    }

    for (const cat of categories) {
      const picked = selectedAthletes[cat.id] || []
      if (picked.length === 1) {
        const genderLabel = cat.gender === 'male' ? 'Мальчики' : cat.gender === 'female' ? 'Девочки' : 'Смешанная'
        return alert(`В категории «${cat.name?.trim() || `${genderLabel} ${cat.age_min}-${cat.age_max}`}» только один участник. Добавьте ещё спортсменов или уберите выбор, иначе сетку построить нельзя.`)
      }
    }

    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      const translit: Record<string, string> = {
        а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
        з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
        п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
        ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e",
        ю: "yu", я: "ya",
      }
      const slugBase = trimmedName
        .toLowerCase()
        .split("")
        .map((ch) => translit[ch] ?? ch)
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
      const slug = `${slugBase || "tournament"}-${rand}`

      const tournamentRes = await api<any>("/api/tournament/tournaments/", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          slug: slug || `tournament-${Date.now()}`,
          start_date: info.start_date,
          start_time: info.start_time || null,
          end_date: info.end_date,
          end_time: info.end_time || null,
          description: info.description,
          location: info.location?.trim() || "",
          mats_count: info.mats_count,
          status: "draft",
        }),
      })

      const tournamentId = tournamentRes.id





      
      // Create categories
      for (const cat of categories) {
        const genderLabel = cat.gender === 'male' ? 'Мальчики' : cat.gender === 'female' ? 'Девочки' : 'Смешанная'
        const categoryName = cat.name?.trim() || `${genderLabel} ${cat.age_min}-${cat.age_max} лет, до ${cat.weight_max} кг`

        const catRes = await api<any>("/api/tournament/categories/", {
          method: "POST",
          body: JSON.stringify({
            tournament: tournamentId,
            name: categoryName,
            age_min: cat.age_min,
            age_max: cat.age_max,
            weight_max: cat.weight_max,
            gender: cat.gender,
            order: categories.indexOf(cat),
          }),
        })

        // Add selected athletes to category
        const athleteIds = selectedAthletes[cat.id] || []
        if (athleteIds.length > 0) {
          await api(`/api/tournament/categories/${catRes.id}/generate_bracket/`, {
            method: "POST",
            body: JSON.stringify({ athlete_ids: athleteIds }),
          })
        }
      }
      
      router.push(`/cabinet/tournaments`)
    } catch (e) {
      console.error(e)
      alert("Ошибка при создании турнира")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-blue">
          Конструктор турнира
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-dark-text tracking-tight mt-2">
          Создание турнира
        </h1>
        <p className="text-secondary-text mt-2 max-w-xl">
          Заполните данные по шагам: информация, категории, участники — затем проверьте и запустите турнир.
        </p>
      </div>

      {/* Progress Stepper */}
      <div className="mb-10">
        <div className="h-1.5 rounded-full bg-border overflow-hidden mb-6">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-blue to-gold transition-all duration-500"
            style={{ width: `${((['info', 'categories', 'participants', 'review'].indexOf(step)) + 1) * 25}%` }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'info' as TournamentStep, label: 'Основное', hint: 'Даты и место' },
            { id: 'categories' as TournamentStep, label: 'Категории', hint: 'Возраст и вес' },
            { id: 'participants' as TournamentStep, label: 'Участники', hint: 'Состав' },
            { id: 'review' as TournamentStep, label: 'Проверка', hint: 'Запуск' },
          ].map((s, idx) => {
            const currentIdx = ['info', 'categories', 'participants', 'review'].indexOf(step)
            const isCompleted = idx < currentIdx || step === 'review'
            const isActive = step === s.id
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 rounded-2xl border p-3 transition-all duration-300 ${
                  isActive
                    ? 'bg-dark-blue border-dark-blue shadow-lg shadow-dark-blue/20 dark:border-gold dark:shadow-gold/10'
                    : isCompleted
                      ? 'bg-white border-border dark:bg-white/5 dark:border-[#1E3A5F]'
                      : 'bg-white border-border dark:bg-white/5 dark:border-[#1E3A5F]'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold tabular-nums shrink-0 transition-all ${
                  isActive ? 'bg-gold text-dark-blue' :
                  isCompleted ? 'bg-success text-white' : 'bg-light-gray text-secondary-text'
                }`}>
                  {isCompleted && !isActive ? '✓' : `0${idx + 1}`}
                </div>
                <div className="min-w-0">
                  <div className={`text-[13px] font-bold truncate ${isActive ? 'text-white' : 'text-dark-text'}`}>
                    {s.label}
                  </div>
                  <div className={`text-[11px] truncate ${isActive ? 'text-white/55' : 'text-secondary-text'}`}>
                    {s.hint}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 min-h-[500px] flex flex-col">
        {step === 'info' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-dark-blue rounded-2xl text-gold shrink-0">
                <Trophy size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-dark-text">Основная информация</h2>
                <p className="text-sm text-secondary-text mt-0.5">Название, даты проведения и место турнира</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">Название турнира</label>
                <input 
                  type="text" 
                  value={info.name}
                  onChange={e => setInfo({...info, name: e.target.value})}
                  placeholder="Например: Кубок Павлодара 2026"
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">Дата начала *</label>
                <input 
                  type="date" 
                  value={info.start_date}
                  onChange={e => setInfo({...info, start_date: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">Время начала</label>
                <input 
                  type="time" 
                  value={info.start_time}
                  onChange={e => setInfo({...info, start_time: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">Дата окончания *</label>
                <input 
                  type="date" 
                  value={info.end_date}
                  onChange={e => setInfo({...info, end_date: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">Время окончания</label>
                <input 
                  type="time" 
                  value={info.end_time}
                  onChange={e => setInfo({...info, end_time: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">Место проведения</label>
                <input 
                  type="text" 
                  value={info.location}
                  onChange={e => setInfo({...info, location: e.target.value})}
                  placeholder="Спорткомплекс, город..."
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">Количество татами</label>
                <input 
                  type="number" 
                  value={info.mats_count}
                  onChange={e => setInfo({...info, mats_count: parseInt(e.target.value)})}
                  min={1}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-semibold text-gray-600">Описание</label>
                <textarea 
                  value={info.description}
                  onChange={e => setInfo({...info, description: e.target.value})}
                  placeholder="Дополнительная информация о турнире..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {step === 'categories' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-dark-blue rounded-2xl text-gold shrink-0">
                <Layout size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-dark-text">Настройка категорий</h2>
                <p className="text-sm text-secondary-text mt-0.5">Пол, возраст и весовые ограничения каждой категории</p>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300 dark:bg-white/5 dark:border-[#1E3A5F] dark:hover:border-gold/50 transition-colors space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600">Пол</label>
                  <select 
                    value={newCategory.gender}
                    onChange={e => setNewCategory({...newCategory, gender: e.target.value})}
                    className="w-full p-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                  >
                    <option value="male">Мальчики</option>
                    <option value="female">Девочки</option>
                    <option value="any">Любые</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600">Возраст (от - до)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={newCategory.age_min}
                      onChange={e => setNewCategory({...newCategory, age_min: parseInt(e.target.value)})}
                      className="w-full p-3 rounded-xl border border-gray-200 bg-white outline-none"
                    />
                    <span className="text-gray-400">—</span>
                    <input 
                      type="number" 
                      value={newCategory.age_max}
                      onChange={e => setNewCategory({...newCategory, age_max: parseInt(e.target.value)})}
                      className="w-full p-3 rounded-xl border border-gray-200 bg-white outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600">Макс. вес (кг)</label>
                  <input 
                    type="number" 
                    value={newCategory.weight_max}
                    onChange={e => setNewCategory({...newCategory, weight_max: parseFloat(e.target.value)})}
                    className="w-full p-3 rounded-xl border border-gray-200 bg-white outline-none"
                  />
                </div>
              </div>
              <Button 
                onClick={addCategory}
                className="w-full py-6 rounded-xl bg-primary-blue hover:bg-primary-blue/90 text-white font-bold flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Добавить категорию
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map((cat, idx) => (
                <div key={cat.id} className="p-4 rounded-2xl border border-gray-200 bg-white flex items-center justify-between group hover:border-primary-blue transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-dark-text">
                        {cat.gender === 'male' ? 'Мальчики' : cat.gender === 'female' ? 'Девочки' : 'Смешанная'} {cat.age_min}-{cat.age_max} лет, до {cat.weight_max} кг
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeCategory(cat.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl"
                  >
                    Удалить
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'participants' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-dark-blue rounded-2xl text-gold shrink-0">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-dark-text">Выбор участников</h2>
                  <p className="text-sm text-secondary-text mt-0.5">Отметьте спортсменов для каждой категории</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 font-medium">Выберите категорию:</span>
                <select 
                  value={selectedCategoryId || ''}
                  onChange={e => setSelectedCategoryId(parseInt(e.target.value))}
                  className="p-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-primary-blue"
                >
                  <option value="">-- Выберите категорию --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.gender === 'male' ? 'Мальчики' : cat.gender === 'female' ? 'Девочки' : 'Смешанная'} {cat.age_min}-{cat.age_max} лет, до {cat.weight_max} кг
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedCategoryId ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                  <Search size={40} />
                </div>
                <p className="text-gray-500 max-w-xs">
                  Пожалуйста, выберите категорию сверху, чтобы увидеть подходящих спортсменов из базы данных.
                </p>
              </div>
            ) : isLoadingCandidates ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-10 h-10 border-4 border-primary-blue border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500">Поиск подходящих атлетов...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-dark-text">
                    Подходящие спортсмены ({candidates.length})
                  </h3>
                  <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => { setManualAthleteError(""); setIsManualAddModalOpen(true) }}>
                    <UserPlus size={16} />
                    Добавить вручную
                  </Button>
                </div>
                {candidatesError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {candidatesError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  {candidates.map(athlete => {
                    const isSelected = (selectedAthletes[selectedCategoryId] || []).includes(athlete.id)
                    return (
                      <div 
                        key={athlete.id} 
                        onClick={() => toggleAthlete(athlete.id)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? 'border-primary-blue bg-primary-blue/5' 
                            : 'border-gray-100 hover:border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-primary-blue border-primary-blue text-white' : 'border-gray-300'
                          }`}>
                            {isSelected && <CheckCircle2 size={14} />}
                          </div>
                          <div>
                            <p className="font-bold text-dark-text">{athlete.last_name} {athlete.first_name}</p>
                            <p className="text-xs text-gray-500">
                              {athlete.age} лет • {athlete.weight} кг • {athlete.club || 'Клуб не указан'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {athlete.is_weight_match ? (
                            <div className="flex items-center gap-1 text-green-600 text-xs font-medium bg-green-50 dark:bg-transparent dark:border dark:border-green-600/40 px-2 py-1 rounded-lg">
                              <CheckCircle2 size={12} />
                              Подходит по весу
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-red-600 text-xs font-medium bg-red-50 dark:bg-transparent dark:border dark:border-red-600/40 px-2 py-1 rounded-lg">
                              <XCircle size={12} />
                              Не подходит ({athlete.weight} кг)
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {candidates.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      Спортсмены не найдены. Попробуйте изменить параметры категории.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-dark-blue rounded-2xl text-gold shrink-0">
                <Trophy size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-dark-text">Проверка и запуск</h2>
                <p className="text-sm text-secondary-text mt-0.5">Убедитесь, что всё заполнено верно, и запускайте турнир</p>
              </div>
            </div>
            <div className="bg-gray-50 p-6 rounded-2xl space-y-4">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Турнир:</span>
                <span className="font-bold text-dark-text">{info.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Начало:</span>
                <span className="font-bold text-dark-text">{info.start_date} {info.start_time}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Окончание:</span>
                <span className="font-bold text-dark-text">{info.end_date} {info.end_time}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Татами:</span>
                <span className="font-bold text-dark-text">{info.mats_count}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Категории:</span>
                <span className="font-bold text-dark-text">{categories.length} шт.</span>
              </div>
            </div>
            <div className="text-center text-gray-400 text-sm py-4">
              Пожалуйста, проверьте все данные перед созданием турнира.
            </div>
          </div>
        )}

      </div>

      {isManualAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-dark-text">Добавить атлета вручную</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsManualAddModalOpen(false)}>
                <X size={24} />
              </Button>
            </div>
            <form onSubmit={handleSaveManualAthlete} className="space-y-4">
              {manualAthleteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {manualAthleteError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600">Имя *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={manualAthleteForm.first_name}
                    onChange={e => setManualAthleteForm({...manualAthleteForm, first_name: e.target.value})}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600">Фамилия *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={manualAthleteForm.last_name}
                    onChange={e => setManualAthleteForm({...manualAthleteForm, last_name: e.target.value})}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600">Дата рождения *</label>
                  <input
                    type="date"
                    required
                    value={manualAthleteForm.birth_date}
                    max={todayStr}
                    onChange={e => setManualAthleteForm({...manualAthleteForm, birth_date: e.target.value})}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600">Пол *</label>
                  <select
                    value={manualAthleteForm.gender}
                    onChange={e => setManualAthleteForm({...manualAthleteForm, gender: e.target.value as any})}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all bg-white"
                  >
                    <option value="male">Мальчик</option>
                    <option value="female">Девочка</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600">Вес (кг) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={manualAthleteForm.weight}
                    onChange={e => setManualAthleteForm({...manualAthleteForm, weight: e.target.value.replace(",", ".")})}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600">Рост (см)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualAthleteForm.height}
                    onChange={e => setManualAthleteForm({...manualAthleteForm, height: e.target.value.replace(",", ".")})}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">Клуб / тренер *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={manualAthleteForm.club}
                  onChange={e => setManualAthleteForm({...manualAthleteForm, club: e.target.value})}
                  placeholder="KWF Pavlodar / Иванов А.А."
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all"
                />
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsManualAddModalOpen(false)}
                  className="px-6 h-11 rounded-xl"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingAthlete}
                  className="bg-primary-blue text-white px-8 h-11 rounded-xl font-bold hover:bg-primary-blue/90 transition-all"
                >
                  {isSavingAthlete ? 'Сохранение...' : 'Добавить атлета'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between mt-8">
        <Button 
          variant="ghost" 
          onClick={handlePrev} 
          disabled={step === 'info'}
          className="flex items-center gap-2 text-gray-500 hover:text-dark-blue rounded-xl px-6 h-11"
        >
          <ChevronLeft size={20} />
          Назад
        </Button>

        <Button
          onClick={step === 'review' ? handleSubmit : handleNext}
          disabled={isSubmitting || (step === 'info' && (!info.name || !info.name.trim() || !info.start_date || !info.end_date))}
          className={`flex items-center gap-2 rounded-xl px-8 h-11 font-bold transition-all ${
            step === 'review' ? 'bg-success text-white hover:brightness-110 shadow-lg shadow-success/25' : 'bg-dark-blue text-white hover:bg-primary-blue shadow-lg shadow-dark-blue/20 dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]'
          }`}
        >
          {isSubmitting ? 'Создание...' : step === 'review' ? 'Запустить турнир' : 'Продолжить'}
          {!isSubmitting && <ChevronRight size={20} />}
        </Button>
      </div>
    </div>
  )
}