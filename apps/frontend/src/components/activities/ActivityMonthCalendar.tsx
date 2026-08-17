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
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import type { ActivityDayCountDTO } from '@budget/shared';
import { useActivityCounts } from '../../hooks/useActivityQueries';
import { cn } from '../../lib/utils';

interface ActivityMonthCalendarProps {
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
}

/**
 * What a day carries, at a glance: something still open, a deadline due, or
 * everything already closed. Without this the month view is only a way to
 * navigate, and you have to open a day to find out whether it holds anything.
 */
function DayLoad({
  counts,
  date,
  today,
  isSelected,
}: {
  counts: ActivityDayCountDTO | undefined;
  date: string;
  today: string;
  isSelected: boolean;
}) {
  const open = counts?.open ?? 0;
  const done = counts?.done ?? 0;
  const deadlines = counts?.deadlines ?? 0;
  const dots: string[] = [];

  if (open > 0) dots.push(date < today ? 'bg-red-500' : isSelected ? 'bg-sky-300' : 'bg-sky-500');
  if (deadlines > 0) dots.push(isSelected ? 'bg-amber-300' : 'bg-amber-500');
  if (open === 0 && done > 0) dots.push(isSelected ? 'bg-emerald-300' : 'bg-emerald-500');

  return (
    <span className="mt-0.5 flex h-1 items-center justify-center gap-0.5" aria-hidden="true">
      {dots.map((color) => (
        <span key={color} className={cn('w-1 h-1 rounded-full', color)} />
      ))}
    </span>
  );
}

function loadLabel(counts: ActivityDayCountDTO | undefined): string | undefined {
  if (!counts) return undefined;
  const parts: string[] = [];
  if (counts.open > 0) parts.push(`${counts.open} da fare`);
  if (counts.done > 0) parts.push(`${counts.done} completate`);
  if (counts.deadlines > 0) parts.push(`${counts.deadlines} scadenze`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function ActivityMonthCalendar({ selectedDate, today, onSelectDate }: ActivityMonthCalendarProps) {
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

  const moveSelectedDay = (amount: number) => {
    onSelectDate(format(addDays(parseISO(selectedDate), amount), 'yyyy-MM-dd'));
  };

  // Only what is on screen is asked for, so collapsing back to a week stops
  // paying for a month of counts
  const shownDays = isExpanded ? monthDays : weekDays;
  const counts = useActivityCounts(
    format(shownDays[0], 'yyyy-MM-dd'),
    format(shownDays[shownDays.length - 1], 'yyyy-MM-dd')
  );
  const countsByDate = useMemo(
    () => new Map((counts.data ?? []).map((entry) => [entry.date, entry])),
    [counts.data]
  );

  if (!isExpanded) {
    return (
      <section className="w-full max-w-2xl mx-auto" aria-label="Calendario settimanale">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-0.5 min-w-0">
            <button
              type="button"
              onClick={() => moveSelectedDay(-1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Giorno precedente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <p className="min-w-0 sm:min-w-36 text-center text-xs sm:text-sm font-semibold text-slate-900 capitalize truncate">
              {format(parseISO(selectedDate), 'EEEE d MMMM', { locale: it })}
            </p>
            <button
              type="button"
              onClick={() => moveSelectedDay(1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Giorno successivo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="btn btn-secondary min-h-9 shrink-0 px-2.5 text-xs flex items-center gap-1.5"
            aria-expanded="false"
            aria-label="Espandi il calendario mensile"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Espandi<span className="hidden sm:inline"> mese</span></span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const value = format(day, 'yyyy-MM-dd');
            const isSelected = value === selectedDate;
            const isToday = value === today;
            const dayCounts = countsByDate.get(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => onSelectDate(value)}
                title={loadLabel(dayCounts)}
                className={cn(
                  'relative min-h-11 flex flex-col items-center justify-center py-1.5 rounded-xl text-xs transition-colors',
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : isToday
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100',
                  // The dot below now carries the day's load, so today needs a
                  // mark of its own that survives being selected
                  isToday && 'ring-1 ring-emerald-400'
                )}
                aria-current={isSelected ? 'date' : undefined}
              >
                <span className="uppercase text-[9px] sm:text-[10px]">{format(day, 'EEE', { locale: it })}</span>
                <span className="font-semibold">{format(day, 'd')}</span>
                <DayLoad counts={dayCounts} date={value} today={today} isSelected={isSelected} />
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="card w-full max-w-4xl mx-auto p-3 sm:p-4 xl:shrink-0" aria-label="Calendario mensile">
      <div className="flex justify-end mb-1">
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
          const dayCounts = countsByDate.get(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelectDate(value)}
              title={loadLabel(dayCounts)}
              className={cn(
                'relative min-h-10 sm:min-h-12 flex flex-col items-center justify-center rounded-xl text-xs sm:text-sm font-medium transition-colors',
                isSelected
                  ? 'bg-slate-900 text-white shadow-sm'
                  : isToday
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'
                    : inMonth
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-slate-50',
                isToday && isSelected && 'ring-1 ring-emerald-400'
              )}
              aria-current={isSelected ? 'date' : undefined}
            >
              {format(day, 'd')}
              <DayLoad counts={dayCounts} date={value} today={today} isSelected={isSelected} />
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-500" />da fare</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />rimasto aperto</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />scadenza</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />tutto chiuso</span>
        <span className="w-full sm:w-auto">I task settimanali non hanno un giorno, quindi non compaiono qui.</span>
      </div>
    </section>
  );
}
