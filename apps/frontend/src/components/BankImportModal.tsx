import { useRef, useState } from 'react';
import type { Category } from '@budget/shared';
import { CheckSquare, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { useCreateExpense } from '../hooks/useQueries';
import { formatCurrency, formatDate } from '../lib/utils';
import { parseBankStatement, type BankExpenseRow } from '../lib/bankStatement';

interface Props { isOpen: boolean; onClose: () => void; periodKey: string; category: Category }

export function BankImportModal({ isOpen, onClose, periodKey, category }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BankExpenseRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const createExpense = useCreateExpense(periodKey);
  if (!isOpen) return null;

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setError(''); setFileName(file.name);
    try {
      const parsed = await parseBankStatement(file);
      if (!parsed.length) throw new Error('Nessuna uscita valida trovata nella tabella movimenti.');
      setRows(parsed); setSelected(new Set(parsed.map((row) => row.id)));
    } catch (caught) {
      setRows([]); setSelected(new Set());
      setError(caught instanceof Error ? caught.message : 'Impossibile leggere il file.');
    }
  };
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const confirm = async () => {
    const confirmed = rows.filter((row) => selected.has(row.id));
    if (!confirmed.length) return;
    try {
      for (const row of confirmed) await createExpense.mutateAsync({
        date: row.date, category, label: row.description, amount: row.amount, importSource: 'BANK_FILE',
      });
      setRows([]); setSelected(new Set()); setFileName(''); onClose();
    } catch { setError('Importazione interrotta. Controlla la connessione e riprova le righe non presenti.'); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-200 p-5">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><FileSpreadsheet className="h-5 w-5 text-emerald-600" />Importa spese bancarie</h2><p className="mt-1 text-sm text-slate-500">Le righe selezionate saranno inserite in {category === 'NEEDS' ? 'Necessità' : 'Svago'}.</p></div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="overflow-y-auto p-5">
        <input ref={inputRef} className="hidden" type="file" accept=".csv,.xls,text/csv,application/vnd.ms-excel" onChange={(e) => void chooseFile(e.target.files?.[0])} />
        <button onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 px-4 py-5 font-medium text-emerald-700 hover:bg-emerald-50"><Upload className="h-5 w-5" />{fileName ? `Cambia file (${fileName})` : 'Scegli CSV o XLS'}</button>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {rows.length > 0 && <>
          <div className="mt-4 flex items-center justify-between"><p className="text-sm text-slate-600"><strong>{selected.size}</strong> di {rows.length} spese selezionate</p><button className="text-sm font-medium text-emerald-700" onClick={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((row) => row.id)))}>{selected.size === rows.length ? 'Deseleziona tutte' : 'Seleziona tutte'}</button></div>
          <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">{rows.map((row) => <label key={row.id} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-50"><input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-600" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-800">{row.description}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(row.date)}</p></div><strong className="whitespace-nowrap text-sm text-slate-800">{formatCurrency(row.amount)}</strong></label>)}</div>
        </>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4"><button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">Annulla</button><button disabled={!selected.size || createExpense.isPending} onClick={() => void confirm()} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{createExpense.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}Conferma {selected.size || ''}</button></div>
    </div>
  </div>;
}
