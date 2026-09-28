"use client"

import { CheckCircle2, Search, UserPlus, Users, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CategoryDraft } from './wizardTypes'

export interface ParticipantCandidate {
  id: number
  first_name: string
  last_name: string
  age: number
  weight: string | number
  club: string
  is_weight_match: boolean
}

interface Props {
  categories: CategoryDraft[]
  selectedCategoryId: number | null
  onSelectCategory: (id: number | null) => void
  candidates: ParticipantCandidate[]
  visibleCandidates: ParticipantCandidate[]
  candidateQuery: string
  onQueryChange: (q: string) => void
  isLoadingCandidates: boolean
  candidatesError: string
  selectedAthletes: Record<number, number[]>
  onToggleAthlete: (athleteId: number) => void
  onSelectAllVisible: (ids: number[]) => void
  onClearSelection: () => void
  onAddManual: () => void
  catTitle: (cat: CategoryDraft) => string
}

export function StepParticipants({
  categories,
  selectedCategoryId,
  onSelectCategory,
  candidates,
  visibleCandidates,
  candidateQuery,
  onQueryChange,
  isLoadingCandidates,
  candidatesError,
  selectedAthletes,
  onToggleAthlete,
  onSelectAllVisible,
  onClearSelection,
  onAddManual,
  catTitle,
}: Props) {
  const picked = selectedCategoryId ? (selectedAthletes[selectedCategoryId] || []) : []
  const allVisiblePicked = candidates.length > 0 && picked.length === candidates.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
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
          <label htmlFor="p-category" className="text-sm text-gray-500 font-medium">Выберите категорию:</label>
          <select
            id="p-category"
            value={selectedCategoryId || ''}
            onChange={(e) => { onQueryChange(''); onSelectCategory(e.target.value ? parseInt(e.target.value) : null) }}
            className="p-2 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-primary-blue min-h-[44px]"
          >
            <option value="">-- Выберите категорию --</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {catTitle(cat)} ({(selectedAthletes[cat.id] || []).length} уч.)
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
          <div className="w-10 h-10 border-4 border-primary-blue border-t-transparent rounded-full animate-spin" role="status" aria-label="Поиск атлетов" />
          <p className="text-gray-500">Поиск подходящих атлетов...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-dark-text">
                Подходящие спортсмены ({candidates.length})
                {picked.length > 0 && (
                  <span className="text-primary-blue">
                    {' '}· Выбрано {picked.length}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {candidates.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl min-h-[44px]"
                    onClick={() => {
                      if (allVisiblePicked) onClearSelection()
                      else onSelectAllVisible(candidates.map((c) => c.id))
                    }}
                  >
                    {allVisiblePicked ? 'Снять выбор' : 'Выбрать всех'}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-2 rounded-xl min-h-[44px]" onClick={onAddManual}>
                  <UserPlus size={16} />
                  Добавить вручную
                </Button>
              </div>
            </div>
            {candidates.length > 0 && (
              <div className="relative max-w-md">
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
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="Найти по фамилии, имени или клубу…"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-white text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue/30 focus:border-primary-blue transition-all"
                />
              </div>
            )}
          </div>
          {candidatesError && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {candidatesError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            {visibleCandidates.map((athlete) => {
              const isSelected = picked.includes(athlete.id)
              return (
                <div
                  key={athlete.id}
                  onClick={() => onToggleAthlete(athlete.id)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-primary-blue bg-primary-blue/5'
                      : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                      isSelected ? 'bg-primary-blue border-primary-blue text-white' : 'border-gray-300'
                    }`}>
                      {isSelected && <CheckCircle2 size={14} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-dark-text truncate">{athlete.last_name} {athlete.first_name}</p>
                      <p className="text-xs text-gray-500">
                        {athlete.age} лет • {athlete.weight} кг • {athlete.club || 'Клуб не указан'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
            {candidates.length > 0 && visibleCandidates.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                По запросу «{candidateQuery.trim()}» никого не найдено.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
