"use client"

import { Trophy } from 'lucide-react'
import { findCategoryOverlaps } from '@/lib/categoryUtils'
import type { CategoryDraft, PublishMode, TournamentInfoState } from './wizardTypes'

interface Props {
  info: TournamentInfoState
  categories: CategoryDraft[]
  selectedAthletes: Record<number, number[]>
  publishMode: PublishMode
  onPublishModeChange: (mode: PublishMode) => void
  catTitle: (cat: CategoryDraft) => string
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function StepReview({ info, categories, selectedAthletes, publishMode, onPublishModeChange, catTitle }: Props) {
  const totalAthletes = categories.reduce((sum, cat) => sum + (selectedAthletes[cat.id] || []).length, 0)
  const overlaps = findCategoryOverlaps(categories)

  return (
    <div className="space-y-6">
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
        <div className="flex justify-between gap-4 py-2 border-b border-gray-200">
          <span className="text-gray-600 shrink-0">Турнир:</span>
          <span className="font-bold text-dark-text text-right truncate">{info.name || '—'}</span>
        </div>
        <div className="flex justify-between gap-4 py-2 border-b border-gray-200">
          <span className="text-gray-600 shrink-0">Начало:</span>
          <span className="font-bold text-dark-text kwf-numeric">{fmtDate(info.start_date)}{info.start_time ? ` · ${info.start_time}` : ''}</span>
        </div>
        <div className="flex justify-between gap-4 py-2 border-b border-gray-200">
          <span className="text-gray-600 shrink-0">Окончание:</span>
          <span className="font-bold text-dark-text kwf-numeric">{fmtDate(info.end_date)}{info.end_time ? ` · ${info.end_time}` : ''}</span>
        </div>
        {info.location && (
          <div className="flex justify-between gap-4 py-2 border-b border-gray-200">
            <span className="text-gray-600 shrink-0">Место:</span>
            <span className="font-bold text-dark-text text-right truncate">{info.location}</span>
          </div>
        )}
        <div className="flex justify-between gap-4 py-2 border-b border-gray-200">
          <span className="text-gray-600 shrink-0">Татами:</span>
          <span className="font-bold text-dark-text kwf-numeric">{info.mats_count}</span>
        </div>
        <div className="py-2 border-b border-gray-200">
          <div className="flex justify-between">
            <span className="text-gray-600">Категории:</span>
            <span className="font-bold text-dark-text kwf-numeric">{categories.length} шт.</span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {categories.map((cat) => {
              const picked = (selectedAthletes[cat.id] || []).length
              return (
                <li key={cat.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-secondary-text truncate">{catTitle(cat)}</span>
                  <span className={`font-bold shrink-0 kwf-numeric ${picked < 2 ? 'text-warning' : 'text-dark-text'}`}>
                    {picked} уч.
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="flex justify-between py-2 border-b border-gray-200">
          <span className="text-gray-600">Всего участников:</span>
          <span className="font-bold text-dark-text kwf-numeric">
            {totalAthletes}
          </span>
        </div>
      </div>

      {overlaps.length > 0 && (
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
      )}

      <fieldset className="rounded-2xl border border-border p-4">
        <legend className="px-2 text-sm font-bold text-dark-text">Публикация после создания</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors min-h-[44px] ${publishMode === 'draft' ? 'border-primary-blue bg-primary-blue/5' : 'border-border hover:border-primary-blue/40'}`}>
            <input
              type="radio"
              name="publish-mode"
              value="draft"
              checked={publishMode === 'draft'}
              onChange={() => onPublishModeChange('draft')}
              className="mt-1 accent-[#17488F]"
            />
            <span>
              <span className="block text-sm font-bold text-dark-text">Черновик</span>
              <span className="block text-xs text-secondary-text mt-0.5">Виден только вам. Опубликуете позже из кабинета.</span>
            </span>
          </label>
          <label className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors min-h-[44px] ${publishMode === 'published' ? 'border-primary-blue bg-primary-blue/5' : 'border-border hover:border-primary-blue/40'}`}>
            <input
              type="radio"
              name="publish-mode"
              value="published"
              checked={publishMode === 'published'}
              onChange={() => onPublishModeChange('published')}
              className="mt-1 accent-[#17488F]"
            />
            <span>
              <span className="block text-sm font-bold text-dark-text">Сразу опубликовать</span>
              <span className="block text-xs text-secondary-text mt-0.5">Турнир появится в общем списке и live-ленте.</span>
            </span>
          </label>
        </div>
      </fieldset>

      <p className="text-center text-gray-400 text-sm">
        Пожалуйста, проверьте все данные перед созданием турнира.
      </p>
    </div>
  )
}
