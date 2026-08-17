import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ActivityMonthCalendarProps {
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
}

export function ActivityMonthCalendar({ selectedDate, today, onSelectDate }: ActivityMonthCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseISO(selectedDate)));

  useEffect(() => {
    setVisibleMonth(startOfMonth(parseISO(selectedDate)));
  }, [selectedDate]);

  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
    const result: Date[] = [];
    for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) result.push(cursor);
    return result;
  }, [visibleMonth]);

  return (
    <section className="card w-full max-w-4xl mx-auto p-3 sm:p-4 xl:shrink-0">
      <div className="flex items-center justify-between gap-3 mb-3">
        <button type="button" onClick={() => setVisibleMonth((month) => addMonths(month, -1))} className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100" aria-label="Mese precedente">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900 capitalize">{format(visibleMonth, 'MMMM yyyy', { locale: it })}</h2>
          <button type="button" onClick={() => onSelectDate(today)} className="mt-0.5 text-[11px] font-medium text-blue-600 hover:underline">
            {selectedDate === today ? 'Oggi selezionato' : 'Torna a oggi'}
          </button>
        </div>
        <button type="button" onClick={() => setVisibleMonth((month) => addMonths(month, 1))} className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100" aria-label="Mese successivo">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((label) => (
          <div key={label} className="pb-1 text-center text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        ))}
        {days.map((day) => {
          const value = format(day, 'yyyy-MM-dd');
          const isSelected = value === selectedDate;
          const isToday = value === today;
          const inMonth = isSameMonth(day, visibleMonth);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelectDate(value)}
              className={cn(
                'relative min-h-10 sm:min-h-12 rounded-xl text-xs sm:text-sm font-medium transition-colors',
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : isToday
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'
                    : inMonth
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-slate-50'
              )}
            >
              {format(day, 'd')}
              {isToday && !isSelected && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
