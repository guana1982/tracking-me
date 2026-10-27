import { useCallback, useEffect, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { ChefHat, Loader2, Refrigerator, ShoppingCart, UtensilsCrossed } from 'lucide-react';
import {
  guessKitchenCategory,
  MEAL_SLOT_LABELS,
  MEAL_SLOTS,
  type CreateRecipeDTO,
  type MealPlanEntryDTO,
  type MealPlanStatusDTO,
  type PantryItemDTO,
  type ParsedKitchenItem,
  type RecipeDTO,
  type ShoppingItemDTO,
} from '@budget/shared';
import { MonthPanel, WeekStrip } from '../components/calendar/WeekCalendar';
import { CoverageCard } from '../components/kitchen/CoverageCard';
import { ItemEditSheet, type EditableItem } from '../components/kitchen/ItemEditSheet';
import { MealPickerSheet, type MealPickerTarget } from '../components/kitchen/MealPickerSheet';
import { MenuTab } from '../components/kitchen/MenuTab';
import { PantryGauge } from '../components/kitchen/PantryGauge';
import { PantryTab } from '../components/kitchen/PantryTab';
import { RecipeEditorSheet } from '../components/kitchen/RecipeEditorSheet';
import { RecipesTab, STARTER_RECIPES } from '../components/kitchen/RecipesTab';
import { ShoppingTab } from '../components/kitchen/ShoppingTab';
import { dayLabel } from '../components/kitchen/kitchenUi';
import {
  useAddMissingToList,
  useAdjustPantryItem,
  useClearCheckedShopping,
  useCopyPreviousList,
  useCopyPreviousPlan,
  useCreatePantryItem,
  useCreatePlanEntry,
  useCreateRecipe,
  useCreateShoppingItem,
  useDeletePantryItem,
  useDeletePlanEntry,
  useDeleteRecipe,
  useDeleteShoppingItem,
  useKitchenDayMarks,
  useKitchenWeek,
  useUpdatePantryItem,
  useUpdatePlanEntry,
  useUpdateRecipe,
  useUpdateShoppingItem,
} from '../hooks/useKitchenQueries';
import { cn } from '../lib/utils';

type Tab = 'menu' | 'shopping' | 'pantry' | 'recipes';

const TAB_STORAGE_KEY = 'kitchen-tab';

function readStoredTab(): Tab {
  try {
    const value = window.localStorage.getItem(TAB_STORAGE_KEY);
    return value === 'shopping' || value === 'pantry' || value === 'recipes' ? value : 'menu';
  } catch {
    return 'menu';
  }
}

type RecipeEditorState = {
  recipe: RecipeDTO | null;
  initialName?: string;
  /** Put the new dish straight on this meal once saved */
  then?: MealPickerTarget;
} | null;

type ItemEditorState =
  | { kind: 'shopping'; item: ShoppingItemDTO }
  | { kind: 'pantry'; item: PantryItemDTO }
  | null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Operazione non riuscita. Riprova.';
}

/**
 * Weekly shopping and family meals. The menu is the plan, the shopping list is
 * what the plan still needs, and the pantry is what the shopping turned into:
 * ticking a line stocks the pantry, cooking a meal empties it, and the card at
 * the top says whether what is left holds until Sunday.
 */
