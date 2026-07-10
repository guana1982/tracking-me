import { useKpis } from '../hooks/useQueries';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { PiggyBank, Repeat, ShieldCheck, Landmark, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const toneClasses: Record<Tone, string> = {
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  bad: 'text-red-600',
  neutral: 'text-slate-700',
};

function KpiTile({
  icon: Icon,
  label,
  value,
  tone,
  sub,
  title,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: Tone;
  sub?: string;
  title?: string;
}) {
  return (
    <div
      className="card py-2.5 px-3 shadow-sm bg-white border border-slate-200 min-w-0"
      title={title}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">
          {label}
        </span>
      </div>
      <p className={cn('text-lg font-bold leading-tight', toneClasses[tone])}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 truncate mt-0.5">{sub}</p>}
    </div>
  );
}

// CFO panel: the 4-5 numbers that decide whether wealth grows.
// Thresholds: savings rate vs the 10% budget target; fixed costs vs income
// (the lower, the less painful a bad month is); runway = months of average
// spending covered by liquidity
export function KpiPanel({ periodKey }: { periodKey: string }) {
  const { data: kpis } = useKpis(periodKey);

  if (!kpis) return null;

  const pct = (value: number | null): string =>
    value === null ? '—' : `${value.toFixed(1).replace('.', ',')}%`;

  const savingsTone: Tone =
    kpis.savingsRatePct === null
      ? 'neutral'
      : kpis.savingsRatePct >= 10
        ? 'good'
        : kpis.savingsRatePct >= 5
          ? 'warn'
          : 'bad';

  const fixedTone: Tone =
    kpis.fixedCostRatioPct === null
      ? 'neutral'
      : kpis.fixedCostRatioPct <= 50
        ? 'good'
        : kpis.fixedCostRatioPct <= 65
          ? 'warn'
          : 'bad';

  const runwayTone: Tone =
    kpis.runwayMonths === null
      ? 'neutral'
      : kpis.runwayMonths >= 6
        ? 'good'
        : kpis.runwayMonths >= 3
          ? 'warn'
          : 'bad';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
      <KpiTile
        icon={PiggyBank}
        label="Savings rate"
        value={pct(kpis.savingsRatePct)}
        tone={savingsTone}
        sub={kpis.savingsRateAvgPct !== null ? `media 6 mesi ${pct(kpis.savingsRateAvgPct)}` : undefined}
        title="Risparmio reale del mese (versamenti + riallocazioni − spese Extra) rapportato alle entrate: è il tuo margine operativo"
      />
      <KpiTile
        icon={Repeat}
        label="Costi fissi"
        value={pct(kpis.fixedCostRatioPct)}
        tone={fixedTone}
        sub={kpis.fixedCostRatioAvgPct !== null ? `media 6 mesi ${pct(kpis.fixedCostRatioAvgPct)}` : undefined}
        title="Spese fisse su entrate: più è bassa, meno sacrifici servono quando un mese va storto"
      />
      <KpiTile
        icon={ShieldCheck}
        label="Runway"
        value={kpis.runwayMonths === null ? '—' : `${kpis.runwayMonths.toFixed(1).replace('.', ',')} mesi`}
        tone={runwayTone}
        sub={
          kpis.liquidity === null
            ? 'nessun check cash-flow'
            : kpis.liquiditySource === 'classification'
              ? `liquidità ${formatCurrency(kpis.liquidity)}`
              : `su patrimonio totale ${formatCurrency(kpis.liquidity)}`
        }
        title={
          kpis.liquiditySource === 'total'
            ? 'Mesi di spesa media coperti. Ora usa il patrimonio totale: crea nel cash-flow una classificazione chiamata "Liquidità" per un valore preciso'
            : 'Mesi di spesa media (Necessità+Svago+Extra) coperti dalla liquidità'
        }
      />
      <KpiTile
        icon={Landmark}
        label="Patrimonio"
        value={kpis.netWorth === null ? '—' : formatCurrency(kpis.netWorth)}
        tone="neutral"
        sub={
          kpis.netWorthGrowthAnnualPct !== null
            ? `${kpis.netWorthGrowthAnnualPct >= 0 ? '+' : ''}${pct(kpis.netWorthGrowthAnnualPct)} annuo`
            : kpis.netWorthDate
              ? `check del ${formatDate(kpis.netWorthDate)}`
              : 'nessun check cash-flow'
        }
        title="Ultimo snapshot del cash-flow; la crescita è annualizzata sul confronto con il check più vecchio utile"
      />
      <KpiTile
        icon={TrendingUp}
        label="Quota investita"
        value={pct(kpis.investedSharePct)}
        tone="neutral"
        sub={
          kpis.investedSharePct === null
            ? 'crea classificazione "Investimenti" nel cash-flow'
            : 'del patrimonio totale'
        }
        title='Quota del patrimonio investita: somma delle colonne nella classificazione cash-flow "Invest…"'
      />
    </div>
  );
}
