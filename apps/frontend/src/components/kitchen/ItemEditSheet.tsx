import { useEffect, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import {
  KITCHEN_CATEGORIES,
  KITCHEN_CATEGORY_META,
  KITCHEN_UNITS,
  type KitchenCategoryDTO,
  type KitchenUnitDTO,
} from '@budget/shared';
import { Sheet } from './Sheet';

export interface EditableItem {
  name: string;
  category: KitchenCategoryDTO;
  quantity: number | null;
  unit: KitchenUnitDTO;
}

interface ItemEditSheetProps {
  item: EditableItem | null;
  kind: 'shopping' | 'pantry';
  isSaving: boolean;
  onClose: () => void;
  onSave: (data: EditableItem) => Promise<void>;
  onDelete: () => Promise<void>;
}

/** The same small form for a line of the list and a row of the pantry */
export function ItemEditSheet({ item, kind, isSaving, onClose, onSave, onDelete }: ItemEditSheetProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<KitchenUnitDTO>('pz');
  const [category, setCategory] = useState<KitchenCategoryDTO>('OTHER');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setQuantity(item.quantity === null ? '' : String(item.quantity).replace('.', ','));
    setUnit(item.unit);
    setCategory(item.category);
    setError(null);
  }, [item]);

  if (!item) return null;

  const save = async () => {
    if (!name.trim()) {
      setError('Scrivi un nome.');
      return;
    }
    const parsed = quantity.trim() ? Number(quantity.replace(',', '.')) : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || (kind === 'shopping' && parsed === 0))) {
      setError('La quantità non è valida.');
      return;
    }
    if (kind === 'pantry' && parsed === null) {
      setError('Indica quanto ne hai (0 se è finito).');
      return;
    }
    await onSave({ name: name.trim(), quantity: parsed, unit, category });
  };

  return (
    <Sheet
      isOpen
      onClose={onClose}
      title={kind === 'shopping' ? 'Voce della spesa' : 'In dispensa'}
      icon={<Pencil className="w-5 h-5" />}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={() => void onDelete()} disabled={isSaving} className="btn btn-secondary min-h-11 gap-1.5 text-red-600">
            <Trash2 className="w-4 h-4" /> Elimina
          </button>
          <button type="button" onClick={() => void save()} disabled={isSaving} className="btn btn-primary min-h-11 flex-1 gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salva
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="item-name">Nome</label>
          <input id="item-name" value={name} onChange={(event) => setName(event.target.value)} className="input min-h-11 text-base sm:text-sm" />
        </div>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <div>
            <label className="label" htmlFor="item-quantity">Quantità</label>
            <input
              id="item-quantity"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="decimal"
              placeholder={kind === 'shopping' ? 'quanto basta' : '0'}
              className="input min-h-11 text-base sm:text-sm"
            />
          </div>
          <div>
            <label className="label" htmlFor="item-unit">Unità</label>
            <select id="item-unit" value={unit} onChange={(event) => setUnit(event.target.value as KitchenUnitDTO)} className="input min-h-11">
              {KITCHEN_UNITS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="item-category">Reparto</label>
          <select
            id="item-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as KitchenCategoryDTO)}
            className="input min-h-11"
          >
            {KITCHEN_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {KITCHEN_CATEGORY_META[value].emoji} {KITCHEN_CATEGORY_META[value].label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      </div>
    </Sheet>
  );
}
