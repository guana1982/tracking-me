import { AlertTriangle, CheckCircle2, Loader2, Repeat, ShoppingCart, Sparkles } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import type { KitchenWeekDTO } from '@budget/shared';
import { cn } from '../../lib/utils';
import { dayLabel, needsLabel } from './kitchenUi';

interface CoverageCardProps {
  week: KitchenWeekDTO;
  isAddingMissing: boolean;
  isCopyingPlan: boolean;
  onAddMissing: () => void;
  onOpenShopping: () => void;
  onCopyPreviousPlan: () => void;
  onOpenRecipes: () => void;
}

/**
 * The one answer the page exists for: with what is at home and on the list,
 * does the menu hold until Sunday, and if not, when is the next trip.
 */
export function CoverageCard({
  week,
  isAddingMissing,
  isCopyingPlan,
  onAddMissing,
  onOpenShopping,
  onCopyPreviousPlan,
  onOpenRecipes,
}: CoverageCardProps) {
  const { coverage, today } = week;
  const isPastWeek = week.weekEnd < today;

  let tone: 'slate' | 'emerald' | 'sky' | 'amber' = 'slate';
  let icon = <Sparkles className="w-5 h-5" />;
  let title = '';
  let detail = '';
  let action: { label: string; onClick: () => void; busy?: boolean; icon: JSX.Element } | null = null;

  if (isPastWeek) {
    title = `Settimana chiusa: ${coverage.cookedMeals} pasti cucinati`;
    detail = 'Scegli un giorno di questa settimana per pianificare e fare la spesa.';
  } else if (coverage.status === 'EMPTY') {
    title = 'Il menù della settimana è vuoto';
    detail =
      week.recipes.length === 0
        ? 'Aggiungi i piatti che cucinate di solito, poi mettili su pranzi e cene: ti dico cosa comprare.'
        : 'Metti i piatti su pranzi e cene: ti dico cosa comprare e fino a quando sei coperto.';
    action =
      week.recipes.length === 0
        ? { label: 'Aggiungi i piatti', onClick: onOpenRecipes, icon: <Sparkles className="w-4 h-4" /> }
        : {
            label: 'Ripeti la settimana scorsa',
            onClick: onCopyPreviousPlan,
            busy: isCopyingPlan,
            icon: <Repeat className="w-4 h-4" />,
          };
  } else if (coverage.status === 'COVERED') {
    tone = 'emerald';
    icon = <CheckCircle2 className="w-5 h-5" />;
    title = 'Hai tutto fino a domenica';
    detail = 'Tutto il menù che resta si può cucinare con quello che hai in casa.';
  } else if (!coverage.shortFromAfterShopping) {
    tone = 'sky';
    icon = <ShoppingCart className="w-5 h-5" />;
    title = 'Con la lista della spesa sei a posto';
    detail = `Da ${dayLabel(coverage.shortFrom!, today)} servono cose che sono già in lista: ${coverage.toBuyOnList} da comprare.`;
    action = { label: 'Apri la spesa', onClick: onOpenShopping, icon: <ShoppingCart className="w-4 h-4" /> };
  } else {
    tone = 'amber';
    icon = <AlertTriangle className="w-5 h-5" />;
    const shortFrom = coverage.shortFromAfterShopping;
    const dayBefore = format(subDays(parseISO(shortFrom), 1), 'yyyy-MM-dd');
    title =
      shortFrom <= today
        ? 'Per oggi ti manca qualcosa'
        : `Sei coperto fino a ${dayLabel(dayBefore, today)}`;
    detail =
      week.toBuy.length > 0
        ? `Da ${dayLabel(shortFrom, today)} manca: ${needsLabel(week.toBuy)}.`
        : `Da ${dayLabel(shortFrom, today)} manca qualcosa.`;
    action =
      week.toBuy.length > 0
        ? {
            label: `Metti ${week.toBuy.length === 1 ? 'il mancante' : `i ${week.toBuy.length} mancanti`} in lista`,
            onClick: onAddMissing,
            busy: isAddingMissing,
            icon: <ShoppingCart className="w-4 h-4" />,
          }
        : null;
  }

  const toneClasses = {
    slate: 'bg-white border-slate-200 text-slate-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    sky: 'bg-sky-50 border-sky-200 text-sky-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
  }[tone];
  const iconClasses = {
    slate: 'bg-slate-900 text-white',
    emerald: 'bg-emerald-500 text-white',
    sky: 'bg-sky-500 text-white',
    amber: 'bg-amber-500 text-white',
  }[tone];

  const stats = [
    { label: 'Cucinati', value: `${coverage.cookedMeals}/${coverage.plannedMeals}` },
    { label: 'Da decidere', value: String(coverage.emptySlots), hint: 'pranzi e cene senza piatto' },
    { label: 'Da comprare', value: String(coverage.toBuyOnList) },
  ];

  return (
    <section className={cn('rounded-2xl border p-3 sm:p-4 shadow-sm', toneClasses)} aria-live="polite">
      <div className="flex items-start gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconClasses)}>{icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-base font-semibold leading-snug first-letter:uppercase">{title}</h2>
          <p className="mt-0.5 text-xs sm:text-sm opacity-80 leading-snug">{detail}</p>
        </div>
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.busy}
          className="btn btn-primary mt-3 w-full min-h-11 gap-2 text-sm"
        >
          {action.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : action.icon}
          {action.label}
        </button>
      )}

      {!isPastWeek && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white/70 border border-black/5 px-2 py-1.5 text-center" title={stat.hint}>
              <p className="text-base font-semibold tabular-nums text-slate-900">{stat.value}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
