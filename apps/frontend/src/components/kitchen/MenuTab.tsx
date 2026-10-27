import { useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Check, ChefHat, Moon, Plus, Repeat, SkipForward, Sun, Trash2, Undo2, Pencil, Sparkles } from 'lucide-react';
import {
  formatKitchenQuantity,
  MEAL_SLOT_LABELS,
  MEAL_SLOTS,
  type KitchenWeekDTO,
  type MealPlanEntryDTO,
  type MealSlotDTO,
  type MealPlanStatusDTO,
} from '@budget/shared';
import { cn } from '../../lib/utils';
import { needsLabel } from './kitchenUi';

interface MenuTabProps {
  week: KitchenWeekDTO;
  selectedDate: string;
  busyId: string | null;
  isCopyingPlan: boolean;
  onSelectDate: (date: string) => void;
  onAddMeal: (date: string, slot: MealSlotDTO) => void;
  onChangeMeal: (entry: MealPlanEntryDTO) => void;
  onSetStatus: (entry: MealPlanEntryDTO, status: MealPlanStatusDTO) => void;
  onDeleteMeal: (entry: MealPlanEntryDTO) => void;
  onUseIdea: (recipeId: string) => void;
  onCopyPreviousPlan: () => void;
}

const SLOT_ICONS: Record<MealSlotDTO, typeof Sun> = { LUNCH: Sun, DINNER: Moon };

function availabilityBadge(entry: MealPlanEntryDTO): { label: string; className: string } | null {
  if (entry.status === 'COOKED') return { label: 'Cucinato', className: 'bg-emerald-100 text-emerald-700' };
  if (entry.status === 'SKIPPED') return { label: 'Saltato', className: 'bg-slate-100 text-slate-500' };
  switch (entry.availability) {
    case 'READY':
      return { label: 'Hai tutto', className: 'bg-emerald-50 text-emerald-700' };
    case 'ON_LIST':
      return { label: 'Ingredienti in lista', className: 'bg-sky-50 text-sky-700' };
    case 'MISSING':
      return { label: 'Manca qualcosa', className: 'bg-amber-100 text-amber-800' };
    case 'PAST':
      return { label: 'Cucinato?', className: 'bg-amber-50 text-amber-700' };
    default:
      return null;
  }
}

