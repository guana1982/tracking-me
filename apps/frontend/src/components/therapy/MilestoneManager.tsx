import { useEffect, useState } from 'react';
import { CalendarClock, Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useCreateMilestone,
  useDeleteMilestone,
  useExamAdvisories,
  useMilestones,
  useUpdateMilestone,
} from '../../hooks/useTherapyPlanQueries';
import { MILESTONE_KINDS, MILESTONE_KIND_LABELS } from '@budget/shared';
import type { MilestoneKindDTO } from '@budget/shared';

interface MilestoneManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

function splitLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Exams, appointments and anything else with a date (§3.7).
 *
 * The conditional reminders are the reason this exists: an exam booked
 * without "no heavy training for 72 h" attached to it is an exam that comes
 * back false-positive. They are offered from the config file and can be
 * edited freely.
 */
export function MilestoneManager({ isOpen, onClose }: MilestoneManagerProps) {
  const milestones = useMilestones();
  const advisories = useExamAdvisories(isOpen);
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [kind, setKind] = useState<MilestoneKindDTO>('EXAM');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setIsFormOpen(false);
      setKind('EXAM');
      setTitle('');
      setDate('');
      setNotes('');
      setItems('');
      setPicked([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isPending =
    createMilestone.isPending || updateMilestone.isPending || deleteMilestone.isPending;
  const error =
    createMilestone.error || updateMilestone.error || deleteMilestone.error || milestones.error;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !date) return;
    await createMilestone.mutateAsync({
      kind,
      title: title.trim(),
      date,
      notes: notes.trim() || null,
      items: splitLines(items),
      advisories: picked,
    });
    setTitle('');
    setDate('');
    setNotes('');
    setItems('');
    setPicked([]);
    setIsFormOpen(false);
  };

  const togglePicked = (advisory: string) => {
    setPicked((previous) =>
      previous.includes(advisory)
        ? previous.filter((item) => item !== advisory)
        : [...previous, advisory]
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">Scadenzario</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Esami, controlli e le condizioni da rispettare prima.
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
          {!isFormOpen && (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="btn btn-primary w-full text-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Aggiungi una scadenza
            </button>
          )}

          {isFormOpen && (
            <form
              onSubmit={handleCreate}
              className="space-y-3 border border-slate-200 rounded-xl p-3 bg-slate-50"
            >
              <div className="flex gap-1">
                {MILESTONE_KINDS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setKind(option)}
                    aria-pressed={kind === option}
                    className={cn(
                      'px-2 py-1 rounded-full border text-[11px] font-medium transition-colors',
                      kind === option
                        ? 'border-teal-500 bg-teal-500 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {MILESTONE_KIND_LABELS[option]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Titolo</label>
                  <input
                    autoFocus
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="input"
                    placeholder="Es. Emocromo e funzionalità epatica"
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className="label">Data</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="input"
                  />
                </div>
              </div>

              {kind === 'EXAM' && (
                <div>
                  <label className="label">Valori da controllare (uno per riga)</label>
                  <textarea
                    value={items}
                    onChange={(event) => setItems(event.target.value)}
                    className="input min-h-16"
                    placeholder={'Valproatemia\nTransaminasi\nEmocromo'}
                  />
                </div>
              )}

              {(advisories.data ?? []).length > 0 && (
                <div>
                  <label className="label">Condizioni da rispettare prima</label>
                  <div className="space-y-1">
                    {(advisories.data ?? []).map((advisory) => (
                      <label
                        key={advisory}
                        className="flex items-start gap-2 text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={picked.includes(advisory)}
                          onChange={() => togglePicked(advisory)}
                          className="mt-0.5 rounded border-slate-300"
                        />
                        {advisory}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Note</label>
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="input"
                  placeholder="Es. laboratorio di via Roma, senza appuntamento"
                  maxLength={500}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!title.trim() || !date || isPending}
                  className="btn btn-primary flex-1"
                >
                  {isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  Aggiungi
                </button>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="btn btn-secondary"
                >
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

          {milestones.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (milestones.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Nessuna scadenza. Aggiungi il prossimo controllo o esame.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {milestones.data?.map((milestone) => (
                <div key={milestone.id} className="p-3">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateMilestone.mutate({
                          id: milestone.id,
                          data: { isDone: !milestone.isDone },
                        })
                      }
                      className={cn(
                        'mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors',
                        milestone.isDone
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 hover:border-emerald-400'
                      )}
                      aria-label={milestone.isDone ? 'Segna da fare' : 'Segna fatto'}
                    >
                      {milestone.isDone && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          milestone.isDone ? 'text-slate-400 line-through' : 'text-slate-800'
                        )}
                      >
                        {milestone.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {MILESTONE_KIND_LABELS[milestone.kind]} ·{' '}
                        {milestone.date.split('-').reverse().join('/')}
                      </p>
                      {milestone.items.length > 0 && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {milestone.items.join(' · ')}
                        </p>
                      )}
                      {milestone.advisories.map((advisory) => (
                        <p
                          key={advisory}
                          className="mt-1 text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5"
                        >
                          {advisory}
                        </p>
                      ))}
                      {milestone.notes && (
                        <p className="mt-1 text-[11px] text-slate-500">{milestone.notes}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Eliminare "${milestone.title}"?`)) {
                          deleteMilestone.mutate(milestone.id);
                        }
                      }}
                      disabled={isPending}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label={`Elimina ${milestone.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <CalendarClock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Le condizioni proposte arrivano dal file di configurazione della terapia, non dal
            codice: si modificano lì senza toccare l'app.
          </p>
        </div>
      </div>
    </div>
  );
}
