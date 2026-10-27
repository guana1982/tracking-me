import { useState } from 'react';
import { ChefHat, Loader2, Plus, Search, Sparkles } from 'lucide-react';
import { kitchenNameKey, type CreateRecipeDTO, type KitchenWeekDTO, type RecipeDTO } from '@budget/shared';
import { cn } from '../../lib/utils';
import { needsLabel } from './kitchenUi';

/** A starting set, so the page is useful the first evening */
export const STARTER_RECIPES: CreateRecipeDTO[] = [
  {
    name: 'Pasta al pomodoro',
    slot: 'LUNCH',
    ingredients: [
      { name: 'Pasta', quantity: 400, unit: 'g' },
      { name: 'Passata di pomodoro', quantity: 1, unit: 'conf' },
      { name: 'Parmigiano', quantity: null, unit: 'pz' },
      { name: 'Olio', quantity: null, unit: 'pz' },
    ],
  },
  {
    name: 'Pollo al forno con patate',
    slot: 'DINNER',
    ingredients: [
      { name: 'Pollo', quantity: 1, unit: 'kg' },
      { name: 'Patate', quantity: 1, unit: 'kg' },
      { name: 'Rosmarino', quantity: null, unit: 'pz' },
      { name: 'Olio', quantity: null, unit: 'pz' },
    ],
  },
  {
    name: 'Frittata di zucchine',
    slot: 'DINNER',
    ingredients: [
      { name: 'Uova', quantity: 6, unit: 'pz' },
      { name: 'Zucchine', quantity: 500, unit: 'g' },
      { name: 'Parmigiano', quantity: null, unit: 'pz' },
    ],
  },
  {
    name: 'Risotto ai funghi',
    slot: 'LUNCH',
    ingredients: [
      { name: 'Riso', quantity: 320, unit: 'g' },
      { name: 'Funghi', quantity: 300, unit: 'g' },
      { name: 'Brodo', quantity: 1, unit: 'l' },
      { name: 'Parmigiano', quantity: null, unit: 'pz' },
    ],
  },
  {
    name: 'Minestrone',
    slot: 'DINNER',
    ingredients: [
      { name: 'Verdure per minestrone', quantity: 1, unit: 'conf' },
      { name: 'Patate', quantity: 300, unit: 'g' },
      { name: 'Pasta', quantity: 150, unit: 'g' },
    ],
  },
  {
    name: 'Pizza',
    slot: 'DINNER',
    ingredients: [
      { name: 'Farina', quantity: 500, unit: 'g' },
      { name: 'Lievito', quantity: 1, unit: 'conf' },
      { name: 'Passata di pomodoro', quantity: 1, unit: 'conf' },
      { name: 'Mozzarella', quantity: 2, unit: 'pz' },
    ],
  },
  {
    name: 'Cotolette e insalata',
    slot: 'DINNER',
    ingredients: [
      { name: 'Petto di pollo', quantity: 600, unit: 'g' },
      { name: 'Uova', quantity: 2, unit: 'pz' },
      { name: 'Pangrattato', quantity: null, unit: 'pz' },
      { name: 'Insalata', quantity: 1, unit: 'conf' },
    ],
  },
  {
    name: 'Pasta e lenticchie',
    slot: 'LUNCH',
    ingredients: [
      { name: 'Pasta', quantity: 250, unit: 'g' },
      { name: 'Lenticchie', quantity: 2, unit: 'conf' },
      { name: 'Carote', quantity: 2, unit: 'pz' },
    ],
  },
];

const SLOT_TAGS: Record<RecipeDTO['slot'], string> = { LUNCH: 'Pranzo', DINNER: 'Cena', ANY: 'Pranzo e cena' };

interface RecipesTabProps {
  week: KitchenWeekDTO;
  isInstalling: boolean;
  onNew: () => void;
  onEdit: (recipe: RecipeDTO) => void;
  onInstallStarters: () => void;
}

export function RecipesTab({ week, isInstalling, onNew, onEdit, onInstallStarters }: RecipesTabProps) {
  const [search, setSearch] = useState('');
  const query = kitchenNameKey(search);
  const visible = week.recipes.filter(
    (recipe) =>
      !query ||
      kitchenNameKey(recipe.name).includes(query) ||
      recipe.ingredients.some((ingredient) => kitchenNameKey(ingredient.name).includes(query))
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca un piatto o un ingrediente"
            className="input min-h-11 pl-9"
            aria-label="Cerca tra i piatti"
          />
        </div>
        <button type="button" onClick={onNew} className="btn btn-primary min-h-11 gap-1.5 shrink-0">
          <Plus className="w-4 h-4" /> Piatto
        </button>
      </div>

      {week.recipes.length === 0 ? (
        <div className="card text-center py-8">
          <ChefHat className="w-8 h-8 mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-600">Ancora nessun piatto.</p>
          <p className="mt-1 text-xs text-slate-400 max-w-xs mx-auto">
            Un piatto è una lista di ingredienti: serve a capire cosa comprare e cosa puoi cucinare con quello che hai.
          </p>
          <button
            type="button"
            onClick={onInstallStarters}
            disabled={isInstalling}
            className="btn btn-secondary mt-4 min-h-10 gap-2 text-sm"
          >
            {isInstalling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Parti da 8 piatti classici
          </button>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {visible.map((recipe) => {
            const ready = recipe.missingNow.length === 0;
            return (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => onEdit(recipe)}
                  className="card w-full p-3 text-left hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-slate-900 truncate">{recipe.name}</p>
                    {recipe.plannedThisWeek > 0 && (
                      <span className="shrink-0 rounded-full bg-slate-900 text-white px-1.5 py-0.5 text-[10px] font-semibold">
                        {recipe.plannedThisWeek}× in settimana
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {SLOT_TAGS[recipe.slot]} · {recipe.ingredients.length} ingredienti
                  </p>
                  <p className={cn('mt-1.5 text-xs truncate', ready ? 'text-emerald-700' : 'text-amber-700')}>
                    {recipe.ingredients.length === 0
                      ? 'Aggiungi gli ingredienti'
                      : ready
                        ? 'Puoi farlo con quello che hai'
                        : `Manca ${needsLabel(recipe.missingNow, 2)}`}
                  </p>
                </button>
              </li>
            );
          })}
          {visible.length === 0 && <p className="text-center text-sm text-slate-500 py-6 sm:col-span-2">Nessun piatto trovato.</p>}
        </ul>
      )}
    </div>
  );
}
