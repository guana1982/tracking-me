import { useState } from 'react';
import { useKpis } from '../hooks/useQueries';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { PiggyBank, Repeat, ShieldCheck, Landmark, TrendingUp, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { InfoModal } from './InfoModal';

type Tone = 'good' | 'warn' | 'bad' | 'neutral';
type KpiKey = 'savingsRate' | 'fixedCosts' | 'runway' | 'netWorth' | 'invested';

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
  onInfo,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: Tone;
  sub?: string;
  onInfo: () => void;
}) {
  return (
    <div className="card py-2.5 px-3 shadow-sm bg-white border border-slate-200 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">
          {label}
        </span>
        <button
          onClick={onInfo}
          className="ml-auto p-0.5 text-slate-300 hover:text-indigo-500 transition-colors flex-shrink-0"
          title="Cosa significa questo numero?"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
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
  const [openInfo, setOpenInfo] = useState<KpiKey | null>(null);

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
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
        <KpiTile
          icon={PiggyBank}
          label="Savings rate"
          value={pct(kpis.savingsRatePct)}
          tone={savingsTone}
          sub={kpis.savingsRateAvgPct !== null ? `media 6 mesi ${pct(kpis.savingsRateAvgPct)}` : undefined}
          onInfo={() => setOpenInfo('savingsRate')}
        />
        <KpiTile
          icon={Repeat}
          label="Costi fissi"
          value={pct(kpis.fixedCostRatioPct)}
          tone={fixedTone}
          sub={kpis.fixedCostRatioAvgPct !== null ? `media 6 mesi ${pct(kpis.fixedCostRatioAvgPct)}` : undefined}
          onInfo={() => setOpenInfo('fixedCosts')}
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
          onInfo={() => setOpenInfo('runway')}
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
          onInfo={() => setOpenInfo('netWorth')}
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
          onInfo={() => setOpenInfo('invested')}
        />
      </div>

      {openInfo === 'savingsRate' && (
        <InfoModal title="Savings rate" onClose={() => setOpenInfo(null)}>
          <p>
            È la percentuale delle tue entrate che riesci davvero a mettere da parte nel mese: se
            guadagni 3.000 € e il savings rate è 10%, hai risparmiato 300 €.
          </p>
          <p>
            <strong>Come si calcola:</strong> (versamenti nei Risparmi + riallocazioni degli avanzi
            − spese Extra fatte dal conto risparmi) ÷ entrate del mese. Le spese Extra si
            sottraggono perché soldi spesi da Trade Republic non sono più risparmio.
          </p>
          <p>
            <strong>Come leggerlo:</strong> <span className="text-emerald-600 font-medium">verde ≥ 10%</span>{' '}
            (il tuo obiettivo di budget), <span className="text-amber-600 font-medium">ambra 5–10%</span>,{' '}
            <span className="text-red-600 font-medium">rosso sotto il 5%</span>. La "media 6 mesi" ti
            dice se il mese corrente è un'eccezione o la norma: è la media che fa crescere il
            patrimonio, non il singolo mese buono.
          </p>
        </InfoModal>
      )}

      {openInfo === 'fixedCosts' && (
        <InfoModal title="Costi fissi" onClose={() => setOpenInfo(null)}>
          <p>
            Quanta parte delle entrate se ne va in spese fisse (mutuo, bollette, abbonamenti,
            asilo...) prima ancora che tu decida qualcosa. È la spesa che non puoi evitare senza
            disdire o rinegoziare qualcosa.
          </p>
          <p>
            <strong>Come si calcola:</strong> spese marcate "Fisso" in Necessità e Svago ÷ entrate
            del mese.
          </p>
          <p>
            <strong>Perché conta:</strong> più è bassa, più sei libero. Se i fissi sono il 40%, in
            un mese storto puoi tagliare il resto senza drammi; se sono il 70%, ogni imprevisto
            diventa un sacrificio. <span className="text-emerald-600 font-medium">Verde ≤ 50%</span>,{' '}
            <span className="text-amber-600 font-medium">ambra 50–65%</span>,{' '}
            <span className="text-red-600 font-medium">rosso oltre</span>.
          </p>
          <p>
            <strong>Come migliorarlo:</strong> non serve rinunciare — si rinegozia: tariffe
            luce/gas/telefono, abbonamenti doppi o inutilizzati, assicurazioni. Ogni euro tolto dai
            fissi è risparmio automatico ogni mese, per sempre.
          </p>
        </InfoModal>
      )}

      {openInfo === 'runway' && (
        <InfoModal title="Runway" onClose={() => setOpenInfo(null)}>
          <p>
            Per quanti mesi potresti vivere al tuo tenore di vita attuale se da domani smettessero
            di arrivare entrate. È il KPI di sopravvivenza che ogni azienda guarda per prima.
          </p>
          <p>
            <strong>Come si calcola:</strong> liquidità disponibile ÷ spesa media mensile
            (Necessità + Svago + Extra degli ultimi 6 mesi chiusi).
          </p>
          <p>
            <strong>Come leggerlo:</strong> <span className="text-emerald-600 font-medium">verde ≥ 6 mesi</span>{' '}
            (fondo emergenza solido), <span className="text-amber-600 font-medium">ambra 3–6</span>,{' '}
            <span className="text-red-600 font-medium">rosso sotto 3</span> — lì un imprevisto grosso
            ti costringerebbe a vendere investimenti nel momento sbagliato.
          </p>
          {kpis.liquiditySource === 'total' && (
            <p className="rounded-lg bg-amber-50 text-amber-700 p-2.5">
              Ora il calcolo usa il <strong>patrimonio totale</strong> perché non sai ancora quali
              conti sono liquidi. Per renderlo preciso: pagina <strong>Cash Flow</strong> → bottone{' '}
              <strong>"Gestisci colonne"</strong> → scheda <strong>"Classificazioni"</strong> →
              crea una classificazione chiamata "Liquidità" e spunta le colonne dei conti correnti.
            </p>
          )}
        </InfoModal>
      )}

      {openInfo === 'netWorth' && (
        <InfoModal title="Patrimonio" onClose={() => setOpenInfo(null)}>
          <p>
            La somma di tutto quello che possiedi (conti, risparmi, investimenti) all'ultimo check
            registrato nella pagina Cash Flow. È la fotografia del tuo stato patrimoniale.
          </p>
          <p>
            <strong>La percentuale "annuo":</strong> confronta l'ultimo check con uno abbastanza
            vecchio (almeno 2 mesi) e proietta la crescita su base annua. Ti dice a che velocità
            sta crescendo il patrimonio, indipendentemente da quanto spesso fai i check.
          </p>
          <p>
            <strong>Come usarlo:</strong> è il numero che deve salire nel tempo — non mese su mese
            (i mercati oscillano), ma sulla tendenza. Se cresce meno del tuo risparmio mensile
            accumulato, gli investimenti stanno perdendo o stai spendendo da conti non tracciati.
          </p>
        </InfoModal>
      )}

      {openInfo === 'invested' && (
        <InfoModal title="Quota investita" onClose={() => setOpenInfo(null)}>
          <p>
            Quanta parte del patrimonio lavora per te (ETF, obbligazioni...) invece di stare ferma
            sul conto a perdere valore con l'inflazione.
          </p>
          <p>
            <strong>Come leggerla:</strong> non esiste un valore giusto per tutti — dipende dal
            fondo emergenza. La logica sana: prima costruisci il runway (6 mesi di liquidità), poi
            tutto il resto conviene che sia investito. Una quota molto bassa con runway già verde
            significa che troppi soldi dormono sul conto.
          </p>
          {kpis.investedSharePct === null && (
            <p className="rounded-lg bg-amber-50 text-amber-700 p-2.5">
              Per attivare questo KPI: pagina <strong>Cash Flow</strong> → bottone{' '}
              <strong>"Gestisci colonne"</strong> → scheda <strong>"Classificazioni"</strong> →
              crea una classificazione chiamata "Investimenti" e spunta le colonne investite (ETF,
              obbligazioni...).
            </p>
          )}
        </InfoModal>
      )}
    </>
  );
}
