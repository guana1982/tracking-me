import { useEffect, useId, useState } from 'react';
import { ChefHat, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  KITCHEN_UNITS,
  parseKitchenLine,
  type CreateRecipeDTO,
  type IngredientDTO,
  type KitchenUnitDTO,
  type KitchenWeekDTO,
  type RecipeDTO,
  type RecipeSlotDTO,
} from '@budget/shared';
import { cn } from '../../lib/utils';
import { Sheet } from './Sheet';

interface RecipeEditorSheetProps {
  isOpen: boolean;
  recipe: RecipeDTO | null;
  /** Prefilled name when the dish is created from the meal picker */
  initialName?: string;
  knownItems: KitchenWeekDTO['knownItems'];
  isSaving: boolean;
  onClose: () => void;
  onSave: (data: CreateRecipeDTO) => Promise<void>;
  onDelete?: () => Promise<void>;
}

type Row = { key: number; name: string; quantity: string; unit: KitchenUnitDTO };

const SLOT_OPTIONS: Array<{ value: RecipeSlotDTO; label: string }> = [
  { value: 'LUNCH', label: 'Pranzo' },
  { value: 'DINNER', label: 'Cena' },
  { value: 'ANY', label: 'Entrambi' },
];

let rowKey = 0;
function toRow(ingredient: IngredientDTO): Row {
  rowKey += 1;
  return {
    key: rowKey,
    name: ingredient.name,
    quantity: ingredient.quantity === null ? '' : String(ingredient.quantity).replace('.', ','),
    unit: ingredient.unit,
  };
}

export function RecipeEditorSheet({
  isOpen,
  recipe,
  initialName,
  knownItems,
  isSaving,
  onClose,
  onSave,
  onDelete,
}: RecipeEditorSheetProps) {
  const listId = useId();
  const [name, setName] = useState('');
  const [slot, setSlot] = useState<RecipeSlotDTO>('ANY');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [quickLine, setQuickLine] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(recipe?.name ?? initialName ?? '');
    setSlot(recipe?.slot ?? 'ANY');
    setNotes(recipe?.notes ?? '');
    setRows((recipe?.ingredients ?? []).map(toRow));
    setQuickLine('');
    setError(null);
    setConfirmDelete(false);
  }, [isOpen, recipe, initialName]);

  const knownUnits = new Map(knownItems.map((item) => [item.name.toLowerCase(), item]));

  const addQuickLine = () => {
    const parsed = quickLine
      .split(/[,;\n]/)
      .map((part) => parseKitchenLine(part))
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map((item) => {
        const known = knownUnits.get(item.name.toLowerCase());
        return toRow({
          name: known?.name ?? item.name,
          quantity: item.quantity,
          unit: item.hasUnit || !known ? item.unit : known.unit,
        });
      });
    if (parsed.length === 0) return;
    setRows((current) => [...current, ...parsed]);
    setQuickLine('');
  };

  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Dai un nome al piatto.');
      return;
    }
    const ingredients: IngredientDTO[] = [];
    for (const row of rows) {
      if (!row.name.trim()) continue;
      const quantity = row.quantity.trim() ? Number(row.quantity.replace(',', '.')) : null;
      if (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0)) {
        setError(`La quantità di «${row.name}» non è un numero valido.`);
        return;
      }
      ingredients.push({ name: row.name.trim(), quantity, unit: row.unit });
    }
    setError(null);
    try {
      await onSave({ name: trimmed, slot, notes: notes.trim() || null, ingredients });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Salvataggio non riuscito.');
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={recipe ? 'Modifica piatto' : 'Nuovo piatto'}
      subtitle="Gli ingredienti servono per la spesa e per scalare la dispensa"
      icon={<ChefHat className="w-5 h-5" />}
      footer={
        <div className="flex gap-2">
          {recipe && onDelete && (
            <button
              type="button"
              onClick={() => (confirmDelete ? void onDelete() : setConfirmDelete(true))}
              disabled={isSaving}
              className={cn('btn min-h-11 gap-1.5', confirmDelete ? 'btn-danger' : 'btn-secondary text-red-600')}
            >
              <Trash2 className="w-4 h-4" />
              {confirmDelete ? 'Conferma' : <span className="hidden sm:inline">Elimina</span>}
            </button>
          )}
          <button type="button" onClick={() => void save()} disabled={isSaving} className="btn btn-primary min-h-11 flex-1 gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salva piatto
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="recipe-name">Nome</label>
          <input
            id="recipe-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="es. Lasagne della nonna"
            className="input min-h-11 text-base sm:text-sm"
          />
        </div>

        <div>
          <span className="label">Di solito a</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {SLOT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSlot(option.value)}
                className={cn(
                  'min-h-9 rounded-lg text-sm font-medium transition-colors',
                  slot === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Ingredienti per tutta la famiglia</span>
          <div className="flex gap-2">
            <input
              value={quickLine}
              onChange={(event) => setQuickLine(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addQuickLine();
                }
              }}
              list={listId}
              placeholder="spaghetti 400 g, uova 4, pepe"
              enterKeyHint="done"
              className="input min-h-11 flex-1 text-base sm:text-sm"
              aria-label="Aggiungi ingredienti"
            />
            <button type="button" onClick={addQuickLine} className="btn btn-secondary min-h-11 w-11 px-0" aria-label="Aggiungi ingrediente">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <datalist id={listId}>
            {knownItems.map((item) => (
              <option key={item.name} value={item.name} />
            ))}
          </datalist>
          <p className="mt-1 text-[11px] text-slate-400">Senza quantità vuol dire «basta che ci sia» (sale, olio, spezie).</p>

          {rows.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {rows.map((row) => (
                <li key={row.key} className="flex items-center gap-1.5">
                  <input
                    value={row.name}
                    onChange={(event) => updateRow(row.key, { name: event.target.value })}
                    list={listId}
                    className="input min-h-10 flex-1 min-w-0 px-2.5 text-sm"
                    aria-label="Ingrediente"
                  />
                  <input
                    value={row.quantity}
                    onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                    inputMode="decimal"
                    placeholder="q.b."
                    className="input min-h-10 w-16 px-2 text-sm text-right"
                    aria-label={`Quantità di ${row.name}`}
                  />
                  <select
                    value={row.unit}
                    onChange={(event) => updateRow(row.key, { unit: event.target.value as KitchenUnitDTO })}
                    className="input min-h-10 w-[4.5rem] px-1.5 text-sm"
                    aria-label={`Unità di ${row.name}`}
                  >
                    {KITCHEN_UNITS.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                    className="w-9 h-10 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
                    aria-label={`Togli ${row.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="label" htmlFor="recipe-notes">Note</label>
          <textarea
            id="recipe-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Facoltative: tempi, varianti, chi lo preferisce…"
            className="input text-base sm:text-sm"
          />
        </div>

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      </div>
    </Sheet>
  );
}
