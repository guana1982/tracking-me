import { useState } from 'react';
import { Loader2, Pill } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useInstallSideEffects,
  useSuggestedSideEffects,
} from '../../hooks/useTherapyQueries';
import { SIDE_EFFECT_LEVELS } from '@budget/shared';

/**
 * Side effects, proposed from what the user is actually taking (§3.5): the
 * list is never fixed, it comes from a config file matched against the active
 * treatments. What is chosen becomes an optional check-in scale with named
 * steps - present or not, and how strong - never a number to count.
 */
export function SideEffectPicker() {
  const suggestions = useSuggestedSideEffects();
  const install = useInstallSideEffects();
  const [selected, setSelected] = useState<string[]>([]);

  const available = (suggestions.data ?? []).filter((item) => !item.isInstalled);
  if (suggestions.isLoading || available.length === 0) return null;

  const toggle = (name: string) => {
    setSelected((previous) =>
      previous.includes(name) ? previous.filter((item) => item !== name) : [...previous, name]
    );
  };

  const handleInstall = async () => {
    if (selected.length === 0) return;
    await install.mutateAsync(selected);
    setSelected([]);
  };

  return (
    <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <Pill className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-sm font-medium text-slate-800">Effetti collaterali da tenere d'occhio</p>
      </div>
      <p className="text-[11px] text-slate-500 mb-2">
        Proposti in base a quello che stai assumendo. Diventano voci facoltative del check-in, con
        i passi {SIDE_EFFECT_LEVELS.join(' / ')}.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {available.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => toggle(item.name)}
            title={`Suggerito da: ${item.sources.join(', ')}`}
            className={cn(
              'px-2 py-1 rounded-full border text-[11px] font-medium transition-colors',
              selected.includes(item.name)
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-amber-200 bg-white text-amber-800 hover:border-amber-400'
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleInstall}
        disabled={selected.length === 0 || install.isPending}
        className="mt-2 btn btn-secondary text-xs w-full disabled:opacity-50"
      >
        {install.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
        {selected.length === 0
          ? 'Scegli quali seguire'
          : `Aggiungi al check-in (${selected.length})`}
      </button>
    </div>
  );
}
