import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useCreateHabit,
  useDeleteHabit,
  useHabits,
  useInstallDefaultHabits,
  useUpdateHabit,
} from '../../hooks/useHabitQueries';
import { TrackPicker } from '../food/RatingManager';
import {
  DAY_TRACK_LABELS,
  HABIT_DEFAULT_UNITS,
  HABIT_MEASURES,
  HABIT_MEASURE_HINTS,
  HABIT_MEASURE_LABELS,
  WEEKDAYS,
} from '@budget/shared';
import type { DayTrackDTO, HabitDefinitionDTO, HabitMeasureDTO } from '@budget/shared';

interface HabitManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  measure: HabitMeasureDTO;
  unit: string;
  target: string;
  moment: string;
  daysOfWeek: number[];
  track: DayTrackDTO;
}

const EMPTY_FORM: FormState = {
  name: '',
  measure: 'DONE',
  unit: '',
  target: '',
  moment: '',
  daysOfWeek: [],
  // Out of the graph unless asked: doing something is not automatically a
  // statement about how you feel
  track: 'NONE',
};

/**
 * The habit catalogue. Everything is the user's: what it is called, how it is
 * measured, on which days it is expected, and whether it says anything about
 * the day at all.
 */
export function HabitManager({ isOpen, onClose }: HabitManagerProps) {
  const habits = useHabits();
  const installDefaults = useInstallDefaultHabits();
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const deleteHabit = useDeleteHabit();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setForm(EMPTY_FORM);
      setEditingKey(null);
      setIsFormOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isPending =
    createHabit.isPending ||
    updateHabit.isPending ||
    deleteHabit.isPending ||
    installDefaults.isPending;
  const error =
    createHabit.error ||
    updateHabit.error ||
    deleteHabit.error ||
    installDefaults.error ||
    habits.error;
  const isEmpty = !habits.isLoading && (habits.data?.length ?? 0) === 0;

  const startEdit = (habit: HabitDefinitionDTO) => {
    setEditingKey(habit.key);
    setForm({
      name: habit.name,
      measure: habit.measure,
      unit: habit.unit,
      target: habit.target === null ? '' : String(habit.target),
      moment: habit.moment ?? '',
      daysOfWeek: habit.daysOfWeek,
      track: habit.track,
    });
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingKey(null);
    setIsFormOpen(false);
  };

  // Changing the measure offers its usual unit, without overwriting a custom one
  const pickMeasure = (measure: HabitMeasureDTO) => {
    setForm((previous) => ({
      ...previous,
      measure,
      unit:
        previous.unit && previous.unit !== HABIT_DEFAULT_UNITS[previous.measure]
          ? previous.unit
          : HABIT_DEFAULT_UNITS[measure],
    }));
  };

  const toggleDay = (day: number) => {
    setForm((previous) => ({
      ...previous,
      daysOfWeek: previous.daysOfWeek.includes(day)
        ? previous.daysOfWeek.filter((value) => value !== day)
        : [...previous.daysOfWeek, day].sort((a, b) => a - b),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || isPending) return;
    const parsedTarget = Number(form.target);
    const payload = {
      name: form.name.trim(),
      measure: form.measure,
      unit: form.measure === 'DONE' ? '' : form.unit.trim(),
      target: form.target !== '' && Number.isFinite(parsedTarget) ? parsedTarget : null,
      moment: form.moment.trim() || null,
      daysOfWeek: form.daysOfWeek,
      track: form.track,
    };
    if (editingKey) {
      await updateHabit.mutateAsync({ key: editingKey, data: payload });
    } else {
      await createHabit.mutateAsync(payload);
    }
    resetForm();
  };

  const handleDelete = (habit: HabitDefinitionDTO) => {
    const warning = habit.isUsed
      ? `"${habit.name}" ha già delle giornate registrate. Lo storico resta invariato. Toglierla dall'elenco?`
      : `Eliminare l'abitudine "${habit.name}"?`;
    if (window.confirm(warning)) {
      deleteHabit.mutate(habit.key);
      if (editingKey === habit.key) resetForm();
    }
  };

  const daysLabel = (days: number[]) =>
    days.length === 0
      ? 'tutti i giorni'
      : WEEKDAYS.filter((day) => days.includes(day.value))
          .map((day) => day.label.slice(0, 3))
          .join(', ');

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">Abitudini</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Quello che vuoi, misurato come vuoi, nei giorni che vuoi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {isEmpty && (
            <button
              type="button"
              onClick={() => installDefaults.mutate()}
              disabled={isPending}
              className="w-full btn btn-secondary text-sm"
            >
              {installDefaults.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1.5" />
              )}
              Parti dal set suggerito
            </button>
          )}

          {!isFormOpen && (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="btn btn-primary w-full text-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Aggiungi un'abitudine
            </button>
          )}

          {isFormOpen && (
            <form
              onSubmit={handleSubmit}
              className="space-y-3 border border-slate-200 rounded-xl p-3 bg-slate-50"
            >
              <div>
                <label className="label">Nome</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="input"
                  placeholder="Es. Meditazione"
                  maxLength={60}
                />
              </div>

              <div>
                <label className="label">Come si registra</label>
                <div className="flex flex-wrap gap-1">
                  {HABIT_MEASURES.map((measure) => (
                    <button
                      key={measure}
                      type="button"
                      onClick={() => pickMeasure(measure)}
                      aria-pressed={form.measure === measure}
                      className={cn(
                        'px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors',
                        form.measure === measure
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-slate-200 text-slate-600 hover:bg-white'
                      )}
                    >
                      {HABIT_MEASURE_LABELS[measure]}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {HABIT_MEASURE_HINTS[form.measure]}
                </p>
              </div>

              {form.measure !== 'DONE' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Unità</label>
                    <input
                      value={form.unit}
                      onChange={(event) => setForm({ ...form, unit: event.target.value })}
                      className="input"
                      placeholder="min, km, pagine"
                      maxLength={20}
                    />
                  </div>
                  <div>
                    <label className="label">Obiettivo (facoltativo)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={form.target}
                      onChange={(event) => setForm({ ...form, target: event.target.value })}
                      className="input"
                      placeholder="Es. 20"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Giorni</label>
                <div className="flex gap-1">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      aria-pressed={form.daysOfWeek.includes(day.value)}
                      title={day.label}
                      className={cn(
                        'w-9 h-9 rounded-lg border text-xs font-medium transition-colors',
                        form.daysOfWeek.includes(day.value)
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-slate-200 text-slate-500 hover:bg-white'
                      )}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Nessuno selezionato = tutti i giorni. Fuori da questi giorni non viene chiesta,
                  così un giorno di riposo non diventa un giorno saltato.
                </p>
              </div>

              <div>
                <label className="label">Momento (facoltativo)</label>
                <input
                  value={form.moment}
                  onChange={(event) => setForm({ ...form, moment: event.target.value })}
                  className="input"
                  placeholder="Es. Mattina"
                  maxLength={40}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Serve solo a raggruppare le righe nel diario.
                </p>
              </div>

              <div>
                <label className="label">Entra nel grafico come</label>
                <TrackPicker
                  value={form.track}
                  disabled={isPending}
                  onChange={(track) => setForm({ ...form, track })}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Di norma fuori: farla o non farla non è di per sé un modo di stare.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!form.name.trim() || isPending}
                  className="btn btn-primary flex-1"
                >
                  {isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  {editingKey ? 'Salva modifiche' : 'Aggiungi'}
                </button>
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Annulla
                </button>
              </div>
            </form>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error instanceof Error ? error.message : 'Operazione non riuscita'}
            </p>
          )}

          {habits.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            (habits.data?.length ?? 0) > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {habits.data?.map((habit) => (
                  <div key={habit.key} className="p-3 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm font-medium truncate',
                          habit.isActive ? 'text-slate-800' : 'text-slate-400 line-through'
                        )}
                      >
                        {habit.name}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {HABIT_MEASURE_LABELS[habit.measure].toLowerCase()}
                        {habit.unit ? ` · ${habit.unit}` : ''}
                        {habit.target !== null ? ` · obiettivo ${habit.target}` : ''}
                        {` · ${daysLabel(habit.daysOfWeek)}`}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {habit.moment ? `${habit.moment} · ` : ''}
                        {DAY_TRACK_LABELS[habit.track].toLowerCase()}
                        {habit.isUsed ? ' · presente nello storico' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(habit)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                      aria-label={`Modifica ${habit.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(habit)}
                      disabled={isPending}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label={`Elimina ${habit.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateHabit.mutate({ key: habit.key, data: { isActive: !habit.isActive } })
                      }
                      disabled={isPending}
                      className={cn(
                        'relative w-10 h-6 rounded-full transition-colors shrink-0',
                        habit.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                      )}
                      aria-label={habit.isActive ? `Disattiva ${habit.name}` : `Attiva ${habit.name}`}
                    >
                      <span
                        className={cn(
                          'absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform',
                          habit.isActive ? 'translate-x-4' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          <p className="text-xs text-slate-500">
            Un'abitudine disattivata sparisce dal diario ma resta nelle giornate già registrate.
            L'eliminazione toglie la voce dall'elenco senza modificare lo storico.
          </p>
        </div>
      </div>
    </div>
  );
}
