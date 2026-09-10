"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Users, Trophy, LayoutDashboard, Search, ChevronRight, Filter, CheckCircle2 } from 'lucide-react';

type TournamentStatus = 'draft' | 'published' | 'finished';
type View = 'categories' | 'bracket' | 'queue';

interface Athlete {
  id: number;
  first_name: string;
  last_name: string;
  age: number;
  weight: number;
  club: string;
  trainer: string;
}

interface Category {
  id: number;
  name: string;
  gender: 'male' | 'female';
  age_min: number;
  age_max: number;
  weight_max: number;
  athletes: Athlete[];
}

export default function TournamentDashboard() {
  const [view, setView] = useState<View>('categories');
  const [selectedTournament, setSelectedTournament] = useState<{ id: number; name: string; status: TournamentStatus } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] p-4 md:p-8">
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Управление Турниром</h1>
          <p className="text-slate-500">Профессиональный конструктор олимпийских сеток</p>
        </div>
        <Button onClick={() => alert('Create Tournament Modal')} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
          <Plus size={18} /> Создать турнир
        </Button>
      </header>

      <main className="max-w-7xl mx-auto">
        {selectedTournament ? (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                  <Trophy size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedTournament.name}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    selectedTournament.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedTournament.status === 'published' ? 'Опубликован' : 'Черновик'}
                  </span>
                </div>
              </div>
              
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <Button 
                  variant={view === 'categories' ? 'default' : 'ghost'} 
                  onClick={() => setView('categories')} 
                  className={`gap-2 ${view === 'categories' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600'}`}
                >
                  <Users size={18} /> Категории
                </Button>
                <Button 
                  variant={view === 'bracket' ? 'default' : 'ghost'} 
                  onClick={() => setView('bracket')} 
                  className={`gap-2 ${view === 'bracket' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600'}`}
                >
                  <Trophy size={18} /> Сетка
                </Button>
                <Button 
                  variant={view === 'queue' ? 'default' : 'ghost'} 
                  onClick={() => setView('queue')} 
                  className={`gap-2 ${view === 'queue' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600'}`}
                >
                  <LayoutDashboard size={18} /> Очередь
                </Button>
              </div>
            </div>

            {view === 'categories' && <CategoryBuilder categories={categories} setCategories={setCategories} />}
            {view === 'bracket' && <div className="h-[600px] flex items-center justify-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">Интерактивная сетка в разработке...</div>}
            {view === 'queue' && <div className="h-[600px] flex items-center justify-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">Панель татами в разработке...</div>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Demo Tournament Card */}
            <div 
              onClick={() => setSelectedTournament({ id: 1, name: 'Кубок Павлодара 2026', status: 'draft' })}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Trophy size={24} />
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Черновик</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Кубок Павлодара 2026</h3>
              <p className="text-sm text-slate-500 mb-4">31 августа, 2026 • 4 татами</p>
              <div className="flex items-center text-indigo-600 text-sm font-medium gap-1 group-hover:gap-2 transition-all">
                Открыть конструктор <ChevronRight size={16} />
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-slate-400 hover:border-indigo-300 transition-colors cursor-pointer group">
              <div className="p-3 bg-slate-100 rounded-full mb-3 group-hover:bg-indigo-50 transition-colors">
                <Plus size={24} />
              </div>
              <p className="font-medium">Создать новый турнир</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CategoryBuilder({ categories, setCategories }: { categories: Category[], setCategories: React.Dispatch<React.SetStateAction<Category[]>> }) {
  const [filter, setFilter] = useState({ gender: '', ageRange: '', weight: '' });
  const [search, setSearch] = useState('');

  const mockAthletes: Athlete[] = [
    { id: 1, first_name: 'Иван', last_name: 'Иванов', age: 11, weight: 34.2, club: 'Кёкушинкай', trainer: 'Алексей С.' },
    { id: 2, first_name: 'Артём', last_name: 'Петров', age: 10, weight: 33.8, club: 'Спорт-Сити', trainer: 'Дмитрий В.' },
    { id: 3, first_name: 'Данияр', last_name: 'Сериков', age: 11, weight: 35.0, club: 'Кёкушинкай', trainer: 'Алексей С.' },
    { id: 4, first_name: 'Али', last_name: 'Мурат', age: 10, weight: 32.1, club: 'Астана', trainer: 'Сергей К.' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <Filter size={20} className="text-slate-400" />
            <h3 className="text-lg font-bold text-slate-900">Подбор участников</h3>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Пол</label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={filter.gender === 'male' ? 'default' : 'outline'} 
                  className={filter.gender === 'male' ? 'bg-indigo-600' : ''}
                  onClick={() => setFilter({...filter, gender: 'male'})}
                >Мальчики</Button>
                <Button 
                  variant={filter.gender === 'female' ? 'default' : 'outline'} 
                  className={filter.gender === 'female' ? 'bg-indigo-600' : ''}
                  onClick={() => setFilter({...filter, gender: 'female'})}
                >Девочки</Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Возрастная группа</label>
              <select 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={filter.ageRange}
                onChange={(e) => setFilter({...filter, ageRange: e.target.value})}
              >
                <option value="">Все возрасты</option>
                <option value="6-7">6–7 лет</option>
                <option value="8-9">8–9 лет</option>
                <option value="10-11">10–11 лет</option>
                <option value="12-13">12–13 лет</option>
                <option value="14-15">14–15 лет</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Весовая категория (до кг)</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="Напр. 35"
                  className="w-full p-2.5 pl-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={filter.weight}
                  onChange={(e) => setFilter({...filter, weight: e.target.value})}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">кг</span>
              </div>
            </div>

            <Button className="w-full py-6 text-md font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all active:scale-95" disabled={!filter.gender}>
              <Users size={20} /> Найти подходящих детей
            </Button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Список категорий</h3>
          <div className="space-y-3">
            {categories.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Категории еще не созданы</p>
            )}
            {categories.map(cat => (
              <div key={cat.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center group">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{cat.name}</p>
                  <p className="text-xs text-slate-500">{cat.athletes.length} участника</p>
                </div>
                <Button size="sm" variant="ghost" className="text-slate-500 hover:text-red-600">
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h3 className="text-lg font-bold text-slate-900">Результаты подбора</h3>
            <div className="relative w-full md:w-64">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Поиск ребенка..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockAthletes
              .filter(a => a.first_name.toLowerCase().includes(search.toLowerCase()) || a.last_name.toLowerCase().includes(search.toLowerCase()))
              .map(athlete => (
              <div key={athlete.id} className="p-4 border border-slate-200 rounded-2xl flex justify-between items-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-slate-400 font-bold">
                    {athlete.first_name[0]}{athlete.last_name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{athlete.last_name} {athlete.first_name}</p>
                    <div className="flex gap-2 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">📅 {athlete.age} лет</span>
                      <span className="flex items-center gap-1">⚖️ {athlete.weight} кг</span>
                      <span className="flex items-center gap-1">🥋 {athlete.club}</span>
                    </div>
                  </div>
                </div>
                <Button size="sm" className="gap-2 bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all">
                  <Plus size={16} /> Добавить
                </Button>
              </div>
            ))}
          </div>
          
          {mockAthletes.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <Users size={48} className="mx-auto mb-4 opacity-20" />
              <p>По заданным параметрам дети не найдены</p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button className="py-6 px-8 text-lg font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg transition-all active:scale-95">
            <CheckCircle2 size={20} /> Сформировать сетку
          </Button>
        </div>
      </div>
    </div>
  );
}
