"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { Plus, ChevronRight, ChevronLeft, Trophy, Layout, Users, Search, CheckCircle2, XCircle, UserPlus } from 'lucide-react'
import { api } from '@/lib/api'
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

export default function TournamentConstructor() {
  const router = useRouter()
  const [step, setStep] = useState<TournamentStep>('info')
  
  // Tournament Basic Info
  const [info, setInfo] = useState({
    name: '',
    start_date: '',
    end_date: '',
    location: '',
    description: '',
    mats_count: 1,
    start_time: '',
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

  const handleNext = async () => {
    if (step === 'info') {
      if (!info.name || !info.name.trim() || !info.start_date) {
        return alert('Пожалуйста, заполните название и дату проведения турнира')
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
    setCategories([...categories, { ...newCategory, id: Date.now() }])
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

  const loadCandidates = async (categoryId: number) => {
    setIsLoadingCandidates(true)
    try {
      // NOTE: For this MVP, if categoryId is a local ID from wizard, 
      // we would normally call a search endpoint with the category's params.
      // Here we call the API assuming categories are pre-saved or using a search proxy.
      const res = await api<CandidateAthlete[]>(`/api/tournament/categories/${categoryId}/candidates/`)
      setCandidates(res)
    } catch (e) {
      console.error("Failed to load candidates", e)
    } finally {
      setIsLoadingCandidates(false)
    }
  }

  useEffect(() => {
    if (selectedCategoryId) {
      loadCandidates(selectedCategoryId)
    }
  }, [selectedCategoryId])

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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Progress Stepper */}
      <div className="flex items-center justify-between mb-12 relative">
        <div className="absolute top-5 left-0 w-full h-1 bg-gray-200 -translate-y-1/2" aria-hidden="true" />
        {['Основная информация', 'Категории', 'Участники', 'Проверка'].map((label, idx) => {
          const currentStep = ['info', 'categories', 'participants', 'review'][idx] as TournamentStep
          const isCompleted = step === 'review' || (idx < (step === 'info' ? 0 : step === 'categories' ? 1 : step === 'participants' ? 2 : 3))
          const isActive = step === currentStep
          
          return (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                isActive ? 'bg-primary-blue text-white scale-110 shadow-lg' : 
                isCompleted ? 'bg-green-500 text-white' : 'bg-white text-gray-400 border-2 border-gray-200'
              }`}>
                {isCompleted ? '✓' : idx + 1}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-primary-blue' : 'text-gray-500'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 min-h-[500px] flex flex-col">
        {step === 'info' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary-blue/10 rounded-2xl text-primary-blue">
                <Trophy size={24} />
              </div>
              <h2 className="text-2xl font-bold text-dark-blue">Создание турнира</h2>
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
                <label className="text-sm font-semibold text-gray-600">Дата проведения</label>
                <input 
                  type="date" 
                  value={info.start_date}
                  onChange={e => setInfo({...info, start_date: e.target.value})}
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
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary-blue/10 rounded-2xl text-primary-blue">
                <Layout size={24} />
              </div>
              <h2 className="text-2xl font-bold text-dark-blue">Настройка категорий</h2>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300 space-y-4">
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
                      <p className="font-bold text-dark-blue">
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
                <div className="p-3 bg-primary-blue/10 rounded-2xl text-primary-blue">
                  <Users size={24} />
                </div>
                <h2 className="text-2xl font-bold text-dark-blue">Выбор участников</h2>
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
                  <h3 className="text-lg font-bold text-dark-blue">
                    Подходящие спортсмены ({candidates.length})
                  </h3>
                  <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                    <UserPlus size={16} />
                    Добавить вручную
                  </Button>
                </div>

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
                            <p className="font-bold text-dark-blue">{athlete.last_name} {athlete.first_name}</p>
                            <p className="text-xs text-gray-500">
                              {athlete.age} лет • {athlete.weight} кг • {athlete.club || 'Клуб не указан'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {athlete.is_weight_match ? (
                            <div className="flex items-center gap-1 text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-lg">
                              <CheckCircle2 size={12} />
                              Подходит по весу
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-red-600 text-xs font-medium bg-red-50 px-2 py-1 rounded-lg">
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
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary-blue/10 rounded-2xl text-primary-blue">
                <Trophy size={24} />
              </div>
              <h2 className="text-2xl font-bold text-dark-blue">Проверка и запуск</h2>
            </div>
            <div className="bg-gray-50 p-6 rounded-2xl space-y-4">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Турнир:</span>
                <span className="font-bold text-dark-blue">{info.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Дата:</span>
                <span className="font-bold text-dark-blue">{info.start_date}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Татами:</span>
                <span className="font-bold text-dark-blue">{info.mats_count}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Категории:</span>
                <span className="font-bold text-dark-blue">{categories.length} шт.</span>
              </div>
            </div>
            <div className="text-center text-gray-400 text-sm py-4">
              Пожалуйста, проверьте все данные перед созданием турнира.
            </div>
          </div>
        )}
      </div>

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
          onClick={step === 'review' ? handleNext : handleNext} 
          disabled={step === 'review' || (step === 'info' && (!info.name || !info.name.trim() || !info.start_date))}
          className={`flex items-center gap-2 rounded-xl px-8 h-11 font-bold transition-all ${
            step === 'review' ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-primary-blue text-white hover:bg-primary-blue/90'
          }`}
        >
          {step === 'review' ? 'Запустить турнир' : 'Продолжить'}
          <ChevronRight size={20} />
        </Button>
      </div>
    </div>
  )
}
