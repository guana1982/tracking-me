import { useId, useState, type FormEvent } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { parseKitchenLine, type KitchenWeekDTO, type ParsedKitchenItem } from '@budget/shared';

interface QuickAddBarProps {
  placeholder: string;
  knownItems: KitchenWeekDTO['knownItems'];
  isBusy?: boolean;
  onAdd: (items: ParsedKitchenItem[]) => Promise<void>;
}

/**
 * One field for the whole list: "latte 2 l, pane, 6 uova" adds three lines.
 * A name already used elsewhere keeps the unit it was used with.
 */
export function QuickAddBar({ placeholder, knownItems, isBusy, onAdd }: QuickAddBarProps) {
  const [value, setValue] = useState('');
  const listId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const known = new Map(knownItems.map((item) => [item.name.toLowerCase(), item]));
    const items = value
      .split(/[,;\n]/)
      .map((part) => {
        const parsed = parseKitchenLine(part);
        if (!parsed) return null;
        const match = known.get(parsed.name.toLowerCase());
        // "latte 2" after "latte" was bought in litres: two litres, not two pieces
        return match && !parsed.hasUnit ? { ...parsed, name: match.name, unit: match.unit } : parsed;
      })
      .filter((item): item is ParsedKitchenItem => item !== null);
    if (items.length === 0) return;
    await onAdd(items);
    setValue('');
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        list={listId}
        enterKeyHint="done"
        autoComplete="off"
        className="input min-h-11 flex-1 text-base sm:text-sm"
        aria-label={placeholder}
      />
      <datalist id={listId}>
        {knownItems.map((item) => (
          <option key={item.name} value={item.name} />
        ))}
      </datalist>
      <button
        type="submit"
        disabled={isBusy || !value.trim()}
        className="btn btn-primary min-h-11 w-11 sm:w-auto px-0 sm:px-3 shrink-0"
        aria-label="Aggiungi"
      >
        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
        <span className="hidden sm:inline ml-1">Aggiungi</span>
      </button>
    </form>
  );
}
