"use client"

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Calendar, MapPin } from 'lucide-react';
import OlympicBracket from '@/components/OlympicBracket';

export default function PublicTournamentView() {
  // In real app, these would come from API based on slug in URL
  const tournament = {
    name: 'Кубок Павлодара 2026',
    date: '31 августа 2026',
    location: 'Спортивный комплекс "Каратэ", Павлодар',
    status: 'published',
    categories: [
      { id: 1, name: 'Мальчики 10-11 лет, до 35 кг' },
      { id: 2, name: 'Девочки 10-11 лет, до 30 кг' },
    ]
  };

  const [selectedCategory, setSelectedCategory] = useState(tournament.categories[0]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Tournament Header */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-amber-100 text-amber-600 rounded-2xl">
              <Trophy size={40} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">{tournament.name}</h1>
              <div className="flex flex-wrap gap-4 mt-2 text-slate-500 font-medium">
                <div className="flex items-center gap-1">
                  <Calendar size={16} /> {tournament.date}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin size={16} /> {tournament.location}
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-bold uppercase tracking-wider">
            Турнир идет
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Category Selector */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 px-2">Категории</h3>
            <div className="flex flex-col gap-2">
              {tournament.categories.map(cat => (
                <Button 
                  key={cat.id}
                  variant={selectedCategory?.id === cat.id ? 'default' : 'outline'}
                  className={`text-left justify-start h-auto py-3 px-4 rounded-xl transition-all ${
                    selectedCategory?.id === cat.id ? 'bg-indigo-600 shadow-md' : 'bg-white'
                  }`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Bracket View */}
          <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-200 p-2 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">
                Сетка: {selectedCategory?.name}
              </h2>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Users size={16} /> Обновляется в реальном времени
              </div>
            </div>
            <div className="p-4 overflow-x-auto">
              <OlympicBracket categoryName={selectedCategory?.name || ''} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