export function Kitchen() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const [tab, setTabState] = useState<Tab>(readStoredTab);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [picker, setPicker] = useState<MealPickerTarget | null>(null);
  const [recipeEditor, setRecipeEditor] = useState<RecipeEditorState>(null);
  const [itemEditor, setItemEditor] = useState<ItemEditorState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  const week = useKitchenWeek(selectedDate);
  const data = week.data;

  const createPlan = useCreatePlanEntry();
  const updatePlan = useUpdatePlanEntry();
  const deletePlan = useDeletePlanEntry();
  const copyPlan = useCopyPreviousPlan();
  const createShopping = useCreateShoppingItem();
  const updateShopping = useUpdateShoppingItem();
  const deleteShopping = useDeleteShoppingItem();
  const addMissing = useAddMissingToList();
  const clearChecked = useClearCheckedShopping();
  const copyList = useCopyPreviousList();
  const createPantry = useCreatePantryItem();
  const updatePantry = useUpdatePantryItem();
  const adjustPantry = useAdjustPantryItem();
  const deletePantry = useDeletePantryItem();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const setTab = (value: Tab) => {
    setTabState(value);
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, value);
    } catch {
      // Remembering the tab is a convenience; without storage it just resets
    }
  };

  const say = (text: string) => setNotice({ text, tone: 'ok' });
  const fail = (error: unknown) => setNotice({ text: errorMessage(error), tone: 'error' });

  const run = async <T,>(action: () => Promise<T>, success?: (result: T) => string | null) => {
    try {
      const result = await action();
      const text = success?.(result);
      if (text) say(text);
      return result;
    } catch (error) {
      fail(error);
      return undefined;
    }
  };

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setIsMonthOpen(false);
  }, []);

  // ---- Menu ----

  const placeRecipe = async (target: MealPickerTarget, recipeId: string | null, title?: string) => {
    if (target.entryId) {
      await run(() =>
        updatePlan.mutateAsync({ id: target.entryId!, data: recipeId ? { recipeId } : { recipeId: null, title } })
      );
    } else {
      await run(() => createPlan.mutateAsync({ date: target.date, slot: target.slot, recipeId, title }));
    }
    setPicker(null);
  };

  const setMealStatus = async (entry: MealPlanEntryDTO, status: MealPlanStatusDTO) => {
    setBusyId(entry.id);
    await run(
      () => updatePlan.mutateAsync({ id: entry.id, data: { status } }),
      () =>
        status === 'COOKED' && entry.recipeId
          ? 'Buon appetito! Ingredienti scalati dalla dispensa.'
          : entry.status === 'COOKED'
            ? 'Annullato: gli ingredienti sono tornati in dispensa.'
            : null
    );
    setBusyId(null);
  };

  const removeMeal = async (entry: MealPlanEntryDTO) => {
    setBusyId(entry.id);
    await run(() => deletePlan.mutateAsync(entry.id), () => `«${entry.title}» tolto dal menù.`);
    setBusyId(null);
  };

  /** An idea goes on the first lunch or dinner still free, from the day on screen */
  const planIdea = async (recipeId: string) => {
    if (!data) return;
    const recipe = data.recipes.find((item) => item.id === recipeId);
    let day = selectedDate > data.today ? selectedDate : data.today;
    if (day < data.weekStart) day = data.weekStart;
    for (; day <= data.weekEnd; day = format(addDays(parseISO(day), 1), 'yyyy-MM-dd')) {
      for (const slot of MEAL_SLOTS) {
        if (recipe && recipe.slot !== 'ANY' && recipe.slot !== slot) continue;
        const taken = data.plan.some((entry) => entry.date === day && entry.slot === slot && entry.status !== 'SKIPPED');
        if (taken) continue;
        await run(
          () => createPlan.mutateAsync({ date: day, slot, recipeId }),
          () => `«${recipe?.name ?? 'Piatto'}» messo su ${dayLabel(day, data.today)} a ${MEAL_SLOT_LABELS[slot].toLowerCase()}.`
        );
        setSelectedDate(day);
        return;
      }
    }
    setPicker({ date: selectedDate, slot: 'DINNER' });
  };

  // ---- Shopping ----

  const addToList = (items: ParsedKitchenItem[]) =>
    run(
      async () => {
        for (const item of items) {
          await createShopping.mutateAsync({
            weekStart: data!.weekStart,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
          });
        }
      },
      () => (items.length === 1 ? `«${items[0].name}» in lista.` : `${items.length} prodotti in lista.`)
    ).then(() => undefined);

  const toggleShopping = (item: ShoppingItemDTO) =>
    void run(() => updateShopping.mutateAsync({ id: item.id, data: { checked: !item.checked } }));

  // ---- Pantry ----

  const addToPantry = (items: ParsedKitchenItem[]) =>
    run(
      async () => {
        for (const item of items) {
          await createPantry.mutateAsync({ name: item.name, quantity: item.quantity ?? 1, unit: item.unit });
        }
      },
      () => (items.length === 1 ? `«${items[0].name}» in dispensa.` : `${items.length} prodotti in dispensa.`)
    ).then(() => undefined);

  // ---- Dishes ----

  const saveRecipe = async (value: CreateRecipeDTO) => {
    const editing = recipeEditor;
    if (editing?.recipe) {
      await updateRecipe.mutateAsync({ id: editing.recipe.id, data: value });
      say('Piatto salvato.');
    } else {
      const created = await createRecipe.mutateAsync(value);
      if (editing?.then) {
        await run(() => createPlan.mutateAsync({ date: editing.then!.date, slot: editing.then!.slot, recipeId: created.id }));
        say(`«${value.name}» creato e messo nel menù.`);
      } else {
        say(`«${value.name}» aggiunto ai piatti.`);
      }
    }
    setRecipeEditor(null);
  };

  const installStarters = async () => {
    setIsInstalling(true);
    await run(
      async () => {
        for (const recipe of STARTER_RECIPES) await createRecipe.mutateAsync(recipe);
      },
      () => 'Fatto: 8 piatti da cui partire. Modificali come li fate voi.'
    );
    setIsInstalling(false);
  };

  // ---- Item editor ----

  const saveItem = async (value: EditableItem) => {
    if (!itemEditor) return;
    if (itemEditor.kind === 'shopping') {
      await run(() => updateShopping.mutateAsync({ id: itemEditor.item.id, data: value }));
    } else {
      await run(() =>
        updatePantry.mutateAsync({
          id: itemEditor.item.id,
          data: { name: value.name, category: value.category, quantity: value.quantity ?? 0, unit: value.unit },
        })
      );
    }
    setItemEditor(null);
  };

  const deleteItem = async () => {
    if (!itemEditor) return;
    if (itemEditor.kind === 'shopping') await run(() => deleteShopping.mutateAsync(itemEditor.item.id));
    else await run(() => deletePantry.mutateAsync(itemEditor.item.id));
    setItemEditor(null);
  };

  const openShopping = data?.shopping.filter((item) => !item.checked).length ?? 0;
  const pantryFinished = data?.pantry.filter((item) => item.quantity <= 0).length ?? 0;
  const tabs: Array<{ key: Tab; label: string; icon: typeof ChefHat; badge?: number; badgeTone?: string }> = [
    { key: 'menu', label: 'Menù', icon: UtensilsCrossed },
    { key: 'shopping', label: 'Spesa', icon: ShoppingCart, badge: openShopping, badgeTone: 'bg-sky-500' },
    { key: 'pantry', label: 'Dispensa', icon: Refrigerator, badge: pantryFinished, badgeTone: 'bg-red-500' },
    { key: 'recipes', label: 'Piatti', icon: ChefHat },
  ];

  return (
    <div className="sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56 pb-28 sm:pb-12">
      {/* On a wide screen the gauge takes the empty band left of the page; the page itself stays centred */}
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,42rem)_minmax(0,1fr)] xl:gap-8">
        <aside className="hidden xl:block">
          {data && (
            <div className="sticky top-4 ml-auto max-w-sm">
              <PantryGauge week={data} onOpenShopping={() => setTab('shopping')} />
            </div>
          )}
        </aside>

        <div className="min-w-0">
          <header className="mb-3">
            <WeekStrip
              useMarks={useKitchenDayMarks}
              selectedDate={selectedDate}
              today={today}
              isMonthOpen={isMonthOpen}
              onToggleMonth={() => setIsMonthOpen((open) => !open)}
              onSelectDate={selectDate}
            />
          </header>

          {week.isLoading || !data ? (
            week.isError ? (
              <div className="card text-sm text-red-600">Impossibile caricare la settimana. Riprova tra poco.</div>
            ) : (
              <div className="card min-h-48 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            )
          ) : (
            <div className="max-w-2xl mx-auto space-y-3">
              <CoverageCard
                week={data}
                isAddingMissing={addMissing.isPending}
                isCopyingPlan={copyPlan.isPending}
                onAddMissing={() =>
                  void run(() => addMissing.mutateAsync(selectedDate), (result) => `${result.added} prodotti aggiunti alla lista.`)
                }
                onOpenShopping={() => setTab('shopping')}
                onCopyPreviousPlan={() =>
                  void run(
                    () => copyPlan.mutateAsync(selectedDate),
                    (result) => (result.added > 0 ? `${result.added} pasti copiati dalla settimana scorsa.` : 'La settimana scorsa era vuota.')
                  )
                }
                onOpenRecipes={() => setTab('recipes')}
              />

              <div className="xl:hidden">
                <PantryGauge week={data} compact onOpenShopping={() => setTab('shopping')} />
              </div>

              <nav
                className="sticky top-14 md:top-0 z-20 -mx-3 sm:mx-0 px-3 sm:px-0 py-2 bg-slate-50/95 backdrop-blur"
                aria-label="Sezioni"
              >
                <div className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-200/70 p-1">
                  {tabs.map((entry) => {
                    const Icon = entry.icon;
                    const isActive = tab === entry.key;
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => setTab(entry.key)}
                        className={cn(
                          'relative min-h-11 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 text-[11px] sm:text-sm font-medium transition-colors',
                          isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        )}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon className="w-4 h-4" />
                        {entry.label}
                        {entry.badge ? (
                          <span
                            className={cn(
                              'absolute top-1 right-1.5 sm:static min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 text-white font-semibold',
                              entry.badgeTone
                            )}
                          >
                            {entry.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </nav>

              {tab === 'menu' && (
                <MenuTab
                  week={data}
                  selectedDate={selectedDate}
                  busyId={busyId}
                  isCopyingPlan={copyPlan.isPending}
                  onSelectDate={setSelectedDate}
                  onAddMeal={(date, slot) => setPicker({ date, slot })}
                  onChangeMeal={(entry) => setPicker({ date: entry.date, slot: entry.slot, entryId: entry.id })}
                  onSetStatus={(entry, status) => void setMealStatus(entry, status)}
                  onDeleteMeal={(entry) => void removeMeal(entry)}
                  onUseIdea={(recipeId) => void planIdea(recipeId)}
                  onCopyPreviousPlan={() =>
                    void run(
                      () => copyPlan.mutateAsync(selectedDate),
                      (result) =>
                        result.added > 0 ? `${result.added} pasti copiati dalla settimana scorsa.` : 'Niente da copiare nei pasti liberi.'
                    )
                  }
                />
              )}

              {tab === 'shopping' && (
                <ShoppingTab
                  week={data}
                  isAdding={createShopping.isPending}
                  isAddingMissing={addMissing.isPending}
                  isClearing={clearChecked.isPending}
                  isCopying={copyList.isPending}
                  onAdd={addToList}
                  onToggle={toggleShopping}
                  onEdit={(item) => setItemEditor({ kind: 'shopping', item })}
                  onAddMissing={() =>
                    void run(() => addMissing.mutateAsync(selectedDate), (result) => `${result.added} prodotti aggiunti alla lista.`)
                  }
                  onClearChecked={() =>
                    void run(() => clearChecked.mutateAsync(selectedDate), (result) => `${result.removed} voci tolte dalla lista.`)
                  }
                  onCopyPrevious={() =>
                    void run(
                      () => copyList.mutateAsync(selectedDate),
                      (result) => (result.added > 0 ? `${result.added} prodotti dalla lista scorsa.` : 'La lista scorsa era vuota.')
                    )
                  }
                />
              )}

              {tab === 'pantry' && (
                <PantryTab
                  week={data}
                  isAdding={createPantry.isPending}
                  onAdd={addToPantry}
                  onAdjust={(item, delta) => void run(() => adjustPantry.mutateAsync({ id: item.id, delta }))}
                  onEdit={(item) => setItemEditor({ kind: 'pantry', item })}
                  onAddToList={(item) =>
                    void addToList([{ name: item.name, quantity: null, unit: item.unit, hasUnit: true }])
                  }
                />
              )}

              {tab === 'recipes' && (
                <RecipesTab
                  week={data}
                  isInstalling={isInstalling}
                  onNew={() => setRecipeEditor({ recipe: null })}
                  onEdit={(recipe) => setRecipeEditor({ recipe })}
                  onInstallStarters={() => void installStarters()}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {isMonthOpen && (
        <div className="fixed z-30 bottom-20 right-3 sm:bottom-4 sm:right-4 w-80 max-w-[calc(100vw-1.5rem)]">
          <MonthPanel
            useMarks={useKitchenDayMarks}
            selectedDate={selectedDate}
            today={today}
            onClose={() => setIsMonthOpen(false)}
            onSelectDate={selectDate}
            legend={
              <>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-500" />pasti pianificati</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />manca qualcosa</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />tutto cucinato</span>
              </>
            }
          />
        </div>
      )}

      {data && (
        <>
          <MealPickerSheet
            target={picker}
            week={data}
            isSaving={createPlan.isPending || updatePlan.isPending}
            onClose={() => setPicker(null)}
            onPickRecipe={(recipe) => picker && void placeRecipe(picker, recipe.id)}
            onPickFreeText={(title) => picker && void placeRecipe(picker, null, title)}
            onCreateRecipe={(name) => {
              const target = picker ?? undefined;
              setPicker(null);
              setRecipeEditor({ recipe: null, initialName: name, then: target?.entryId ? undefined : target });
            }}
          />

          <RecipeEditorSheet
            isOpen={recipeEditor !== null}
            recipe={recipeEditor?.recipe ?? null}
            initialName={recipeEditor?.initialName}
            knownItems={data.knownItems}
            isSaving={createRecipe.isPending || updateRecipe.isPending}
            onClose={() => setRecipeEditor(null)}
            onSave={saveRecipe}
            onDelete={
              recipeEditor?.recipe
                ? async () => {
                    const recipe = recipeEditor.recipe!;
                    await run(() => deleteRecipe.mutateAsync(recipe.id), () => `«${recipe.name}» eliminato.`);
                    setRecipeEditor(null);
                  }
                : undefined
            }
          />

          <ItemEditSheet
            kind={itemEditor?.kind ?? 'shopping'}
            item={
              itemEditor
                ? {
                    name: itemEditor.item.name,
                    category: itemEditor.item.category ?? guessKitchenCategory(itemEditor.item.name),
                    quantity: itemEditor.item.quantity,
                    unit: itemEditor.item.unit,
                  }
                : null
            }
            isSaving={updateShopping.isPending || updatePantry.isPending || deleteShopping.isPending || deletePantry.isPending}
            onClose={() => setItemEditor(null)}
            onSave={saveItem}
            onDelete={deleteItem}
          />
        </>
      )}

      {notice && (
        <div
          role="status"
          className={cn(
            'fixed z-[60] left-1/2 -translate-x-1/2 bottom-20 sm:bottom-6 max-w-[calc(100vw-2rem)] rounded-full px-4 py-2 text-sm shadow-lg',
            notice.tone === 'ok' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'
          )}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
