import { Gauge, ShoppingCart } from 'lucide-react';
import type { KitchenWeekDTO } from '@budget/shared';
import { cn } from '../../lib/utils';

interface PantryGaugeProps {
  week: KitchenWeekDTO;
  /** The small version that sits in the page flow on narrower screens */
  compact?: boolean;
  onOpenShopping: () => void;
}

type Zone = 'red' | 'orange' | 'green';

/**
 * How full the house is compared to the list: everything in the pantry and
 * nothing to buy is 100%, an empty pantry and a full list is 0%. Counted by
 * product, so a kilo of flour and a pack of salt weigh the same.
 */
export function pantryFill(week: KitchenWeekDTO) {
  const inHouse = week.pantry.filter((item) => item.quantity > 0).length;
  const toBuy = week.shopping.filter((item) => !item.checked).length;
  const total = inHouse + toBuy;
  const percent = total === 0 ? null : Math.round((inHouse / total) * 100);
  const zone: Zone | null = percent === null ? null : percent < 34 ? 'red' : percent < 67 ? 'orange' : 'green';
  return { inHouse, toBuy, percent, zone };
}

const ZONE_TEXT: Record<Zone, { title: string; detail: string; className: string }> = {
  red: {
    title: 'È ora di fare la spesa',
    detail: 'La lista è più piena della dispensa.',
    className: 'text-red-600',
  },
  orange: {
    title: 'Spesa a breve',
    detail: 'La dispensa regge ancora, ma la lista cresce.',
    className: 'text-amber-600',
  },
  green: {
    title: 'Dispensa piena',
    detail: 'Hai quasi tutto in casa, la lista è corta.',
    className: 'text-emerald-600',
  },
};

const CX = 100;
const CY = 100;
const R = 80;

/** A point on the dial: 180° is the far left (0%), 0° the far right (100%) */
function point(angle: number, radius = R) {
  const radians = (angle * Math.PI) / 180;
  return { x: CX + radius * Math.cos(radians), y: CY - radius * Math.sin(radians) };
}

function arc(from: number, to: number) {
  const start = point(from);
  const end = point(to);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function PantryGauge({ week, compact = false, onOpenShopping }: PantryGaugeProps) {
  const { inHouse, toBuy, percent, zone } = pantryFill(week);
  const text = zone ? ZONE_TEXT[zone] : null;
  // The needle is drawn pointing at 0% and turned clockwise
  const rotation = ((percent ?? 50) / 100) * 180;

  const dial = (
    <svg
      viewBox="0 0 200 116"
      className={cn('w-full', compact ? 'max-w-[8.5rem]' : 'max-w-xs mx-auto')}
      role="img"
      aria-label={percent === null ? 'Tachimetro della spesa: nessun dato' : `Tachimetro della spesa: ${percent}%`}
    >
      <path d={arc(180, 0)} fill="none" stroke="#e2e8f0" strokeWidth="18" strokeLinecap="round" />
      <path d={arc(178, 122)} fill="none" stroke="#ef4444" strokeWidth="18" strokeLinecap="round" />
      <path d={arc(118, 62)} fill="none" stroke="#f59e0b" strokeWidth="18" />
      <path d={arc(58, 2)} fill="none" stroke="#10b981" strokeWidth="18" strokeLinecap="round" />
      {[0, 25, 50, 75, 100].map((tick) => {
        const angle = 180 - tick * 1.8;
        const inner = point(angle, R - 16);
        const outer = point(angle, R - 11);
        return (
          <line key={tick} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#94a3b8" strokeWidth="1.5" />
        );
      })}
      <g
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          transition: 'transform 700ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          opacity: percent === null ? 0.3 : 1,
        }}
      >
        <path d={`M ${CX} ${CY - 4} L ${CX - R + 14} ${CY} L ${CX} ${CY + 4} Z`} fill="#0f172a" />
      </g>
      <circle cx={CX} cy={CY} r="8" fill="#0f172a" />
      <circle cx={CX} cy={CY} r="3" fill="#fff" />
    </svg>
  );

  if (compact) {
    return (
      <section className="card p-3 flex items-center gap-3" aria-label="Tachimetro della spesa">
        <div className="w-28 shrink-0">{dial}</div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
            {percent === null ? '—' : `${percent}%`}
          </p>
          <p className={cn('mt-1 text-sm font-semibold', text?.className ?? 'text-slate-500')}>
            {text?.title ?? 'Nessun dato'}
          </p>
          <p className="text-[11px] text-slate-500">
            {inHouse} in dispensa · {toBuy} in lista
          </p>
        </div>
        {zone === 'red' && (
          <button type="button" onClick={onOpenShopping} className="btn btn-primary min-h-10 w-10 px-0 shrink-0" aria-label="Apri la spesa">
            <ShoppingCart className="w-4 h-4" />
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="card p-4" aria-label="Tachimetro della spesa">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-900">È ora di fare la spesa?</h2>
      </div>

      <div className="mt-3">{dial}</div>
      <div className="-mt-1 flex justify-between px-2 text-[10px] font-medium text-slate-400">
        <span>0%</span>
        <span>100%</span>
      </div>

      <div className="mt-2 text-center">
        <p className="text-4xl font-bold tabular-nums text-slate-900">{percent === null ? '—' : `${percent}%`}</p>
        <p className={cn('mt-1 text-base font-semibold', text?.className ?? 'text-slate-500')}>
          {text?.title ?? 'Nessun dato'}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {text?.detail ?? 'Aggiungi cosa hai in casa e cosa devi comprare.'}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-2 py-2 text-center">
          <p className="text-lg font-semibold tabular-nums text-emerald-700">{inHouse}</p>
          <p className="text-[10px] uppercase tracking-wide text-emerald-700/70">In dispensa</p>
        </div>
        <div className="rounded-xl bg-sky-50 border border-sky-100 px-2 py-2 text-center">
          <p className="text-lg font-semibold tabular-nums text-sky-700">{toBuy}</p>
          <p className="text-[10px] uppercase tracking-wide text-sky-700/70">In lista</p>
        </div>
      </div>

      {zone === 'red' && (
        <button type="button" onClick={onOpenShopping} className="btn btn-primary mt-3 w-full min-h-10 gap-2 text-sm">
          <ShoppingCart className="w-4 h-4" /> Apri la lista della spesa
        </button>
      )}
      <p className="mt-3 text-[11px] leading-snug text-slate-400">
        100% = tutto in dispensa e lista vuota, 0% = dispensa vuota e lista piena. Contano i prodotti, non le quantità.
      </p>
    </section>
  );
}
