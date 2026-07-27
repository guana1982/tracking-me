import { useEffect, useState } from 'react';
import { X, Loader2, Smile, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { todayLocal } from '../../lib/foodUtils';
import { useCreateQuickLog, useMoods } from '../../hooks/useFoodQueries';
import { MoodManager } from './MoodManager';
import type { QuickLogValenceDTO } from '@budget/shared';

interface MoodPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  date: string; // the diary day being viewed (YYYY-MM-DD)
}

const GROUPS: { title: string; valence: QuickLogValenceDTO }[] = [
  { title: 'Positivo', valence: 'POSITIVE' },
  { title: 'Neutro', valence: 'NEUTRAL' },
  { title: 'Negativo', valence: 'NEGATIVE' },
];

const CHIP_STYLES: Record<QuickLogValenceDTO, { idle: string; active: string }> = {
  POSITIVE: {
    idle: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
    active: 'border-emerald-500 bg-emerald-500 text-white',
  },
  NEUTRAL: {
    idle: 'border-slate-200 text-slate-600 hover:bg-slate-50',
    active: 'border-slate-500 bg-slate-500 text-white',
  },
  NEGATIVE: {
    idle: 'border-rose-200 text-rose-700 hover:bg-rose-50',
    active: 'border-rose-500 bg-rose-500 text-white',
  },
};

/** Mixed selections resolve to NEUTRAL, same rule as the keyword dictionaries */
function resolveValence(valences: QuickLogValenceDTO[]): QuickLogValenceDTO {
  const positive = valences.filter((v) => v === 'POSITIVE').length;
  const negative = valences.filter((v) => v === 'NEGATIVE').length;
  if (positive > 0 && negative === 0) return 'POSITIVE';
  if (negative > 0 && positive === 0) return 'NEGATIVE';
  return 'NEUTRAL';
}

/**
 * Structured mood entry, deliberately separate from "Aggiungi pasto": tap one
 * or more mood chips, optionally add a note, save. The chips pin category and
 * valence explicitly, so the mood track never depends on keyword matching.
 */
export function MoodPickerModal({ isOpen, onClose, onSaved, date }: MoodPickerModalProps) {
  const [selected, setSelected] = useState<string[]>([]); // definition keys
  const [note, setNote] = useState('');
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const moods = useMoods();
  const createLog = useCreateQuickLog();

  // Only active states are offered; archived ones stay in past entries
  const options = (moods.data ?? []).filter((mood) => mood.isActive);

  useEffect(() => {
    if (isOpen) {
      setSelected([]);
      setNote('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !createLog.isPending) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, createLog.isPending, onClose]);

  if (!isOpen) return null;

  const toggle = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const canSave = selected.length > 0 && !createLog.isPending;

  const handleSave = async () => {
    if (!canSave) return;
    const chosen = selected
      .map((key) => options.find((option) => option.key === key))
      .filter((option): option is (typeof options)[number] => option !== undefined);
    const valences = chosen.map((option) => option.valence);

    // Readable sentence: it is what the CSV and the LLM will actually see.
    // Names are copied in, so renaming a state later never rewrites history.
    const trimmedNote = note.trim();
    const text = `Umore: ${chosen.map((option) => option.name).join(', ')}${
      trimmedNote ? ` — ${trimmedNote}` : ''
    }`;

    await createLog.mutateAsync({
      text,
      derivedCategory: 'MOOD',
      derivedValence: resolveValence(valences),
      // A past day gets logged at local noon of that day, not "now"
      loggedAt:
        date === todayLocal() ? undefined : new Date(`${date}T12:00:00`).toISOString(),
    });

    onSaved('Umore registrato');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => !createLog.isPending && onClose()} />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-fuchsia-50">
              <Smile className="w-5 h-5 text-fuchsia-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">Come ti senti d'umore?</h2>
              <p className="text-xs text-slate-400">
                Traccia separata dalla condizione fisica
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsManagerOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Gestisci stati d'umore"
              aria-label="Gestisci stati d'umore"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => !createLog.isPending && onClose()}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Chiudi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chips */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {moods.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : options.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              Nessuno stato d'umore attivo: aggiungine uno dall'ingranaggio in alto.
            </p>
          ) : (
            GROUPS.map((group) => {
              const groupOptions = options.filter((o) => o.valence === group.valence);
              if (groupOptions.length === 0) return null;
              return (
                <div key={group.valence}>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                    {group.title}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {groupOptions.map((option) => {
                      const isActive = selected.includes(option.key);
                      const styles = CHIP_STYLES[option.valence];
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => toggle(option.key)}
                          className={cn(
                            'px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                            isActive ? styles.active : styles.idle
                          )}
                        >
                          {option.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
              Nota (facoltativa)
            </p>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Es. giornata pesante al lavoro"
              className="input text-sm"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-none sm:rounded-b-2xl">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors',
              canSave
                ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            {createLog.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {selected.length === 0
              ? 'Scegli almeno un umore'
              : `Salva umore (${selected.length})`}
          </button>
        </div>
      </div>

      <MoodManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
    </div>
  );
}