function MealRow({
  entry,
  recipeIngredients,
  isBusy,
  onChange,
  onSetStatus,
  onDelete,
}: {
  entry: MealPlanEntryDTO;
  recipeIngredients: string | null;
  isBusy: boolean;
  onChange: () => void;
  onSetStatus: (status: MealPlanStatusDTO) => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const badge = availabilityBadge(entry);
  const isCooked = entry.status === 'COOKED';
  const isSkipped = entry.status === 'SKIPPED';

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 p-2">
        <button
          type="button"
          onClick={() => onSetStatus(isCooked ? 'PLANNED' : 'COOKED')}
          disabled={isBusy || isSkipped}
          className={cn(
            'w-10 h-10 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-40',
            isCooked
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-slate-300 text-transparent hover:border-emerald-400 hover:text-emerald-400'
          )}
          aria-label={isCooked ? `Segna ${entry.title} come non cucinato` : `Segna ${entry.title} come cucinato`}
          title={isCooked ? 'Annulla: gli ingredienti tornano in dispensa' : 'Cucinato: scala gli ingredienti dalla dispensa'}
        >
          <Check className="w-5 h-5" strokeWidth={3} />
        </button>

        <button type="button" onClick={() => setIsOpen((open) => !open)} className="min-w-0 flex-1 text-left py-1">
          <p className={cn('text-sm font-medium text-slate-900 truncate', (isCooked || isSkipped) && 'text-slate-400 line-through')}>
            {entry.title}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
            {badge && (
              <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', badge.className)}>
                {badge.label}
              </span>
            )}
            {entry.missing.length > 0 && entry.status === 'PLANNED' && (
              <span className="truncate text-[11px] text-slate-500">{needsLabel(entry.missing, 2)}</span>
            )}
            {!entry.recipeId && entry.status === 'PLANNED' && (
              <span className="truncate text-[11px] text-slate-400">senza ricetta</span>
            )}
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-slate-100 px-3 py-2.5 space-y-2.5">
          {entry.missing.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Manca</p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {entry.missing.map((need) => (
                  <li key={`${need.name}-${need.unit}`} className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-800">
                    {need.name}
                    {need.quantity !== null && <span className="opacity-70"> · {formatKitchenQuantity(need.quantity, need.unit)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recipeIngredients && (
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Ingredienti: </span>
              {recipeIngredients}
            </p>
          )}
          <div className="grid grid-cols-3 gap-1.5">
            <button type="button" onClick={onChange} className="btn btn-secondary min-h-9 px-2 text-xs gap-1">
              <Pencil className="w-3.5 h-3.5" /> Cambia
            </button>
            <button
              type="button"
              onClick={() => onSetStatus(isSkipped ? 'PLANNED' : 'SKIPPED')}
              disabled={isBusy}
              className="btn btn-secondary min-h-9 px-2 text-xs gap-1"
            >
              {isSkipped ? <Undo2 className="w-3.5 h-3.5" /> : <SkipForward className="w-3.5 h-3.5" />}
              {isSkipped ? 'Ripristina' : 'Salta'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isBusy}
              className="btn btn-secondary min-h-9 px-2 text-xs gap-1 text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" /> Togli
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function MenuTab({
  week,
  selectedDate,
  busyId,
  isCopyingPlan,
  onSelectDate,
  onAddMeal,
  onChangeMeal,
  onSetStatus,
  onDeleteMeal,
  onUseIdea,
  onCopyPreviousPlan,
}: MenuTabProps) {
  const recipes = new Map(week.recipes.map((recipe) => [recipe.id, recipe]));
  const days = Array.from({ length: 7 }, (_, index) => format(addDays(parseISO(week.weekStart), index), 'yyyy-MM-dd'));
  const dayEntries = week.plan.filter((entry) => entry.date === selectedDate);
  const isPastDay = selectedDate < week.today;
  const ingredientsOf = (entry: MealPlanEntryDTO) => {
    const recipe = entry.recipeId ? recipes.get(entry.recipeId) : undefined;
    if (!recipe || recipe.ingredients.length === 0) return null;
    return recipe.ingredients
      .map((ingredient) => {
        const amount = formatKitchenQuantity(ingredient.quantity, ingredient.unit);
        return amount ? `${ingredient.name} ${amount}` : ingredient.name;
      })
      .join(', ');
  };

  return (
    <div className="space-y-4">
      {/* The selected day */}
      <section className="grid gap-3 sm:grid-cols-2">
        {MEAL_SLOTS.map((slot) => {
          const Icon = SLOT_ICONS[slot];
          const entries = dayEntries.filter((entry) => entry.slot === slot);
          return (
            <div key={slot} className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('w-4 h-4', slot === 'LUNCH' ? 'text-amber-500' : 'text-indigo-500')} />
                <h3 className="text-sm font-semibold text-slate-900">{MEAL_SLOT_LABELS[slot]}</h3>
                <span className="text-xs text-slate-400 capitalize">
                  {format(parseISO(selectedDate), 'EEEE d', { locale: it })}
                </span>
              </div>
              {entries.length > 0 && (
                <ul className="space-y-2 mb-2">
                  {entries.map((entry) => (
                    <MealRow
                      key={entry.id}
                      entry={entry}
                      recipeIngredients={ingredientsOf(entry)}
                      isBusy={busyId === entry.id}
                      onChange={() => onChangeMeal(entry)}
                      onSetStatus={(status) => onSetStatus(entry, status)}
                      onDelete={() => onDeleteMeal(entry)}
                    />
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => onAddMeal(selectedDate, slot)}
                className={cn(
                  'w-full min-h-11 rounded-xl border-2 border-dashed text-sm font-medium flex items-center justify-center gap-1.5 transition-colors',
                  entries.length === 0
                    ? 'border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                    : 'border-slate-200 text-slate-400 hover:text-slate-600 min-h-9 text-xs'
                )}
              >
                <Plus className="w-4 h-4" />
                {entries.length === 0
                  ? isPastDay
                    ? 'Cosa avete mangiato?'
                    : 'Cosa si mangia?'
                  : 'Aggiungi un altro piatto'}
              </button>
            </div>
          );
        })}
      </section>

      {/* Ideas from what is left */}
      {week.ideas.length > 0 && week.weekEnd >= week.today && (
        <section className="card p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-fuchsia-500" />
            <h3 className="text-sm font-semibold text-slate-900">Con quello che resta puoi fare</h3>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Tocca un piatto per metterlo sul primo pasto libero.</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {week.ideas.map((idea) => (
              <button
                key={idea.recipeId}
                type="button"
                onClick={() => onUseIdea(idea.recipeId)}
                className={cn(
                  'shrink-0 max-w-[14rem] rounded-xl border px-3 py-2 text-left transition-colors',
                  idea.missing.length === 0
                    ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                )}
              >
                <p className="text-sm font-medium text-slate-900 truncate">{idea.name}</p>
                <p className={cn('text-[11px] truncate', idea.missing.length === 0 ? 'text-emerald-700' : 'text-slate-500')}>
                  {idea.missing.length === 0 ? 'Hai tutto' : `Manca ${needsLabel(idea.missing, 2)}`}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* The whole week, one line per day */}
      <section className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
          <ChefHat className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900 flex-1">La settimana</h3>
          <button
            type="button"
            onClick={onCopyPreviousPlan}
            disabled={isCopyingPlan}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="Copia i pasti della settimana scorsa nei pranzi e nelle cene ancora liberi"
          >
            <Repeat className="w-3 h-3" /> Ripeti scorsa
          </button>
        </div>
        <ul className="divide-y divide-slate-100">
          {days.map((day) => {
            const entries = week.plan.filter((entry) => entry.date === day && entry.status !== 'SKIPPED');
            const isSelected = day === selectedDate;
            return (
              <li key={day}>
                <button
                  type="button"
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors',
                    isSelected ? 'bg-slate-900/[0.04]' : 'hover:bg-slate-50',
                    day < week.today && 'opacity-60'
                  )}
                >
                  <div className="w-11 shrink-0 text-center">
                    <p className={cn('text-[10px] uppercase', day === week.today ? 'text-blue-600 font-semibold' : 'text-slate-400')}>
                      {format(parseISO(day), 'EEE', { locale: it })}
                    </p>
                    <p className="text-sm font-semibold text-slate-900">{format(parseISO(day), 'd')}</p>
                  </div>
                  <div className="min-w-0 flex-1 grid grid-cols-2 gap-2">
                    {MEAL_SLOTS.map((slot) => {
                      const slotEntries = entries.filter((entry) => entry.slot === slot);
                      const hasProblem = slotEntries.some((entry) => entry.availability === 'MISSING');
                      const onList = slotEntries.some((entry) => entry.availability === 'ON_LIST');
                      const allCooked = slotEntries.length > 0 && slotEntries.every((entry) => entry.status === 'COOKED');
                      return (
                        <div key={slot} className="min-w-0">
                          <p className="text-[10px] text-slate-400">{MEAL_SLOT_LABELS[slot]}</p>
                          {slotEntries.length === 0 ? (
                            <p className="text-xs text-slate-300">—</p>
                          ) : (
                            <p className="flex items-center gap-1 text-xs text-slate-700 min-w-0">
                              <span
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full shrink-0',
                                  allCooked ? 'bg-emerald-500' : hasProblem ? 'bg-amber-500' : onList ? 'bg-sky-500' : 'bg-slate-300'
                                )}
                              />
                              <span className="truncate">{slotEntries.map((entry) => entry.title).join(' + ')}</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
