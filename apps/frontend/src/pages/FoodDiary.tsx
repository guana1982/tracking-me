import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, TrendingUp, Loader2, AlertCircle, Smile } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { todayLocal, addDaysLocal, localDateOf } from '../lib/foodUtils';
import { useMeals, useQuickLogs, useDeleteMeal } from '../hooks/useFoodQueries';
import { MealFormModal } from '../components/food/MealFormModal';
import { MealCard } from '../components/food/MealCard';
import { QuickLogNote } from '../components/food/QuickLogNote';
import { QuickLogBar } from '../components/food/QuickLogBar';
import { MoodPickerModal } from '../components/food/MoodPickerModal';
import type { MealDTO, QuickLogDTO } from '@budget/shared';

type TimelineEntry =
  | { kind: 'meal'; timestamp: string; meal: MealDTO }
  | { kind: 'log'; timestamp: string; log: QuickLogDTO };

/** Monday of the week containing the date */
function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  return addDaysLocal(date, -day);
}

export function FoodDiary() {
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealDTO | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<MealDTO | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const from = weekStart(selectedDate);
  const to = addDaysLocal(from, 6);

  const meals = useMeals(from, to);
  const quickLogs = useQuickLogs(from, to);
  const deleteMeal = useDeleteMeal();

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const openCreate = () => {
    setEditingMeal(null);
    setDuplicateFrom(null);
    setIsMealModalOpen(true);
  };

  const openEdit = (meal: MealDTO) => {
    setEditingMeal(meal);
    setDuplicateFrom(null);
    setIsMealModalOpen(true);
  };

  const openDuplicate = (meal: MealDTO) => {
    setEditingMeal(null);
    setDuplicateFrom(meal);
    setIsMealModalOpen(true);
  };

  const handleDelete = (meal: MealDTO) => {
    if (window.confirm('Eliminare questo pasto e tutte le sue voci?')) {
      deleteMeal.mutate(meal.id, { onSuccess: () => showToast('Pasto eliminato') });
    }
  };

  // Meals and quick logs of the selected day, interleaved chronologically
  const timeline = useMemo((): TimelineEntry[] => {
    const dayMeals = (meals.data ?? []).filter((meal) => meal.date === selectedDate);
    const dayLogs = (quickLogs.data ?? []).filter(
      (log) => localDateOf(log.loggedAt) === selectedDate
    );
    return [
      ...dayMeals.map((meal): TimelineEntry => ({ kind: 'meal', timestamp: meal.createdAt, meal })),
      ...dayLogs.map((log): TimelineEntry => ({ kind: 'log', timestamp: log.loggedAt, log })),
    ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [meals.data, quickLogs.data, selectedDate]);

  const daysWithData = useMemo(() => {
    const days = new Set<string>();
    for (const meal of meals.data ?? []) days.add(meal.date);
    for (const log of quickLogs.data ?? []) days.add(localDateOf(log.loggedAt));
    return days;
  }, [meals.data, quickLogs.data]);

  const isLoading = meals.isLoading || quickLogs.isLoading;
  const loadError = meals.error || quickLogs.error;
  const isToday = selectedDate === todayLocal();

  return (
    <div className="max-w-2xl mx-auto pb-28 sm:pb-20">
      {/* Header: day nav + actions */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelectedDate(addDaysLocal(selectedDate, -1))}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center min-w-32">
            <p className="text-sm font-semibold text-slate-900 capitalize">
              {format(new Date(`${selectedDate}T12:00:00`), 'EEEE d MMMM', { locale: it })}
            </p>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayLocal())}
                className="text-xs text-blue-600 hover:underline"
              >
                Torna a oggi
              </button>
            )}
          </div>
          <button
            onClick={() => setSelectedDate(addDaysLocal(selectedDate, 1))}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/food/trends" className="btn btn-secondary text-xs flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Andamento</span>
          </Link>
          {/* Mood entry lives next to the meal one: same weight, different track */}
          <button
            onClick={() => setIsMoodModalOpen(true)}
            className="hidden sm:flex btn text-xs items-center gap-1.5 bg-fuchsia-600 text-white hover:bg-fuchsia-700"
            title="Registra l'umore di questo giorno"
          >
            <Smile className="w-3.5 h-3.5" />
            Umore
          </button>
          <button
            onClick={openCreate}
            className="hidden sm:flex btn btn-primary text-xs items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Pasto
          </button>
        </div>
      </div>

      {/* Week strip */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {Array.from({ length: 7 }, (_, i) => addDaysLocal(from, i)).map((date) => {
          const d = new Date(`${date}T12:00:00`);
          const isSelected = date === selectedDate;
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={cn(
                'flex flex-col items-center py-1.5 rounded-xl text-xs transition-colors',
                isSelected
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              )}
            >
              <span className="uppercase text-[10px]">
                {format(d, 'EEE', { locale: it })}
              </span>
              <span className="font-semibold">{d.getDate()}</span>
              <span
                className={cn(
                  'w-1 h-1 rounded-full mt-0.5',
                  daysWithData.has(date)
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

      {/* Day timeline */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : loadError ? (
        <div className="card flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {loadError instanceof Error ? loadError.message : 'Errore nel caricamento del diario'}
        </div>
      ) : timeline.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-sm text-slate-500">Nessun pasto o nota per questo giorno.</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button onClick={openCreate} className="btn btn-primary text-sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Aggiungi pasto
            </button>
            <button
              onClick={() => setIsMoodModalOpen(true)}
              className="btn text-sm bg-fuchsia-600 text-white hover:bg-fuchsia-700"
            >
              <Smile className="w-4 h-4 mr-1.5" />
              Umore
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {timeline.map((entry) =>
            entry.kind === 'meal' ? (
              <MealCard
                key={`meal-${entry.meal.id}`}
                meal={entry.meal}
                onEdit={openEdit}
                onDuplicate={openDuplicate}
                onDelete={handleDelete}
              />
            ) : (
              <QuickLogNote key={`log-${entry.log.id}`} log={entry.log} />
            )
          )}
        </div>
      )}

      {/* Sticky quick log bar (dictation-friendly, always one tap away) */}
      <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 px-3 py-2 sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56">
        <div className="max-w-2xl mx-auto">
          <QuickLogBar onSaved={showToast} />
        </div>
      </div>

      {/* FAB pair (mobile): umore and pasto, visually distinct */}
      <div className="sm:hidden fixed bottom-32 right-4 z-40 flex flex-col items-center gap-3">
        <button
          onClick={() => setIsMoodModalOpen(true)}
          className="w-12 h-12 bg-fuchsia-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-fuchsia-700 transition-colors"
          title="Registra umore"
        >
          <Smile className="w-5 h-5" />
        </button>
        <button
          onClick={openCreate}
          className="w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-800 transition-colors"
          title="Nuovo pasto"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-32 sm:bottom-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      <MealFormModal
        isOpen={isMealModalOpen}
        onClose={() => setIsMealModalOpen(false)}
        onSaved={showToast}
        editingMeal={editingMeal}
        duplicateFrom={duplicateFrom}
      />

      <MoodPickerModal
        isOpen={isMoodModalOpen}
        onClose={() => setIsMoodModalOpen(false)}
        onSaved={showToast}
        date={selectedDate}
      />
    </div>
  );
}
