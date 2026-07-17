import { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { dayStateColor, valenceColor, todayLocal } from '../../lib/foodUtils';
import { useFoodOverview } from '../../hooks/useFoodQueries';

function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Calendario mensile a semaforo: costanza e andamento a colpo d'occhio */
export function MonthCalendar() {
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const { from, to } = monthRange(month);
  const overview = useFoodOverview(from, to);

  const firstWeekday = (new Date(`${from}T12:00:00`).getDay() + 6) % 7; // 0 = Monday

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">Calendario del mese</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-slate-700 capitalize min-w-28 text-center">
            {format(new Date(`${from}T12:00:00`), 'MMMM yyyy', { locale: it })}
          </span>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {overview.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 uppercase mb-1">
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {(overview.data?.days ?? []).map((day) => {
              const workoutColors = valenceColor(day.workoutValence);
              const sleepColors = valenceColor(day.sleepValence);
              return (
                <div
                  key={day.date}
                  className={cn(
                    'rounded-lg p-1 flex flex-col items-center gap-0.5 min-h-12',
                    dayStateColor(day.dayState),
                    day.dayState === null && 'border border-slate-200'
                  )}
                  title={`${day.date} · ${day.mealCount} pasti${
                    day.dayState !== null ? ` · stato ${day.dayState}` : ' · stato n.d.'
                  }`}
                >
                  <span
                    className={cn(
                      'text-[11px] font-medium',
                      day.dayState === null ? 'text-slate-400' : 'text-white'
                    )}
                  >
                    {Number(day.date.slice(8))}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {/* Alimentazione registrata */}
                    {day.hasMeals && <span className="w-1.5 h-1.5 rounded-full bg-white ring-1 ring-slate-300" />}
                    {/* Allenamento (colore = valenza) */}
                    {day.workoutPresent && (
                      <span className={cn('w-1.5 h-1.5 rounded-sm', workoutColors.dot)} />
                    )}
                    {/* Sonno (colore = valenza) */}
                    {day.sleepValence && (
                      <span className={cn('w-1.5 h-1.5 rounded-full', sleepColors.dot)} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-400" /> giornata positiva
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-300" /> neutra
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-red-400" /> negativa
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white ring-1 ring-slate-300" /> pasti registrati
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-slate-400" /> allenamento
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" /> sonno
            </span>
          </div>
        </>
      )}
    </div>
  );
}
