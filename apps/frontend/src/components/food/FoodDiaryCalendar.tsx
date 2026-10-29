import { type ReactNode, useEffect, useMemo, useState } from 'react';
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
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useFoodOverview } from '../../hooks/useFoodQueries';
import { cn } from '../../lib/utils';

interface FoodDiaryCalendarProps {
  selectedDate: string;
  today: string;
  daysWithData: ReadonlySet<string>;
  actions: ReactNode;
  onSelectDate: (date: string) => void;
}

export function FoodDiaryCalendar({
  selectedDate,
  today,
  daysWithData,
  actions,
  onSelectDate,
}: FoodDiaryCalendarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseISO(selectedDate)));

  useEffect(() => {
    setVisibleMonth(startOfMonth(parseISO(selectedDate)));
  }, [selectedDate]);

  const weekDays = useMemo(() => {
    const first = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(first, index));
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const first = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
    const result: Date[] = [];
    for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) result.push(cursor);
    return result;
  }, [visibleMonth]);

  const monthFrom = format(startOfMonth(visibleMonth), 'yyyy-MM-dd');
  const monthTo = format(endOfMonth(visibleMonth), 'yyyy-MM-dd');
  const monthOverview = useFoodOverview(monthFrom, monthTo, isExpanded);
  const monthDatesWithData = useMemo(
    () =>
      new Set(
        (monthOverview.data?.days ?? [])
          .filter(
            (day) =>
              day.hasMeals ||
              day.dayState !== null ||
              day.moodState !== null ||
              day.eventCount > 0 ||
              day.sideEffectCount > 0 ||
              day.skippedIntakes > 0 ||
              day.doseChanges.length > 0 ||
              day.weightKg !== null
          )
          .map((day) => day.date)
      ),
    [monthOverview.data]
  );

  const moveSelectedDay = (amount: number) => {
    onSelectDate(format(addDays(parseISO(selectedDate), amount), 'yyyy-MM-dd'));
  };

  if (!isExpanded) {
    return (
      <section className="w-full max-w-2xl mx-auto" aria-label="Calendario settimanale del diario">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-0.5 min-w-0">
            <button
              type="button"
              onClick={() => moveSelectedDay(-1)}
              className="w-9 h-10 sm:w-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Giorno precedente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <p className="min-w-0 sm:min-w-36 text-center text-xs sm:text-sm font-semibold text-slate-900 capitalize truncate">
              <span className="sm:hidden">{format(parseISO(selectedDate), 'EEE d MMM', { locale: it })}</span>
              <span className="hidden sm:inline">{format(parseISO(selectedDate), 'EEEE d MMMM', { locale: it })}</span>
            </p>
            <button
              type="button"
              onClick={() => moveSelectedDay(1)}
              className="w-9 h-10 sm:w-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Giorno successivo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {actions}
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="btn btn-secondary min-h-9 px-2 sm:px-2.5 text-xs flex items-center gap-1.5"
              aria-expanded="false"
              aria-label="Espandi il calendario mensile"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="sm:hidden">Mese</span>
              <span className="hidden sm:inline">Espandi</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const value = format(day, 'yyyy-MM-dd');
            const isSelected = value === selectedDate;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onSelectDate(value)}
                className={cn(
                  'min-h-11 flex flex-col items-center justify-center py-1.5 rounded-xl text-xs transition-colors',
                  isSelected
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                )}
                aria-current={isSelected ? 'date' : undefined}
              >
                <span className="uppercase text-[9px] sm:text-[10px]">{format(day, 'EEE', { locale: it })}</span>
                <span className="font-semibold">{format(day, 'd')}</span>
                <span
                  className={cn(
                    'w-1 h-1 rounded-full mt-0.5',
                    daysWithData.has(value)
                      ? isSelected
                        ? 'bg-emerald-300'
                        : 'bg-emerald-500'
                      : 'bg-transparent'
                  )}
                />
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="card w-full max-w-4xl mx-auto p-3 sm:p-4" aria-label="Calendario mensile del diario">
      <div className="flex items-center justify-end gap-1.5 mb-1">
        {actions}
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="btn btn-secondary min-h-9 px-2.5 text-xs flex items-center gap-1.5"
          aria-expanded="true"
          aria-label="Riduci il calendario alla settimana"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Riduci</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3">
        <button
          type="button"
          onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
          className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100"
          aria-label="Mese precedente"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-sm sm:text-base font-semibold text-slate-900 capitalize">{format(visibleMonth, 'MMMM yyyy', { locale: it })}</h2>
          <button type="button" onClick={() => onSelectDate(today)} className="mt-0.5 text-[11px] font-medium text-blue-600 hover:underline">
            {selectedDate === today ? 'Oggi selezionato' : 'Torna a oggi'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
          className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100"
          aria-label="Mese successivo"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((label) => (
          <div key={label} className="pb-1 text-center text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        ))}
        {monthDays.map((day) => {
          const value = format(day, 'yyyy-MM-dd');
          const isSelected = value === selectedDate;
          const isToday = value === today;
          const inMonth = isSameMonth(day, visibleMonth);
          const hasData = monthDatesWithData.has(value);
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
              aria-current={isSelected ? 'date' : undefined}
            >
              {format(day, 'd')}
              {hasData && (
                <span
                  className={cn(
                    'absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                    isSelected ? 'bg-emerald-300' : 'bg-emerald-500'
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
