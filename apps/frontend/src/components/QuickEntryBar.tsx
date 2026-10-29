import { useState, type FormEvent } from 'react';
import { Loader2, Send, type LucideIcon } from 'lucide-react';

interface QuickEntryBarProps {
  /** Ties the label to the field: two bars on one page must not share it */
  id: string;
  icon: LucideIcon;
  title: string;
  /** Written lower case at the source: the bar reads it as an aside after a dash */
  hint: string;
  placeholder: string;
  /** Names the action on the sheet's button and in the bar button's tooltip */
  submitLabel: string;
  isPending: boolean;
  /** Resolves once the entry is saved; the field is cleared only then */
  onSubmit: (text: string) => Promise<void>;
  /**
   * The sheet shape: a real text area and a full-width button, for when the
   * field is the whole screen rather than one line under a header
   */
  multiline?: boolean;
  autoFocus?: boolean;
}

/**
 * One line, type, send. The shape the diary uses for a comment on the day and
 * the schedule uses for a task: what changes between them is the sentence
 * above the field and what happens to the text, never the field itself.
 *
 * It owns the text and clears it only after the save resolves, so a failed
 * save leaves the words where the user can still see them.
 */
export function QuickEntryBar({
  id,
  icon: Icon,
  title,
  hint,
  placeholder,
  submitLabel,
  isPending,
  onSubmit,
  multiline = false,
  autoFocus = false,
}: QuickEntryBarProps) {
  const [text, setText] = useState('');

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;
    await onSubmit(trimmed);
    setText('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await save();
  };

  if (multiline) {
    return (
      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor={id} className="block">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Icon className="w-3.5 h-3.5 text-slate-400" />
            {title}
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-slate-400 first-letter:uppercase">
            {hint}
          </span>
        </label>
        <textarea
          id={id}
          value={text}
          onChange={(event) => setText(event.target.value)}
          // Enter is a new line here, as it should be in a text area; the
          // shortcut is there for whoever types on a keyboard
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void save();
          }}
          rows={5}
          placeholder={placeholder}
          className="input resize-y"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          autoFocus={autoFocus}
        />
        <button
          type="submit"
          disabled={!text.trim() || isPending}
          className="btn btn-primary w-full"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-1.5" />
          )}
          {submitLabel}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor={id} className="mb-1 flex items-baseline gap-1.5 text-[11px] leading-tight">
        <Icon className="w-3 h-3 shrink-0 self-center text-slate-400" />
        <span className="font-medium text-slate-600">{title}</span>
        <span className="hidden sm:inline text-slate-400">— {hint}</span>
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          className="input flex-1"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          enterKeyHint="send"
          autoFocus={autoFocus}
        />
        <button
          type="submit"
          disabled={!text.trim() || isPending}
          className="btn btn-primary p-2.5 shrink-0"
          title={submitLabel}
          aria-label={submitLabel}
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </form>
  );
}
