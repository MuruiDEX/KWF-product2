"use client"

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, ChevronRight, User, Award } from 'lucide-react';

interface Athlete {
  id: number;
  name: string;
}

interface Match {
  id: number;
  athlete1: Athlete | null;
  athlete2: Athlete | null;
  winner: Athlete | null;
  nextMatchId: number | null;
  previousMatch1?: number | null;
  previousMatch2?: number | null;
  round: number;
}

export default function OlympicBracket({ categoryName }: { categoryName: string }) {
  const [matches, setMatches] = useState<Match[]>([
    // Round 1
    { id: 1, athlete1: { id: 1, name: 'Иван Иванов' }, athlete2: { id: 2, name: 'Артём Петров' }, winner: null, nextMatchId: 5, round: 1 },
    { id: 2, athlete1: { id: 3, name: 'Данияр Сериков' }, athlete2: { id: 4, name: 'Али Мурат' }, winner: null, nextMatchId: 5, round: 1 },
    { id: 3, athlete1: { id: 5, name: 'Максим С.' }, athlete2: { id: 6, name: 'Кирилл В.' }, winner: null, nextMatchId: 6, round: 1 },
    { id: 4, athlete1: { id: 7, name: 'Олег Н.' }, athlete2: { id: 8, name: 'Никита К.' }, winner: null, nextMatchId: 6, round: 1 },
    // Round 2 (Semi-finals)
    { id: 5, athlete1: null, athlete2: null, winner: null, nextMatchId: 7, round: 2 },
    { id: 6, athlete1: null, athlete2: null, winner: null, nextMatchId: 7, round: 2 },
    // Round 3 (Final)
    { id: 7, athlete1: null, athlete2: null, winner: null, nextMatchId: null, round: 3 },
  ]);

  const handleWinner = (matchId: number, winnerId: number) => {
    const winnerAthlete = matches.find(m => 
      (m.id === matchId && m.athlete1?.id === winnerId) || 
      (m.id === matchId && m.athlete2?.id === winnerId)
    );
    
    if (!winnerAthlete) return;
    const actualWinner = winnerAthlete.athlete1?.id === winnerId ? winnerAthlete.athlete1 : winnerAthlete.athlete2;

    setMatches(prev => {
      const newMatches = prev.map(m => {
        if (m.id === matchId) {
          return { ...m, winner: actualWinner };
        }
        // Promote winner to next match
        const currentMatch = prev.find(mat => mat.id === matchId);
        if (currentMatch?.nextMatchId === m.id) {
          // Simple logic: first winner goes to athlete1, second to athlete2
          const isFirstPredecessor = currentMatch.id === m.previousMatch1; // This is simplified
          // In a real app, we'd use the previousMatch1/2 IDs from the backend
          return { ...m, athlete1: m.athlete1 || actualWinner };
        }
        return m;
      });
      return newMatches;
    });
  };

  return (
    <div className="flex flex-col items-center p-8 bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <div className="flex items-center gap-3 mb-12">
        <Trophy className="text-amber-500" size={28} />
        <h2 className="text-2xl font-bold text-slate-900">{categoryName}</h2>
      </div>

      <div className="flex gap-16 items-center min-w-max">
        {/* Render rounds */}
        {[1, 2, 3].map(roundNum => (
          <div key={roundNum} className="flex flex-col justify-around gap-8 h-full">
            <div className="text-center mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {roundNum === 1 ? '1/4 Финала' : roundNum === 2 ? '1/2 Финала' : 'Финал'}
              </span>
            </div>
            <div className="flex flex-col justify-around gap-12">
              {matches.filter(m => m.round === roundNum).map(match => (
                <MatchNode key={match.id} match={match} onWinner={handleWinner} />
              ))}
            </div>
          </div>
        ))}
        
        {/* Champion */}
        <div className="flex flex-col items-center ml-12">
          <div className="text-center mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Чемпион</span>
          </div>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-yellow-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-white border-2 border-amber-500 p-6 rounded-full shadow-xl flex items-center justify-center w-24 h-24 text-center">
              {matches.find(m => m.round === 3)?.winner ? (
                <span className="text-sm font-bold text-slate-900 leading-tight">
                  {matches.find(m => m.round === 3)?.winner?.name}
                </span>
              ) : (
                <Award className="text-amber-500" size={32} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchNode({ match, onWinner }: { match: Match, onWinner: (mId: number, wId: number) => void }) {
  return (
    <div className="relative flex flex-col gap-1 w-48">
      {/* Athlete 1 */}
      <div className="flex items-center group">
        <div 
          onClick={() => match.athlete1 && onWinner(match.id, match.athlete1.id)}
          className={`flex-1 p-2 px-3 rounded-l-xl border transition-all cursor-pointer flex justify-between items-center ${
            match.winner?.id === match.athlete1?.id 
              ? 'bg-indigo-600 text-white border-indigo-600 font-bold' 
              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <User size={14} className={match.winner?.id === match.athlete1?.id ? 'text-white' : 'text-slate-400'} />
            <span className="text-xs truncate">{match.athlete1?.name || 'Ожидание...'}</span>
          </div>
          {match.winner?.id === match.athlete1?.id && <CheckCircleIcon />}
        </div>
        <div className="w-1 h-8 bg-slate-200 rounded-r-xl" />
      </div>

      {/* Athlete 2 */}
      <div className="flex items-center group">
        <div 
          onClick={() => match.athlete2 && onWinner(match.id, match.athlete2.id)}
          className={`flex-1 p-2 px-3 rounded-l-xl border transition-all cursor-pointer flex justify-between items-center ${
            match.winner?.id === match.athlete2?.id 
              ? 'bg-indigo-600 text-white border-indigo-600 font-bold' 
              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <User size={14} className={match.winner?.id === match.athlete2?.id ? 'text-white' : 'text-slate-400'} />
            <span className="text-xs truncate">{match.athlete2?.name || 'Ожидание...'}</span>
          </div>
          {match.winner?.id === match.athlete2?.id && <CheckCircleIcon />}
        </div>
        <div className="w-1 h-8 bg-slate-200 rounded-r-xl" />
      </div>

      {/* Connector Line to next match */}
      {match.nextMatchId && (
        <div className="absolute -right-8 top-1/2 w-8 h-px bg-slate-300" />
      )}
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
