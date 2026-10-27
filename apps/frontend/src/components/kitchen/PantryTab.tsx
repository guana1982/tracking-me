import { useState } from 'react';
import { Minus, MoreHorizontal, Plus, Refrigerator, Search, ShoppingCart, X } from 'lucide-react';
import {
  formatKitchenQuantity,
  kitchenNameKey,
  KITCHEN_CATEGORY_META,
  type KitchenWeekDTO,
  type PantryItemDTO,
  type ParsedKitchenItem,
} from '@budget/shared';
import { cn } from '../../lib/utils';
import { groupByCategory, stepFor } from './kitchenUi';
import { QuickAddBar } from './QuickAddBar';

interface PantryTabProps {
  week: KitchenWeekDTO;
  isAdding: boolean;
  onAdd: (items: ParsedKitchenItem[]) => Promise<void>;
  onAdjust: (item: PantryItemDTO, delta: number) => void;
  onEdit: (item: PantryItemDTO) => void;
  onAddToList: (item: PantryItemDTO) => void;
}

function PantryRow({
  item,
  isOnList,
  onAdjust,
  onEdit,
  onAddToList,
}: {
  item: PantryItemDTO;
  isOnList: boolean;
  onAdjust: (delta: number) => void;
  onEdit: () => void;
  onAddToList: () => void;
}) {
  const step = stepFor(item.unit);
  const isEmpty = item.quantity <= 0;
  const free = Math.max(0, item.quantity - item.reserved);
  const allTaken = item.reserved > 0 && free <= 0;

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className={cn('text-sm text-slate-900 truncate', isEmpty && 'text-slate-400')}>{item.name}</p>
        <p className="text-[11px] truncate">
          {isEmpty ? (
            <span className="text-red-600 font-medium">Finito</span>
          ) : item.reserved > 0 ? (
            <span className={allTaken ? 'text-amber-700' : 'text-sky-700'}>
              {allTaken ? 'Tutto per il menù' : `${formatKitchenQuantity(item.reserved, item.unit)} per il menù`}
            </span>
          ) : (
            <span className="text-slate-400">libero</span>
          )}
        </p>
      </button>

      {isEmpty && !isOnList ? (
        <button
          type="button"
          onClick={onAddToList}
          className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-white px-2.5 min-h-9 text-xs font-medium"
        >
          <ShoppingCart className="w-3.5 h-3.5" /> In lista
        </button>
      ) : isEmpty ? (
        <span className="text-[11px] text-sky-600 font-medium">in lista</span>
      ) : null}

      <div className="flex items-center shrink-0 rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => onAdjust(-Math.min(step, item.quantity))}
          disabled={isEmpty}
          className="w-10 h-10 flex items-center justify-center text-slate-600 disabled:text-slate-200"
          aria-label={`Usa ${item.name}`}
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="min-w-[3.75rem] text-center text-sm font-semibold tabular-nums text-slate-900">
          {formatKitchenQuantity(item.quantity, item.unit)}
        </span>
        <button
          type="button"
          onClick={() => onAdjust(step)}
          className="w-10 h-10 flex items-center justify-center text-slate-600"
          aria-label={`Aggiungi ${item.name}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="hidden sm:flex w-8 h-8 shrink-0 rounded-lg items-center justify-center text-slate-400 hover:bg-slate-100"
        aria-label={`Modifica ${item.name}`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </li>
  );
}

export function PantryTab({ week, isAdding, onAdd, onAdjust, onEdit, onAddToList }: PantryTabProps) {
  const [search, setSearch] = useState('');
  const query = kitchenNameKey(search);
  const visible = week.pantry.filter((item) => !query || kitchenNameKey(item.name).includes(query));
  const inStock = visible.filter((item) => item.quantity > 0);
  const finished = visible.filter((item) => item.quantity <= 0);
  const onList = new Set(week.shopping.filter((item) => !item.checked).map((item) => kitchenNameKey(item.name)));

  const row = (item: PantryItemDTO) => (
    <PantryRow
      key={item.id}
      item={item}
      isOnList={onList.has(kitchenNameKey(item.name))}
      onAdjust={(delta) => onAdjust(item, delta)}
      onEdit={() => onEdit(item)}
      onAddToList={() => onAddToList(item)}
    />
  );

  return (
    <div className="space-y-3">
      <div className="card p-3">
        <QuickAddBar placeholder="Cosa hai in casa? es. pasta 1 kg" knownItems={week.knownItems} isBusy={isAdding} onAdd={onAdd} />
        <p className="mt-1.5 text-[11px] text-slate-400">
          Usa − quando consumi qualcosa fuori dal menù (colazioni, merende). I pasti segnati come cucinati scalano da soli.
        </p>
      </div>

      {week.pantry.length > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca in dispensa"
            className="input min-h-10 pl-9 pr-9"
            aria-label="Cerca in dispensa"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400"
              aria-label="Azzera la ricerca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {week.pantry.length === 0 ? (
        <div className="card text-center py-10">
          <Refrigerator className="w-8 h-8 mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-600">La dispensa è vuota.</p>
          <p className="mt-1 text-xs text-slate-400">
            Si riempie da sola quando spunti la lista della spesa. Puoi anche scrivere qui sopra cosa hai già in casa.
          </p>
        </div>
      ) : (
        <>
          {groupByCategory(inStock).map((group) => (
            <section key={group.category} className="card p-0 overflow-hidden">
              <h3 className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {KITCHEN_CATEGORY_META[group.category].emoji} {KITCHEN_CATEGORY_META[group.category].label}
              </h3>
              <ul className="divide-y divide-slate-100">{group.items.map(row)}</ul>
            </section>
          ))}
          {finished.length > 0 && (
            <section className="card p-0 overflow-hidden">
              <h3 className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-red-400">
                Finiti · {finished.length}
              </h3>
              <ul className="divide-y divide-slate-100">{finished.map(row)}</ul>
            </section>
          )}
          {visible.length === 0 && <p className="text-center text-sm text-slate-500 py-6">Niente con questo nome.</p>}
        </>
      )}
    </div>
  );
}
