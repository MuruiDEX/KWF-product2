"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { usePathname, useRouter } from 'next/navigation'
import { Plus, ChevronRight, ChevronLeft, Trophy, Layout, Users, Search, CheckCircle2, XCircle, UserPlus } from 'lucide-react'
import { api, apiErrorMessage, unwrapList } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Athlete, TournamentTemplate } from '@/lib/types'
import {
  AthleteModal,
  EMPTY_ATHLETE_FORM,
  type AthleteFormState,
} from '@/app/cabinet/_components/AthleteModal'
import { autoCategoryName, findCategoryOverlaps } from '@/lib/categoryUtils'
import { matchAthleteName, paginateParticipants, clampPage, visibleRange, pageCountFor } from '@/lib/participants'
import { toggleSelectedId, selectScope, deselectScope, countSelectedOnPage } from '@/lib/childSelection'
import { Pager } from '@/components/Pager'
import { SelectionToolbar } from '@/components/SelectionToolbar'

export type TournamentStep = 'info' | 'categories' | 'participants' | 'review'

interface Category {
  id: number
  name: string
  gender: string
  age_min: number
  age_max: number
  // N13: нижняя граница веса (0 = без ограничения, как раньше).
  weight_min: number
  weight_max: number
}

interface CandidateAthlete extends Athlete {
  is_weight_match: boolean
  trainer: string
  club: string
}

