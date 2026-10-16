import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ActivityDayCountDTO } from '@budget/shared';
import { useActivityCounts } from '../../hooks/useActivityQueries';
import { cn } from '../../lib/utils';

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

interface ActivityWeekStripProps {
  selectedDate: string;
  today: string;
  /** Only to label the toggle: the month itself is a panel the page places */
  isMonthOpen: boolean;
  onToggleMonth: () => void;
  /**
   * Page buttons that ride in the strip's own top row, as on the food diary:
   * they have to sit inside the centred block, or centring the days would push
   * them off on their own
   */
  actions?: ReactNode;
  onSelectDate: (date: string) => void;
}

/**
 * The always-on half of the calendar: the seven days around the selected one.
 * It stays in the flow at the top of the page, so moving by a day never costs
 * an extra click and the list below keeps the whole width.
 */
export function ActivityWeekStrip({
  selectedDate,
  today,
  isMonthOpen,
  onToggleMonth,
  actions,
  onSelectDate,
}: ActivityWeekStripProps) {
  const weekDays = useMemo(() => {
    const first = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(first, index));
  }, [selectedDate]);

  const counts = useActivityCounts(
    format(weekDays[0], 'yyyy-MM-dd'),
    format(weekDays[weekDays.length - 1], 'yyyy-MM-dd')
  );
  const countsByDate = useMemo(
    () => new Map((counts.data ?? []).map((entry) => [entry.date, entry])),
    [counts.data]
  );

  const moveSelectedDay = (amount: number) => {
    onSelectDate(format(addDays(parseISO(selectedDate), amount), 'yyyy-MM-dd'));
  };

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

        <div className="flex items-center gap-1.5 shrink-0">
          {actions}
          <button
            type="button"
            onClick={onToggleMonth}
            className={cn(
              'btn min-h-9 px-2 sm:px-2.5 text-xs flex items-center gap-1.5',
              isMonthOpen ? 'btn-primary' : 'btn-secondary'
            )}
            aria-expanded={isMonthOpen}
            aria-label={isMonthOpen ? 'Chiudi il calendario mensile' : 'Apri il calendario mensile'}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>
              {isMonthOpen ? 'Chiudi' : 'Espandi'}
              <span className="hidden sm:inline"> mese</span>
            </span>
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isMonthOpen && 'rotate-180')} />
          </button>
        </div>
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

interface ActivityMonthPanelProps {
  selectedDate: string;
  today: string;
  /** Says whose date is being picked, when the panel is answering for one card */
  caption?: ReactNode;
  /** An extra way out under the legend, e.g. dropping a due date entirely */
  footer?: ReactNode;
  onClose: () => void;
  onSelectDate: (date: string) => void;
}

/**
 * The month, as a panel docked in a corner instead of a block in the page:
 * jumping to another date is an occasional errand, and it should not push the
 * list down or take width away from it for the rest of the session.
 */
export function ActivityMonthPanel({
  selectedDate,
  today,
  caption,
  footer,
  onClose,
  onSelectDate,
}: ActivityMonthPanelProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseISO(selectedDate)));

  useEffect(() => {
    setVisibleMonth(startOfMonth(parseISO(selectedDate)));
  }, [selectedDate]);

  // Nothing dims the page behind a docked panel, so Escape is the way out that
  // does not need the button to be found first
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const monthDays = useMemo(() => {
    const first = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
    const result: Date[] = [];
    for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) result.push(cursor);
    return result;
  }, [visibleMonth]);

  const counts = useActivityCounts(
    format(monthDays[0], 'yyyy-MM-dd'),
    format(monthDays[monthDays.length - 1], 'yyyy-MM-dd')
  );
  const countsByDate = useMemo(
    () => new Map((counts.data ?? []).map((entry) => [entry.date, entry])),
    [counts.data]
  );

  return (
    <section
      className="card w-full p-3 shadow-xl max-h-[70vh] overflow-y-auto overscroll-contain"
      aria-label="Calendario mensile"
    >
      {caption && (
        <div className="mb-2 border-b border-slate-100 pb-2 text-[11px] leading-snug text-slate-500">
          {caption}
        </div>
      )}

      <div className="flex items-center justify-between gap-1 mb-2">
        <button
          type="button"
          onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 shrink-0"
          aria-label="Mese precedente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 text-center">
          <h2 className="text-sm font-semibold text-slate-900 capitalize truncate">
            {format(visibleMonth, 'MMMM yyyy', { locale: it })}
          </h2>
          <button type="button" onClick={() => onSelectDate(today)} className="text-[11px] font-medium text-blue-600 hover:underline">
            {selectedDate === today ? 'Oggi selezionato' : 'Torna a oggi'}
          </button>
        </div>
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100"
            aria-label="Mese successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Chiudi il calendario mensile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((label) => (
          <div key={label} className="pb-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
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
                'relative min-h-9 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-colors',
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

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-500" />da fare</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />rimasto aperto</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />scadenza</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />tutto chiuso</span>
        <span className="w-full">I task settimanali non hanno un giorno, quindi non compaiono qui.</span>
      </div>

      {footer && <div className="mt-2 border-t border-slate-100 pt-2">{footer}</div>}
    </section>
  );
}
