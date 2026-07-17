import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useCreateQuickLog } from '../../hooks/useFoodQueries';

interface QuickLogBarProps {
  onSaved: (message: string) => void;
}

/**
 * Always-visible free-text bar: one tap, type or dictate, send. No fields,
 * no dropdowns, no confirmation - classification happens silently.
 */
export function QuickLogBar({ onSaved }: QuickLogBarProps) {
  const [text, setText] = useState('');
  const createLog = useCreateQuickLog();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || createLog.isPending) return;
    await createLog.mutateAsync({ text: trimmed });
    setText('');
    onSaved('Nota salvata');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Come ti senti? Allenamento, sonno, sensazioni..."
        className="input flex-1"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        enterKeyHint="send"
      />
      <button
        type="submit"
        disabled={!text.trim() || createLog.isPending}
        className="btn btn-primary p-2.5 shrink-0"
        title="Salva nota"
      >
        {createLog.isPending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </button>
    </form>
  );
}
