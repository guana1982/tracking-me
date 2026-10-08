import { useEffect, useState } from 'react';
import { Loader2, Pencil, Pill, Plus, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMealTypes } from '../../hooks/useFoodQueries';
import {
  useCreateTreatment,
  useDeleteTreatment,
  useTreatments,
  useUpdateTreatment,
} from '../../hooks/useTherapyQueries';
import { TitrationPlanner } from './TitrationPlanner';
import {
  BEDTIME_SLOT,
  BEDTIME_SLOT_LABEL,
  TREATMENT_KINDS,
  TREATMENT_KIND_LABELS,
} from '@budget/shared';
import type { TreatmentDefinitionDTO, TreatmentKindDTO } from '@budget/shared';

interface TreatmentManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  kind: TreatmentKindDTO;
  dose: string;
  form: string;
  detail: string;
  slots: string[];
  startedOn: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  kind: 'MEDICATION',
  dose: '',
  form: '',
  detail: '',
  slots: [],
  startedOn: '',
  notes: '',
};

const KIND_STYLES: Record<TreatmentKindDTO, string> = {
  MEDICATION: 'bg-violet-100 text-violet-700',
  SUPPLEMENT: 'bg-emerald-100 text-emerald-700',
  OTHER: 'bg-slate-100 text-slate-600',
};

/**
 * The catalogue of whatever the user takes on a schedule. Nothing is
 * preloaded and nothing is drug-specific: the same form describes a
 * prescription, a vitamin or a herbal tea.
 */
