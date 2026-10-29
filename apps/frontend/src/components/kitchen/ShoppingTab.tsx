import { useState } from 'react';
import { Check, ChefHat, Loader2, MoreHorizontal, PackageOpen, Plus, Repeat, ShoppingCart, Trash2 } from 'lucide-react';
import {
  formatKitchenQuantity,
  KITCHEN_CATEGORY_META,
  type KitchenWeekDTO,
  type ParsedKitchenItem,
  type ShoppingItemDTO,
} from '@budget/shared';
import { cn } from '../../lib/utils';
import { groupByCategory } from './kitchenUi';
import { QuickAddBar } from './QuickAddBar';

interface ShoppingTabProps {
  week: KitchenWeekDTO;
  isAdding: boolean;
  isAddingMissing: boolean;
  isClearing: boolean;
  isCopying: boolean;
  onAdd: (items: ParsedKitchenItem[]) => Promise<void>;
  onToggle: (item: ShoppingItemDTO) => void;
  onEdit: (item: ShoppingItemDTO) => void;
  onAddMissing: () => void;
  onClearChecked: () => void;
  onCopyPrevious: () => void;
}

function ShoppingRow({
  item,
  onToggle,
  onEdit,
}: {
  item: ShoppingItemDTO;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const amount = formatKitchenQuantity(item.quantity, item.unit);
  return (
    <li className="flex items-center">
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-left active:bg-slate-50"
        aria-pressed={item.checked}
      >
        <span
          className={cn(
            'w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors',
            item.checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-transparent'
          )}
        >
          <Check className="w-4 h-4" strokeWidth={3} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm text-slate-900 truncate', item.checked && 'text-slate-400 line-through')}>
            {item.name}
          </span>
          {item.fromPlan && !item.checked && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-600">
              <ChefHat className="w-3 h-3" /> per il menù
            </span>
          )}
        </span>
        {amount && (
          <span className={cn('shrink-0 text-sm tabular-nums text-slate-500', item.checked && 'text-slate-300')}>{amount}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="w-10 h-10 mr-1 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
        aria-label={`Modifica ${item.name}`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </li>
  );
}

export function ShoppingTab({
  week,
  isAdding,
  isAddingMissing,
  isClearing,
  isCopying,
  onAdd,
  onToggle,
  onEdit,
  onAddMissing,
  onClearChecked,
  onCopyPrevious,
}: ShoppingTabProps) {
  const [showChecked, setShowChecked] = useState(true);
  const open = week.shopping.filter((item) => !item.checked);
  const checked = week.shopping.filter((item) => item.checked);
  const onListKeys = new Set(open.map((item) => item.name.toLowerCase()));
  // Run out at home and not on the list yet: the usual reason to buy something
  const finished = week.pantry.filter((item) => item.quantity <= 0 && !onListKeys.has(item.name.toLowerCase()));
  const total = week.shopping.length;
  const progress = total > 0 ? Math.round((checked.length / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="card p-3">
        <QuickAddBar
          placeholder="latte 2 l, pane, 6 uova…"
          knownItems={week.knownItems}
          isBusy={isAdding}
          onAdd={onAdd}
        />
        <p className="mt-1.5 text-[11px] text-slate-400">
          Separa con la virgola per aggiungerne tanti. Quando spunti un prodotto finisce in dispensa.
        </p>
      </div>

      {week.toBuy.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <ChefHat className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-amber-900">Per il menù mancano {week.toBuy.length} cose</h3>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {week.toBuy.map((need) => (
                  <span key={`${need.name}-${need.unit}`} className="rounded-full bg-white border border-amber-200 px-2 py-0.5 text-xs text-amber-800">
                    {need.name}
                    {need.quantity !== null && <span className="opacity-70"> · {formatKitchenQuantity(need.quantity, need.unit)}</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onAddMissing}
            disabled={isAddingMissing}
            className="btn btn-primary mt-3 w-full min-h-10 gap-2 text-sm"
          >
            {isAddingMissing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Aggiungi tutto alla lista
          </button>
        </section>
      )}

      {finished.length > 0 && (
        <section className="card p-3">
          <div className="flex items-center gap-2">
            <PackageOpen className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Finiti in casa</h3>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {finished.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void onAdd([{ name: item.name, quantity: null, unit: item.unit, hasUnit: true }])}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Plus className="w-3 h-3" /> {item.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {total === 0 ? (
        <div className="card text-center py-10">
          <ShoppingCart className="w-8 h-8 mx-auto text-slate-300" />
          <p className="mt-2 text-sm text-slate-600">La lista di questa settimana è vuota.</p>
          <p className="mt-1 text-xs text-slate-400">Scrivi qui sopra, aggiungi i mancanti del menù o riparti dalla settimana scorsa.</p>
          <button
            type="button"
            onClick={onCopyPrevious}
            disabled={isCopying}
            className="btn btn-secondary mt-4 min-h-10 gap-2 text-sm"
          >
            {isCopying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />}
            Riparti dalla lista scorsa
          </button>
        </div>
      ) : (
        <>
          <div className="px-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                <span className="font-semibold text-slate-900">{checked.length}</span> di {total} nel carrello
              </span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {open.length === 0 ? (
            <div className="card text-center py-6">
              <p className="text-sm font-medium text-emerald-700">Spesa fatta! Tutto è in dispensa.</p>
            </div>
          ) : (
            groupByCategory(open).map((group) => (
              <section key={group.category} className="card p-0 overflow-hidden">
                <h3 className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {KITCHEN_CATEGORY_META[group.category].emoji} {KITCHEN_CATEGORY_META[group.category].label}
                </h3>
                <ul className="divide-y divide-slate-100">
                  {group.items.map((item) => (
                    <ShoppingRow key={item.id} item={item} onToggle={() => onToggle(item)} onEdit={() => onEdit(item)} />
                  ))}
                </ul>
              </section>
            ))
          )}

          {checked.length > 0 && (
            <section className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setShowChecked((value) => !value)}
                  className="flex-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                  aria-expanded={showChecked}
                >
                  Nel carrello · {checked.length}
                </button>
                <button
                  type="button"
                  onClick={onClearChecked}
                  disabled={isClearing}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                  title="Toglie dalla lista quello che hai già comprato; la dispensa non cambia"
                >
                  <Trash2 className="w-3 h-3" /> Togli i comprati
                </button>
              </div>
              {showChecked && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {checked.map((item) => (
                    <ShoppingRow key={item.id} item={item} onToggle={() => onToggle(item)} onEdit={() => onEdit(item)} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
