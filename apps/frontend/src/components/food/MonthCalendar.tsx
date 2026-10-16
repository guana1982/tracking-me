import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { dayStateColor, moodStateColor, valenceColor, todayLocal } from '../../lib/foodUtils';
import { useFoodOverview } from '../../hooks/useFoodQueries';
import { TrackToggle, type FoodTrack } from './TrackToggle';

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

interface MonthCalendarProps {
  track: FoodTrack;
  onTrackChange: (track: FoodTrack) => void;
}

/** Calendario mensile a semaforo: costanza e andamento a colpo d'occhio */
export function MonthCalendar({ track, onTrackChange }: MonthCalendarProps) {
  const navigate = useNavigate();
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const { from, to } = monthRange(month);
  const overview = useFoodOverview(from, to);

  const firstWeekday = (new Date(`${from}T12:00:00`).getDay() + 6) % 7; // 0 = Monday
  const showBody = track === 'BOTH' || track === 'BODY';
  const showMood = track === 'BOTH' || track === 'MOOD';

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-900">Calendario del mese</h3>
        <TrackToggle value={track} onChange={onTrackChange} />
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
              // In "Entrambi" the cell is split in two bands (top = fisico,
              // bottom = umore); filtered views fill the whole cell
              const hasColor =
                (showBody && day.dayState !== null) || (showMood && day.moodState !== null);
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => navigate(`/food?date=${day.date}`)}
                  aria-label={`Apri il diario del ${day.date}`}
                  className={cn(
                    'relative overflow-hidden rounded-lg p-1 flex flex-col items-center gap-0.5 min-h-12',
                    'transition-shadow hover:ring-2 hover:ring-sky-400 hover:ring-offset-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                    !hasColor && 'bg-slate-100 border border-slate-200'
                  )}
                  title={[
                    day.date,
                    `${day.mealCount} pasti`,
                    showBody
                      ? `fisico ${day.dayState !== null ? day.dayState : 'n.d.'}`
                      : null,
                    showMood
                      ? `umore ${day.moodState !== null ? day.moodState : 'n.d.'}`
                      : null,
                    'apri il giorno',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  {/* Color bands */}
                  {track === 'BOTH' ? (
                    <>
                      <span
                        className={cn(
                          'absolute inset-x-0 top-0 h-1/2',
                          dayStateColor(day.dayState)
                        )}
                      />
                      <span
                        className={cn(
                          'absolute inset-x-0 bottom-0 h-1/2',
                          moodStateColor(day.moodState)
                        )}
                      />
                    </>
                  ) : (
                    <span
                      className={cn(
                        'absolute inset-0',
                        track === 'BODY'
                          ? dayStateColor(day.dayState)
                          : moodStateColor(day.moodState)
                      )}
                    />
                  )}

                  <span
                    className={cn(
                      'relative text-[11px] font-semibold',
                      hasColor ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]' : 'text-slate-400'
                    )}
                  >
                    {Number(day.date.slice(8))}
                  </span>
                  <div className="relative flex items-center gap-0.5">
                    {/* Alimentazione registrata */}
                    {day.hasMeals && <span className="w-1.5 h-1.5 rounded-full bg-white ring-1 ring-slate-300" />}
                    {/* Allenamento (colore = valenza) */}
                    {showBody && day.workoutPresent && (
                      <span className={cn('w-1.5 h-1.5 rounded-sm ring-1 ring-white/60', workoutColors.dot)} />
                    )}
                    {/* Sonno (colore = valenza) */}
                    {showBody && day.sleepValence && (
                      <span className={cn('w-1.5 h-1.5 rounded-full ring-1 ring-white/60', sleepColors.dot)} />
                    )}
                    {/* Umore registrato */}
                    {showMood && day.moodCount > 0 && (
                      <span className="w-1.5 h-1.5 rotate-45 bg-white ring-1 ring-fuchsia-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Clicca un giorno per aprirlo nel diario.</p>
          {track === 'BOTH' && (
            <p className="mt-3 text-[11px] text-slate-400">
              Ogni giorno è diviso in due: <strong className="font-medium text-slate-500">sopra</strong> la
              condizione fisica, <strong className="font-medium text-slate-500">sotto</strong> l'umore.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            {showBody && (
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-slate-600">Fisico:</span>
                <span className="w-2.5 h-2.5 rounded bg-emerald-400" /> positivo
                <span className="w-2.5 h-2.5 rounded bg-amber-300" /> neutro
                <span className="w-2.5 h-2.5 rounded bg-red-400" /> negativo
              </span>
            )}
            {showMood && (
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-slate-600">Umore:</span>
                <span className="w-2.5 h-2.5 rounded bg-teal-400" /> positivo
                <span className="w-2.5 h-2.5 rounded bg-purple-300" /> neutro
                <span className="w-2.5 h-2.5 rounded bg-rose-500" /> negativo
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-200" /> non tracciato
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white ring-1 ring-slate-300" /> pasti registrati
            </span>
            {showBody && (
              <>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-slate-400" /> allenamento
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400" /> sonno
                </span>
              </>
            )}
            {showMood && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rotate-45 bg-white ring-1 ring-fuchsia-400" /> umore registrato
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