export function TreatmentManager({ isOpen, onClose }: TreatmentManagerProps) {
  const treatments = useTreatments();
  const mealTypes = useMealTypes();
  const createTreatment = useCreateTreatment();
  const updateTreatment = useUpdateTreatment();
  const deleteTreatment = useDeleteTreatment();

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

  const error =
    createTreatment.error || updateTreatment.error || deleteTreatment.error || treatments.error;
  const isPending =
    createTreatment.isPending || updateTreatment.isPending || deleteTreatment.isPending;

  // Moments are the user's own meal types, so a renamed meal keeps working
  const slotOptions = [
    ...(mealTypes.data ?? [])
      .filter((type) => type.isActive)
      .map((type) => ({ key: type.key, name: type.name })),
    { key: BEDTIME_SLOT, name: BEDTIME_SLOT_LABEL },
  ];

  const slotName = (key: string) =>
    key === BEDTIME_SLOT
      ? BEDTIME_SLOT_LABEL
      : mealTypes.data?.find((type) => type.key === key)?.name ?? key;

  const startEdit = (treatment: TreatmentDefinitionDTO) => {
    setEditingKey(treatment.key);
    setForm({
      name: treatment.name,
      kind: treatment.kind,
      dose: treatment.dose ?? '',
      form: treatment.form ?? '',
      detail: treatment.detail ?? '',
      slots: treatment.slots,
      startedOn: treatment.startedOn ?? '',
      notes: treatment.notes ?? '',
    });
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingKey(null);
    setIsFormOpen(false);
  };

  const toggleSlot = (key: string) => {
    setForm((prev) => ({
      ...prev,
      slots: prev.slots.includes(key)
        ? prev.slots.filter((slot) => slot !== key)
        : [...prev.slots, key],
    }));
  };

  const canSubmit = form.name.trim().length > 0 && form.slots.length > 0 && !isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      dose: form.dose.trim() || null,
      form: form.form.trim() || null,
      detail: form.detail.trim() || null,
      slots: form.slots,
      startedOn: form.startedOn || null,
      notes: form.notes.trim() || null,
    };
    if (editingKey) {
      await updateTreatment.mutateAsync({ key: editingKey, data: payload });
    } else {
      await createTreatment.mutateAsync(payload);
    }
    resetForm();
  };

  const handleDelete = (treatment: TreatmentDefinitionDTO) => {
    const warning = treatment.isUsed
      ? `"${treatment.name}" ha delle assunzioni registrate. Restano nello storico, ma la voce sparisce dalle giornate future. Eliminarla?`
      : `Eliminare "${treatment.name}"?`;
    if (window.confirm(warning)) {
      deleteTreatment.mutate(treatment.key);
      if (editingKey === treatment.key) resetForm();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">Cosa assumi</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Farmaci, integratori o altro: comparirà da spuntare nei momenti che scegli.
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
              Aggiungi una voce
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
                  placeholder="Es. Sertralina 50 mg"
                  maxLength={80}
                />
              </div>

              <div className="flex gap-1.5">
                {TREATMENT_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setForm({ ...form, kind })}
                    aria-pressed={form.kind === kind}
                    className={cn(
                      'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                      form.kind === kind
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    {TREATMENT_KIND_LABELS[kind]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Dose</label>
                  <input
                    value={form.dose}
                    onChange={(event) => setForm({ ...form, dose: event.target.value })}
                    className="input"
                    placeholder="Es. ½"
                    maxLength={60}
                  />
                </div>
                <div>
                  <label className="label">Forma</label>
                  <input
                    value={form.form}
                    onChange={(event) => setForm({ ...form, form: event.target.value })}
                    className="input"
                    placeholder="Es. cp, gtt"
                    maxLength={60}
                  />
                </div>
              </div>

              <div>
                <label className="label">Quando</label>
                <div className="flex flex-wrap gap-1.5">
                  {slotOptions.map((option) => {
                    const isSelected = form.slots.includes(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => toggleSlot(option.key)}
                        aria-pressed={isSelected}
                        className={cn(
                          'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                          isSelected
                            ? 'border-violet-500 bg-violet-500 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        )}
                      >
                        {option.name}
                      </button>
                    );
                  })}
                </div>
                {form.slots.length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    Scegli almeno un momento, altrimenti non comparirà da nessuna parte.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Principio attivo</label>
                  <input
                    value={form.detail}
                    onChange={(event) => setForm({ ...form, detail: event.target.value })}
                    className="input"
                    placeholder="Facoltativo"
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className="label">Iniziato il</label>
                  <input
                    type="date"
                    value={form.startedOn}
                    onChange={(event) => setForm({ ...form, startedOn: event.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Note</label>
                <input
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className="input"
                  placeholder="Es. dopo colazione"
                  maxLength={500}
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={!canSubmit} className="btn btn-primary flex-1">
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

          {treatments.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : treatments.data?.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Nessuna voce. Finché resta vuoto, nel diario non compare nulla.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {treatments.data?.map((treatment) => (
                <div key={treatment.key} className="p-3 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p
                        className={cn(
                          'text-sm font-medium truncate',
                          treatment.isActive ? 'text-slate-800' : 'text-slate-400 line-through'
                        )}
                      >
                        {treatment.name}
                      </p>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                          KIND_STYLES[treatment.kind]
                        )}
                      >
                        {TREATMENT_KIND_LABELS[treatment.kind]}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {[treatment.dose, treatment.form].filter(Boolean).join(' ') || 'dose libera'}
                      {' · '}
                      {treatment.slots.map(slotName).join(', ')}
                    </p>
                    {treatment.notes && (
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {treatment.notes}
                      </p>
                    )}
                    <TitrationPlanner treatment={treatment} />
                  </div>

                  <button
                    type="button"
                    onClick={() => startEdit(treatment)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                    aria-label={`Modifica ${treatment.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(treatment)}
                    disabled={isPending}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                    aria-label={`Elimina ${treatment.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateTreatment.mutate({
                        key: treatment.key,
                        data: { isActive: !treatment.isActive },
                      })
                    }
                    disabled={isPending}
                    className={cn(
                      'relative w-10 h-6 rounded-full transition-colors shrink-0 mt-1',
                      treatment.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                    )}
                    aria-label={
                      treatment.isActive ? `Sospendi ${treatment.name}` : `Riattiva ${treatment.name}`
                    }
                  >
                    <span
                      className={cn(
                        'absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform',
                        treatment.isActive ? 'translate-x-4' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <Pill className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Sospendere una voce la toglie dalle giornate future senza toccare lo storico.
            Eliminarla lascia comunque intatte le assunzioni già registrate.
          </p>
        </div>
      </div>
    </div>
  );
}
