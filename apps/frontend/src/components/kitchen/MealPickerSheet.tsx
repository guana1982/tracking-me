import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChefHat, Loader2, NotebookPen, Plus, Search, UtensilsCrossed } from 'lucide-react';
import {
  kitchenNameKey,
  MEAL_SLOT_LABELS,
  type KitchenWeekDTO,
  type MealSlotDTO,
  type RecipeDTO,
} from '@budget/shared';
import { cn } from '../../lib/utils';
import { needsLabel } from './kitchenUi';
import { Sheet } from './Sheet';

export interface MealPickerTarget {
  date: string;
  slot: MealSlotDTO;
  /** Set when changing the dish of a meal already on the menu */
  entryId?: string;
}

interface MealPickerSheetProps {
  target: MealPickerTarget | null;
  week: KitchenWeekDTO;
  isSaving: boolean;
  onClose: () => void;
  onPickRecipe: (recipe: RecipeDTO) => void;
  onPickFreeText: (title: string) => void;
  onCreateRecipe: (name: string) => void;
}

/**
 * Choosing what to eat. The dishes that can be cooked with what is at home
 * come first, so the menu leans on the pantry before it leans on the shop.
 */
export function MealPickerSheet({
  target,
  week,
  isSaving,
  onClose,
  onPickRecipe,
  onPickFreeText,
  onCreateRecipe,
}: MealPickerSheetProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSearch('');
  }, [target?.date, target?.slot, target?.entryId]);

  if (!target) return null;

  const query = kitchenNameKey(search);
  const fits = (recipe: RecipeDTO) => recipe.slot === 'ANY' || recipe.slot === target.slot;
  const recipes = week.recipes
    .filter((recipe) => !query || kitchenNameKey(recipe.name).includes(query))
    .sort(
      (left, right) =>
        Number(fits(right)) - Number(fits(left)) ||
        left.missingNow.length - right.missingNow.length ||
        left.plannedThisWeek - right.plannedThisWeek ||
        left.name.localeCompare(right.name, 'it')
    );
  const exactMatch = week.recipes.some((recipe) => kitchenNameKey(recipe.name) === query);

  return (
    <Sheet
      isOpen
      onClose={onClose}
      title={target.entryId ? 'Cambia piatto' : `${MEAL_SLOT_LABELS[target.slot]}`}
      subtitle={<span className="capitalize">{format(parseISO(target.date), 'EEEE d MMMM', { locale: it })}</span>}
      icon={<UtensilsCrossed className="w-5 h-5" />}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cerca o scrivi cosa si mangia"
          className="input min-h-11 pl-9 text-base sm:text-sm"
          autoFocus={window.matchMedia?.('(pointer: fine)').matches}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && search.trim()) {
              event.preventDefault();
              const first = recipes[0];
              if (first && kitchenNameKey(first.name) === query) onPickRecipe(first);
              else onPickFreeText(search.trim());
            }
          }}
        />
      </div>

      {search.trim() && !exactMatch && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPickFreeText(search.trim())}
            disabled={isSaving}
            className="btn btn-secondary min-h-11 gap-1.5 text-xs"
          >
            <NotebookPen className="w-4 h-4" /> Solo «{search.trim()}»
          </button>
          <button
            type="button"
            onClick={() => onCreateRecipe(search.trim())}
            disabled={isSaving}
            className="btn btn-primary min-h-11 gap-1.5 text-xs"
          >
            <ChefHat className="w-4 h-4" /> Crea il piatto
          </button>
        </div>
      )}

      {isSaving && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Salvo…
        </div>
      )}

      {week.recipes.length === 0 ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-center">
          <p className="text-sm text-slate-600">Non hai ancora piatti salvati.</p>
          <p className="mt-1 text-xs text-slate-400">Scrivi qui sopra il nome di cosa si mangia, oppure crealo con i suoi ingredienti.</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {recipes.map((recipe) => {
            const ready = recipe.missingNow.length === 0;
            return (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => onPickRecipe(recipe)}
                  disabled={isSaving}
                  className={cn(
                    'w-full rounded-xl border px-3 py-2.5 text-left flex items-center gap-3 transition-colors disabled:opacity-50',
                    fits(recipe) ? 'border-slate-200 hover:bg-slate-50' : 'border-dashed border-slate-200 opacity-70 hover:opacity-100'
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', ready ? 'bg-emerald-500' : 'bg-amber-400')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900 truncate">{recipe.name}</span>
                    <span className={cn('block text-[11px] truncate', ready ? 'text-emerald-700' : 'text-slate-500')}>
                      {recipe.ingredients.length === 0
                        ? 'senza ingredienti'
                        : ready
                          ? 'Hai tutto in casa'
                          : `Manca ${needsLabel(recipe.missingNow, 2)}`}
                    </span>
                  </span>
                  {recipe.plannedThisWeek > 0 && (
                    <span className="shrink-0 text-[10px] text-slate-400">{recipe.plannedThisWeek}× sett.</span>
                  )}
                  <Plus className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              </li>
            );
          })}
          {recipes.length === 0 && <li className="text-center text-xs text-slate-400 py-3">Nessun piatto con questo nome.</li>}
        </ul>
      )}
    </Sheet>
  );
}