export default function CreateTournamentPage() {
  const router = useRouter()
  const { user, loading: authLoading, offline } = useAuth()
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
    weight_min: 0,
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
  const [manualAthleteForm, setManualAthleteForm] =
    useState<AthleteFormState>(EMPTY_ATHLETE_FORM)
  // Поиск + фильтр «только выбранные» + пагинация по кандидатам.
  // Pipeline: full dataset → search → filter → pagination → render.
  // Выбор хранится в selectedAthletes[catId] и переживает страницы/поиск.
  const [candidateQuery, setCandidateQuery] = useState('')
  const [candidatePage, setCandidatePage] = useState(0)
  const [selectedOnly, setSelectedOnly] = useState(false)
  const searchedCandidates = useMemo(() => {
    const base =
      selectedOnly && selectedCategoryId != null
        ? candidates.filter((a) => (selectedAthletes[selectedCategoryId] || []).includes(a.id))
        : candidates
    const q = candidateQuery.trim()
    if (!q) return base
    return base.filter((a) =>
      matchAthleteName(`${a.last_name} ${a.first_name} ${a.club || ''}`, q)
    )
  }, [candidates, candidateQuery, selectedOnly, selectedCategoryId, selectedAthletes])
  const candidatePageCount = pageCountFor(searchedCandidates.length, 20)
  const safeCandidatePage = clampPage(candidatePage, searchedCandidates.length, 20)
  const visibleCandidates = paginateParticipants(searchedCandidates, safeCandidatePage, 20)
  const candidateRange = visibleRange(safeCandidatePage, 20, searchedCandidates.length)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [manualAthleteError, setManualAthleteError] = useState("")
  const [stepError, setStepError] = useState("")
  const todayStr = new Date().toISOString().slice(0, 10)

  // Шаблоны тренера: подставляют место, татами и категории.
  const [templates, setTemplates] = useState<TournamentTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState("")

  useEffect(() => {
    let cancelled = false
    setTemplatesLoading(true)
    api<TournamentTemplate[] | { results: TournamentTemplate[] }>("/api/tournament/templates/")
      .then((data) => {
        if (!cancelled) setTemplates(unwrapList(data))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const applyTemplate = () => {
    const tpl = templates.find((t) => String(t.id) === selectedTemplateId)
    if (!tpl) {
      setStepError("Выберите шаблон из списка")
      return
    }
    const snap = tpl.snapshot
    setInfo((prev) => ({
      ...prev,
      location: snap.location || prev.location,
      mats_count: Number.isFinite(snap.mats_count) && snap.mats_count > 0 ? snap.mats_count : prev.mats_count,
    }))
    const base = Date.now()
    setCategories(
      (snap.categories || []).map((c, i) => ({
        id: base + i,
        name: c.name,
        gender: c.gender,
        age_min: c.age_min,
        age_max: c.age_max,
        // N13: старые шаблоны без weight_min — 0 (прежнее поведение).
        weight_min: Number((c as { weight_min?: unknown }).weight_min) || 0,
        weight_max: Number(c.weight_max) || 0,
      }))
    )
    setStepError("")
  }

  const handleNext = async () => {
    if (step === 'info') {
      if (!info.name || !info.name.trim() || !info.start_date || !info.end_date) {
        setStepError('Пожалуйста, заполните название, дату начала и дату окончания турнира')
        return
      }
      setStepError("")
      setStep('categories')
    }
    else if (step === 'categories') {
      if (categories.length === 0) {
        setStepError('Добавьте хотя бы одну категорию')
        return
      }
      setStepError("")
      setStep('participants')
    }
    else if (step === 'participants') {
      setStepError("")
      setStep('review')
    }
  }

  const handlePrev = () => {
    if (step === 'categories') setStep('info')
    else if (step === 'participants') setStep('categories')
    else if (step === 'review') setStep('participants')
  }

  const addCategory = () => {
    const ageMin = Number(newCategory.age_min)
    const ageMax = Number(newCategory.age_max)
    const weightMin = Number(newCategory.weight_min) || 0
    const weightMax = Number(newCategory.weight_max)
    if (!Number.isFinite(ageMin) || !Number.isFinite(ageMax) || ageMin < 0 || ageMax < 0) {
      setStepError('Укажите корректный возрастной диапазон')
      return
    }
    if (ageMin > ageMax) {
      setStepError('Минимальный возраст не может быть больше максимального')
      return
    }
    if (!Number.isFinite(weightMax) || weightMax <= 0) {
      setStepError('Укажите корректный максимальный вес')
      return
    }
    if (weightMin < 0 || weightMin > weightMax) {
      setStepError('Минимальный вес должен быть в пределах от 0 до максимального')
      return
    }
    setStepError("")
    setCategories([...categories, { ...newCategory, age_min: ageMin, age_max: ageMax, weight_min: weightMin, weight_max: weightMax, id: Date.now() }])
    setNewCategory({
      name: '',
      gender: 'male',
      age_min: 10,
      age_max: 12,
      weight_min: 0,
      weight_max: 45,
    })
  }

  const [removeTarget, setRemoveTarget] = useState<Category | null>(null)

  const removeCategory = (id: number) => {
    setCategories(categories.filter(c => c.id !== id))
    if (selectedCategoryId === id) setSelectedCategoryId(null)
    setRemoveTarget(null)
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
      // N13: нижняя граница — сервер отфильтрует легче минимума.
      if (category.weight_min > 0) {
        params.set("weight_min", category.weight_min.toString())
      }
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

  const pathname = usePathname()
  useEffect(() => {
    if (!authLoading && !user && !offline) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    if (user && user.profile?.role !== "trainer") {
      router.push("/cabinet")
    }
  }, [user, authLoading, offline, router, pathname])

  useEffect(() => {
    const currentCat = categories.find(c => c.id === selectedCategoryId)
    if (currentCat) {
      loadCandidates(currentCat)
    }
  }, [selectedCategoryId, categories, info.start_date])

  // Автовыбор первой категории, чтобы не показывать пустое состояние.
  useEffect(() => {
    if (step === 'participants' && selectedCategoryId === null && categories.length > 0) {
      setSelectedCategoryId(categories[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, categories])

  if (!user || user.profile?.role !== "trainer") return null

  const toggleAthlete = (athleteId: number) => {
    if (!selectedCategoryId) return
    setSelectedAthletes({
      ...selectedAthletes,
      [selectedCategoryId]: toggleSelectedId(
        selectedAthletes[selectedCategoryId] || [],
        athleteId
      ),
    })
  }

  const pickedIds =
    selectedCategoryId != null ? selectedAthletes[selectedCategoryId] || [] : []
  const setPickedIds = (ids: number[]) => {
    if (selectedCategoryId == null) return
    setSelectedAthletes({ ...selectedAthletes, [selectedCategoryId]: ids })
  }
  // Область — всегда явная: страница (видимые id) или весь filtered-сет.
  // Пагинация область не расширяет, выбор между страницами сохраняется.
  const selectCandidatePage = () =>
    setPickedIds(selectScope(pickedIds, visibleCandidates.map((a) => a.id)))
  const deselectCandidatePage = () =>
    setPickedIds(deselectScope(pickedIds, visibleCandidates.map((a) => a.id)))
  const selectFoundCandidates = () =>
    setPickedIds(selectScope(pickedIds, searchedCandidates.map((a) => a.id)))

  // N3+N13: подпись категории в одном месте — автоназвание из диапазонов.
  const catTitle = (cat: Category) => autoCategoryName(cat)

  const handleSaveManualAthlete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSavingAthlete) return
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
      setManualAthleteForm(EMPTY_ATHLETE_FORM)
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
      setStepError('Пожалуйста, заполните название, дату начала и дату окончания турнира')
      return
    }

    if (info.start_date > info.end_date) {
      setStepError('Дата начала не может быть позже даты окончания')
      return
    }

    for (const cat of categories) {
      const picked = selectedAthletes[cat.id] || []
      if (picked.length === 1) {
        setStepError(`В категории «${catTitle(cat)}» только один участник. Добавьте ещё спортсменов или уберите выбор, иначе сетку построить нельзя.`)
        return
      }
    }

    if (isSubmitting) return
    setIsSubmitting(true)
    setStepError("")

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

      const tournamentRes = await api<{ id: number }>("/api/tournament/tournaments/", {
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
        // N13: автоназвание из диапазонов, если имя не задано вручную.
        const categoryName = cat.name?.trim() || autoCategoryName(cat)

        const catRes = await api<{ id: number }>("/api/tournament/categories/", {
          method: "POST",
          body: JSON.stringify({
            tournament: tournamentId,
            name: categoryName,
            age_min: cat.age_min,
            age_max: cat.age_max,
            weight_min: cat.weight_min,
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
      setStepError(apiErrorMessage(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Header */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-blue">
          Конструктор турнира
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-dark-text tracking-tight mt-1.5 dark:text-slate-100">
          Создание турнира
        </h1>
        <p className="text-sm text-secondary-text mt-1.5 max-w-xl">
          Заполните данные по шагам: информация, категории, участники — затем проверьте и запустите турнир.
        </p>
      </div>

      {/* Progress Stepper */}
      <div className="mb-6">
        <div className="h-1.5 rounded-full bg-border overflow-hidden mb-4">
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
            const canJump = idx < currentIdx
            const jump = () => { setStepError(""); setStep(s.id) }
            return (
              <div
                key={s.id}
                role={canJump ? "button" : undefined}
                tabIndex={canJump ? 0 : undefined}
                onClick={canJump ? jump : undefined}
                onKeyDown={canJump ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jump() } } : undefined}
                aria-current={isActive ? 'step' : undefined}
                aria-label={canJump ? `Перейти к шагу: ${s.label}` : undefined}
                className={`flex items-center gap-3 rounded-2xl border p-3 transition-all duration-300 text-left ${canJump ? 'cursor-pointer hover:border-primary-blue/40' : ''} ${
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
                    <div className={`text-[11px] truncate ${isActive ? 'text-white/75' : 'text-secondary-text'}`}>
                    {s.hint}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white dark:bg-[#0E2035] rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-100 dark:border-border flex flex-col">
        {stepError && (
          <div
            role="alert"
            className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
          >
            {stepError}
          </div>
        )}
        {step === 'info' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 bg-dark-blue rounded-xl text-gold shrink-0">
                <Trophy size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-dark-text dark:text-slate-100">Основная информация</h2>
                <p className="text-sm text-secondary-text mt-0.5">Название, даты проведения и место турнира</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-light-gray p-4">
              <label htmlFor="t-template" className="block text-sm font-semibold text-dark-text mb-1.5">
                Начать с шаблона <span className="font-normal text-secondary-text">(подставит место, татами и категории)</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  id="t-template"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  disabled={templatesLoading || templates.length === 0}
                  className="flex-1 p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 focus:ring-2 focus:ring-primary-blue outline-none transition-all dark:text-white text-sm"
                >
                  <option value="">
                    {templatesLoading
                      ? "Загрузка шаблонов..."
                      : templates.length === 0
                        ? "Нет сохранённых шаблонов"
                        : "Выберите шаблон..."}
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.categories_count} кат.)
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="default"
                  className="h-[52px] px-5 text-sm shrink-0"
                  disabled={!selectedTemplateId}
                  onClick={applyTemplate}
                >
                  Применить
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="t-name" className="text-sm font-semibold text-gray-600 dark:text-slate-400">Название турнира</label>
                <input 
                  id="t-name"
                  type="text" 
                  value={info.name}
                  onChange={e => setInfo({...info, name: e.target.value})}
                  placeholder="Например: Кубок Павлодара 2026"
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="t-start-date" className="text-sm font-semibold text-gray-600 dark:text-slate-400">Дата начала *</label>
                <input 
                  id="t-start-date"
                  type="date" 
                  value={info.start_date}
                  onChange={e => setInfo({...info, start_date: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600 dark:text-slate-400">Время начала</label>
                <input 
                  type="time" 
                  value={info.start_time}
                  onChange={e => setInfo({...info, start_time: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="t-end-date" className="text-sm font-semibold text-gray-600 dark:text-slate-400">Дата окончания *</label>
                <input 
                  id="t-end-date"
                  type="date" 
                  value={info.end_date}
                  onChange={e => setInfo({...info, end_date: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600 dark:text-slate-400">Время окончания</label>
                <input 
                  type="time" 
                  value={info.end_time}
                  onChange={e => setInfo({...info, end_time: e.target.value})}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600 dark:text-slate-400">Место проведения</label>
                <input 
                  type="text" 
                  value={info.location}
                  onChange={e => setInfo({...info, location: e.target.value})}
                  placeholder="Спорткомплекс, город..."
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600 dark:text-slate-400">Количество татами</label>
                  <input 
                    type="number" 
                    value={Number.isFinite(info.mats_count) ? info.mats_count : 1}
                    onChange={e => {
                      const v = parseInt(e.target.value, 10)
                      setInfo({ ...info, mats_count: Number.isFinite(v) && v > 0 ? v : 1 })
                    }}
                    min={1}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-semibold text-gray-600 dark:text-slate-400">Описание</label>
                <textarea 
                  value={info.description}
                  onChange={e => setInfo({...info, description: e.target.value})}
                  placeholder="Дополнительная информация о турнире..."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-blue outline-none transition-all dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {step === 'categories' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 bg-dark-blue rounded-xl text-gold shrink-0">
                <Layout size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-dark-text dark:text-slate-100">Настройка категорий</h2>
                <p className="text-sm text-secondary-text mt-0.5">Пол, возраст и весовые ограничения каждой категории</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-300 dark:bg-white/5 dark:border-[#1E3A5F] dark:hover:border-gold/50 transition-colors space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600 dark:text-slate-400">Пол</label>
                  <select 
                    value={newCategory.gender}
                    onChange={e => setNewCategory({...newCategory, gender: e.target.value})}
                    className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 focus:ring-2 focus:ring-primary-blue outline-none transition-all dark:text-white"
                  >
                    <option value="male">Мальчики</option>
                    <option value="female">Девочки</option>
                    <option value="any">Любые</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600 dark:text-slate-400">Возраст (от - до)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={newCategory.age_min}
                      onChange={e => setNewCategory({...newCategory, age_min: parseInt(e.target.value)})}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 outline-none dark:text-white"
                    />
                    <span className="text-gray-400">—</span>
                    <input 
                      type="number" 
                      value={newCategory.age_max}
                      onChange={e => setNewCategory({...newCategory, age_max: parseInt(e.target.value)})}
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 outline-none dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600 dark:text-slate-400">Вес (от – до, кг)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={newCategory.weight_min}
                      onChange={e => setNewCategory({...newCategory, weight_min: parseFloat(e.target.value) || 0})}
                      aria-label="Минимальный вес"
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 outline-none dark:text-white"
                    />
                    <span className="text-gray-400">—</span>
                    <input
                      type="number"
                      value={newCategory.weight_max}
                      onChange={e => setNewCategory({...newCategory, weight_max: parseFloat(e.target.value)})}
                      aria-label="Максимальный вес"
                      className="w-full p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 outline-none dark:text-white"
                    />
                  </div>
                </div>
              </div>
              <p className="text-sm text-secondary-text">
                Название: <span className="font-bold text-dark-text dark:text-slate-100">{autoCategoryName({ ...newCategory, id: "preview" })}</span>
              </p>
              <Button 
                onClick={addCategory}
                className="w-full py-3 rounded-xl bg-primary-blue hover:bg-primary-blue/90 text-white font-bold flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Добавить категорию
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map((cat, idx) => (
                <div key={cat.id} className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] flex items-center justify-between group hover:border-primary-blue transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-sm font-bold text-gray-500 dark:text-slate-300">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-dark-text dark:text-slate-100">
                        {catTitle(cat)}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      const target = categories.find(c => c.id === cat.id) ?? null
                      setRemoveTarget(target)
                    }}
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
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-dark-blue rounded-xl text-gold shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-dark-text dark:text-slate-100">Выбор участников</h2>
                  <p className="text-sm text-secondary-text mt-0.5">Отметьте спортсменов для каждой категории</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-slate-400 font-medium">Категория:</span>
                <select
                  value={selectedCategoryId || ''}
                  onChange={e => { setCandidateQuery(''); setCandidatePage(0); setSelectedOnly(false); setSelectedCategoryId(parseInt(e.target.value)) }}
                  aria-label="Категория для выбора участников"
                  className="p-2 rounded-xl border border-border bg-white text-dark-text outline-none focus:ring-2 focus:ring-primary-blue dark:bg-white/5 dark:text-white"
                >
                  <option value="">-- Выберите категорию --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {catTitle(cat)} ({(selectedAthletes[cat.id] || []).length} уч.)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedCategoryId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 dark:bg-white/5">
                  <Search size={32} />
                </div>
                <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xs">
                  Пожалуйста, выберите категорию сверху, чтобы увидеть подходящих спортсменов из базы данных.
                </p>
              </div>
            ) : isLoadingCandidates ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-primary-blue border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 dark:text-slate-400">Поиск подходящих атлетов...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-dark-text dark:text-slate-100">
                      Подходящие спортсмены ({candidates.length})
                      {pickedIds.length > 0 && (
                        <span className="text-primary-blue">
                          {' '}· Выбрано {pickedIds.length}
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => { setManualAthleteError(""); setIsManualAddModalOpen(true) }}>
                        <UserPlus size={16} />
                        Добавить вручную
                      </Button>
                    </div>
                  </div>
                  <SelectionToolbar
                    found={searchedCandidates.length}
                    selectedCount={pickedIds.length}
                    pageSelected={countSelectedOnPage(pickedIds, visibleCandidates.map((a) => a.id))}
                    pageTotal={visibleCandidates.length}
                    selectedOnly={selectedOnly}
                    onSelectPage={selectCandidatePage}
                    onDeselectPage={deselectCandidatePage}
                    onSelectFound={selectFoundCandidates}
                    onToggleSelectedOnly={() => { setSelectedOnly((v) => !v); setCandidatePage(0) }}
                  />
                  {candidates.length > 0 && (
                    <div className="relative w-full sm:max-w-md">
                      <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-text pointer-events-none"
                      />
                      <label className="sr-only" htmlFor="candidate-search">
                        Поиск спортсмена по фамилии
                      </label>
                      <input
                        id="candidate-search"
                        type="search"
                        value={candidateQuery}
                        onChange={(e) => { setCandidateQuery(e.target.value); setCandidatePage(0) }}
                        placeholder="Найти по фамилии, имени или клубу…"
                        className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all dark:bg-white/5 dark:text-white"
                      />
                    </div>
                  )}
                </div>
                {candidatesError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {candidatesError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  {visibleCandidates.map(athlete => {
                    const isSelected = pickedIds.includes(athlete.id)
                    return (
                      <div
                        key={athlete.id}
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-label={`${athlete.last_name} ${athlete.first_name}`}
                        tabIndex={0}
                        onClick={() => toggleAthlete(athlete.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            toggleAthlete(athlete.id)
                          }
                        }}
                        className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-primary-blue bg-primary-blue/5'
                            : 'border-gray-100 hover:border-gray-200 bg-white dark:border-white/10 dark:hover:border-white/20 dark:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                            isSelected ? 'bg-primary-blue border-primary-blue text-white' : 'border-gray-300'
                          }`} aria-hidden="true">
                            {isSelected && <CheckCircle2 size={14} />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-dark-text truncate dark:text-slate-100">{athlete.last_name} {athlete.first_name}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
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
                    <div className="text-center py-8 text-sm text-gray-400">
                      Спортсмены не найдены. Попробуйте изменить параметры категории.
                    </div>
                  )}
                  {searchedCandidates.length === 0 && candidates.length > 0 && (
                    <div className="text-center py-8 text-sm text-gray-400">
                      {selectedOnly
                        ? "Среди выбранных никого не найдено."
                        : `По запросу «${candidateQuery.trim()}» никого не найдено.`}
                    </div>
                  )}
                  {candidatePageCount > 1 && (
                    <Pager
                      page={safeCandidatePage}
                      pageCount={candidatePageCount}
                      rangeFrom={candidateRange.from}
                      rangeTo={candidateRange.to}
                      total={searchedCandidates.length}
                      onPage={setCandidatePage}
                      label="Страницы спортсменов"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 bg-dark-blue rounded-xl text-gold shrink-0">
                <Trophy size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-dark-text dark:text-slate-100">Проверка и запуск</h2>
                <p className="text-sm text-secondary-text mt-0.5">Убедитесь, что всё заполнено верно, и запускайте турнир</p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-white/[0.04] p-4 rounded-2xl space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-white/10">
                <span className="text-gray-600 dark:text-slate-400">Турнир:</span>
                <span className="font-bold text-dark-text dark:text-slate-100">{info.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-white/10">
                <span className="text-gray-600 dark:text-slate-400">Начало:</span>
                <span className="font-bold text-dark-text dark:text-slate-100">{info.start_date} {info.start_time}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-white/10">
                <span className="text-gray-600 dark:text-slate-400">Окончание:</span>
                <span className="font-bold text-dark-text dark:text-slate-100">{info.end_date} {info.end_time}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-white/10">
                <span className="text-gray-600 dark:text-slate-400">Татами:</span>
                <span className="font-bold text-dark-text dark:text-slate-100">{info.mats_count}</span>
              </div>
              <div className="py-2 border-b border-gray-200 dark:border-white/10">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-slate-400">Категории:</span>
                  <span className="font-bold text-dark-text dark:text-slate-100">{categories.length} шт.</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {categories.map((cat) => {
                    const picked = (selectedAthletes[cat.id] || []).length
                    return (
                      <li key={cat.id} className="flex justify-between gap-3 text-sm">
                        <span className="text-secondary-text truncate">{catTitle(cat)}</span>
                        <span className={`font-bold shrink-0 ${picked < 2 ? 'text-warning' : 'text-dark-text dark:text-slate-100'}`}>
                          {picked} уч.
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-white/10">
                <span className="text-gray-600 dark:text-slate-400">Всего участников:</span>
                <span className="font-bold text-dark-text dark:text-slate-100">
                  {categories.reduce((sum, cat) => sum + (selectedAthletes[cat.id] || []).length, 0)}
                </span>
              </div>
            </div>
            {(() => {
              const overlaps = findCategoryOverlaps(categories)
              if (overlaps.length === 0) return null
              return (
                <div role="alert" className="rounded-2xl border border-warning/40 bg-warning-bg/50 p-4">
                  <p className="text-sm font-bold text-warning mb-1.5">
                    Категории пересекаются — один спортсмен может подойти в несколько:
                  </p>
                  <ul className="space-y-1">
                    {overlaps.map((o) => (
                      <li key={`${o.aId}-${o.bId}`} className="text-sm text-secondary-text">
                        {o.aName} ⇄ {o.bName}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-secondary-text mt-1.5">
                    Это предупреждение, а не запрет: поправьте границы или продолжайте.
                  </p>
                </div>
              )
            })()}
            <div className="text-center text-gray-400 text-sm py-4">
              Пожалуйста, проверьте все данные перед созданием турнира.
            </div>
          </div>
        )}

      </div>

      <AthleteModal
        open={isManualAddModalOpen}
        mode="add"
        form={manualAthleteForm}
        setForm={setManualAthleteForm}
        error={manualAthleteError}
        todayStr={todayStr}
        onClose={() => setIsManualAddModalOpen(false)}
        onSubmit={handleSaveManualAthlete}
      />

      {/* Footer Navigation */}
      <div className="sticky bottom-0 z-10 mt-6 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-white/95 dark:bg-[#0E2035]/95 backdrop-blur border-t border-border rounded-b-2xl">
        <Button
          variant="ghost"
          onClick={handlePrev}
          disabled={step === 'info'}
          className="flex items-center gap-2 text-gray-500 hover:text-dark-blue dark:hover:text-white rounded-xl px-4 sm:px-6 h-11"
        >
          <ChevronLeft size={20} />
          Назад
        </Button>

        <Button
          onClick={step === 'review' ? handleSubmit : handleNext}
          disabled={isSubmitting || (step === 'info' && (!info.name || !info.name.trim() || !info.start_date || !info.end_date))}
          className={`flex items-center gap-2 rounded-xl px-6 sm:px-8 h-11 font-bold transition-all ${
            step === 'review' ? 'bg-success text-white hover:brightness-110 shadow-lg shadow-success/25' : 'bg-dark-blue text-white hover:bg-primary-blue shadow-lg shadow-dark-blue/20 dark:bg-gold dark:text-dark-blue dark:hover:bg-[#D4AF37]'
          }`}
        >
          {isSubmitting ? 'Создание...' : step === 'review' ? 'Запустить турнир' : 'Продолжить'}
          {!isSubmitting && <ChevronRight size={20} />}
        </Button>
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Убрать категорию?"
        description={(() => {
          if (!removeTarget) return undefined
          const picked = selectedAthletes[removeTarget.id] || []
          return picked.length > 0
            ? `Вместе с ней из заявки уйдут выбранные спортсмены (${picked.length}).`
            : "Черновик категории будет удалён."
        })()}
        confirmLabel="Убрать"
        danger
        onConfirm={() => removeTarget && removeCategory(removeTarget.id)}
        onClose={() => setRemoveTarget(null)}
      />
    </div>
  )
}