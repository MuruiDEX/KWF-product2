"use client"

import type { TournamentStep } from './wizardTypes'

const STEPS: { id: TournamentStep; label: string; hint: string }[] = [
  { id: 'info', label: 'Основное', hint: 'Даты и место' },
  { id: 'categories', label: 'Категории', hint: 'Возраст и вес' },
  { id: 'participants', label: 'Участники', hint: 'Состав' },
  { id: 'review', label: 'Проверка', hint: 'Запуск' },
]

const ORDER: TournamentStep[] = ['info', 'categories', 'participants', 'review']

export function WizardStepper({
  step,
  onJump,
}: {
  step: TournamentStep
  onJump: (s: TournamentStep) => void
}) {
  const currentIdx = ORDER.indexOf(step)
  return (
    <div className="mb-10">
      <div
        className="h-1.5 rounded-full bg-border overflow-hidden mb-6"
        role="progressbar"
        aria-valuenow={currentIdx + 1}
        aria-valuemin={1}
        aria-valuemax={4}
        aria-label="Прогресс создания турнира"
      >
        <div
          className="h-full rounded-full bg-primary-blue transition-all duration-500"
          style={{ width: `${((currentIdx) + 1) * 25}%` }}
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STEPS.map((s, idx) => {
          const isCompleted = idx < currentIdx || step === 'review'
          const isActive = step === s.id
          const canJump = idx < currentIdx
          const jump = () => onJump(s.id)
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
  )
}
