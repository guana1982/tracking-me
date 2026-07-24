import { useState } from 'react';
import { Info, X } from 'lucide-react';
import type { SavingsPaceDTO } from '@budget/shared';
import { formatCurrency } from '../lib/utils';

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

interface SavingsGaugeProps {
  pace?: SavingsPaceDTO | null;
}

const ZONES = [
  { from: 0, to: 33, color: '#dc2626', label: 'Critico' },
  { from: 33, to: 66, color: '#f59e0b', label: 'Attenzione' },
  { from: 66, to: 100, color: '#16a34a', label: 'Ottimo' },
];

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcWedgePath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number) {
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  const p1 = polar(cx, cy, rOuter, startDeg);
  const p2 = polar(cx, cy, rOuter, endDeg);
  const p3 = polar(cx, cy, rInner, endDeg);
  const p4 = polar(cx, cy, rInner, startDeg);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

function SavingsStepTracker({ pace }: { pace: SavingsPaceDTO }) {
  const pct = Math.max(0, Math.min(100, pace.performancePct));
  const activeZone = ZONES.find((zone) => pct >= zone.from && pct <= zone.to) ?? ZONES[1];
  const displayedPct = Math.round(pct);
  const targetPct = Math.max(0, displayedPct - 1);

  // One performance point equals 2% of the monthly spending target in the
  // projection. A variable euro spent today is projected over the full cycle,
  // so convert that projected delta back to the actual amount spendable today.
  const eurosPerPoint =
    pace.effectiveCutoffDay > 0
      ? pace.budgetTarget * 0.02 * (pace.daysElapsed / pace.effectiveCutoffDay)
      : 0;
  const eurosToTarget = Math.max(0, (pct - targetPct) * eurosPerPoint);

  // Four integer ticks, with the current value normally between the third and
  // fourth tick (e.g. 52, 53, 54, 55 for a value around 54%).
  const rangeStart = Math.min(97, Math.max(0, Math.floor(pct) - 2));
  const ticks = Array.from({ length: 4 }, (_, index) => rangeStart + index);
  const currentPosition = Math.max(0, Math.min(100, ((pct - rangeStart) / 3) * 100));

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-medium text-slate-700">Prossimo punto percentuale</p>
          <p className="text-[11px] text-slate-500">Ipotesi: nuova spesa variabile oggi</p>
        </div>
        {displayedPct > 0 ? (
          <p className="text-right text-xs text-slate-600">
            Per arrivare al <strong className="text-slate-900">{targetPct}%</strong>
            <br />
            puoi spendere ancora{' '}
            <strong style={{ color: activeZone.color }}>{formatCurrency(eurosToTarget)}</strong>
          </p>
        ) : (
          <p className="text-xs font-semibold" style={{ color: activeZone.color }}>
            Indicatore al minimo
          </p>
        )}
      </div>

      <div className="relative h-24 px-1" aria-label={`Posizione attuale ${pct.toFixed(1)}%`}>
        <div className="absolute left-1 right-1 top-9 h-1 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${currentPosition}%`, backgroundColor: activeZone.color }}
          />
        </div>

        <div className="absolute left-1 right-1 top-0">
          <div
            className="absolute -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${currentPosition}%` }}
          >
            <span
              className="text-[10px] font-semibold whitespace-nowrap"
              style={{ color: activeZone.color }}
            >
              Sei qui
            </span>
            <span
              className="mt-0.5 w-0.5 h-7"
              style={{ backgroundColor: activeZone.color }}
            />
          </div>
        </div>

        <div className="absolute left-1 right-1 top-7 flex justify-between">
          {ticks.map((tick) => (
            <div key={tick} className="relative flex justify-center">
              <span className="absolute top-0 w-px h-5 bg-slate-700" />
              <span className="absolute top-5 text-[11px] font-semibold text-slate-700">
                {tick}%
              </span>
            </div>
          ))}
        </div>

        <div className="absolute left-1 right-1 top-[4.15rem] grid grid-cols-3">
          {ticks.slice(0, -1).map((tick) => (
            <span key={tick} className="text-center text-[10px] text-slate-400">
              {formatCurrency(eurosPerPoint)}
            </span>
          ))}
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400">
        Ogni intervallo vale quanto puoi spendere oggi per perdere 1 punto.
      </p>
    </div>
  );
}

export function SavingsGauge({ pace }: SavingsGaugeProps) {
  const [showInfo, setShowInfo] = useState(false);
  const hasBudget = !!pace && pace.budgetTarget > 0;
  const pct = hasBudget ? pace!.performancePct : 50;
  const angle = 180 + (pct / 100) * 180;

  const W = 220;
  const H = 140;
  const cx = W / 2;
  const cy = 110;
  const rOuter = 92;
  const rInner = 70;
  const zoneAngle = (p: number) => 180 + (p / 100) * 180;

  const needleTip = polar(cx, cy, rOuter - 4, angle);
  const needleBaseA = polar(cx, cy, 8, angle + 90);
  const needleBaseB = polar(cx, cy, 8, angle - 90);

  const activeZone = ZONES.find((z) => pct >= z.from && pct <= z.to) ?? ZONES[1];

  const bestMonthLabel = pace?.bestMonth
    ? `${MONTH_LABELS[pace.bestMonth.month - 1]} ${pace.bestMonth.year}`
    : null;
  const bestRatePct = pace?.bestMonth ? Math.round(pace.bestMonth.savingsRate * 100) : null;

  return (
    <div className="card py-4 px-5 flex flex-col">
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Ritmo risparmio
        </p>
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="text-slate-400 hover:text-sky-600 transition-colors"
          aria-label="Come funziona il calcolo"
          title="Come funziona il calcolo"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>
      {hasBudget && (
        <p className="text-xs text-slate-500 mb-2">
          Giorno <span className="font-semibold text-slate-700">{pace!.daysElapsed}/{pace!.effectiveCutoffDay}</span> - fisse + ritmo variabile vs budget
        </p>
      )}

      {hasBudget ? (
        <>
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold text-slate-900 leading-none mb-1">
              {Math.round(pct)}%
            </p>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto max-w-[240px]"
              role="img"
              aria-label={`Performance risparmio ${Math.round(pct)}%`}
            >
              {ZONES.map((z) => (
                <path
                  key={z.label}
                  d={arcWedgePath(cx, cy, rOuter, rInner, zoneAngle(z.from), zoneAngle(z.to))}
                  fill={z.color}
                />
              ))}

              {[33, 66].map((t) => {
                const a = zoneAngle(t);
                const outer = polar(cx, cy, rOuter + 2, a);
                const inner = polar(cx, cy, rInner - 2, a);
                return (
                  <line
                    key={t}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                );
              })}

              <polygon
                points={`${needleTip.x},${needleTip.y} ${needleBaseA.x},${needleBaseA.y} ${needleBaseB.x},${needleBaseB.y}`}
                fill="#1e293b"
              />
              <circle cx={cx} cy={cy} r={7} fill="#ffffff" stroke="#1e293b" strokeWidth={2} />

              <text x={cx - rOuter + 4} y={cy + 14} textAnchor="middle" style={{ fontSize: 10 }} className="fill-slate-400">0</text>
              <text x={cx + rOuter - 4} y={cy + 14} textAnchor="middle" style={{ fontSize: 10 }} className="fill-slate-400">100</text>
            </svg>
          </div>

          <div className="flex justify-center gap-3 mt-1 flex-wrap">
            {ZONES.map((z) => (
              <div key={z.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: z.color }} />
                <span
                  className={`text-xs ${z.label === activeZone.label ? 'font-semibold text-slate-800' : 'text-slate-500'}`}
                >
                  {z.label}
                </span>
              </div>
            ))}
          </div>

          <SavingsStepTracker pace={pace!} />

          {/* Primary: projected end-of-month vs budget target */}
          <div className="flex justify-between gap-3 mt-3 pt-2 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500">Proiezione fine mese</p>
              <p className="text-sm font-bold text-slate-900">{formatCurrency(pace!.projectedMonthlySpend)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Target budget</p>
              <p className="text-sm font-bold text-slate-900">{formatCurrency(pace!.budgetTarget)}</p>
            </div>
          </div>

          {/* Secondary: best historical month by savings-rate */}
          {pace!.hasComparison && bestMonthLabel && (
            <div className="flex justify-between gap-3 mt-2 pt-2 border-t border-dashed border-slate-100">
              <div>
                <p className="text-xs text-slate-500">
                  Miglior mese <span className="font-semibold text-slate-600">{bestMonthLabel}</span>
                  {bestRatePct !== null && <span className="text-slate-400"> · {bestRatePct}% risp.</span>}
                </p>
                <p className="text-xs font-semibold text-slate-700">{formatCurrency(pace!.bestSpendAtSameProgress)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Tu (stesso avanzamento)</p>
                <p className="text-xs font-semibold text-slate-700">{formatCurrency(pace!.currentSpendToDate)}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-sm text-slate-400 text-center">
            Imposta entrate e regola di budget per vedere il ritmo risparmio
          </p>
        </div>
      )}

      {showInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setShowInfo(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="savings-gauge-info-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 transition-colors"
              aria-label="Chiudi"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 id="savings-gauge-info-title" className="text-lg font-bold text-slate-900 mb-3 pr-6">
              Come si calcola il ritmo del risparmio
            </h3>

            <div className="space-y-4 text-sm text-slate-700">
              <p>
                Il tachimetro risponde a una domanda semplice: <strong>se continui a spendere
                al ritmo di oggi, arriverai al giorno dello stipendio dentro il tuo budget?</strong>
              </p>

              <div>
                <p className="font-semibold text-slate-800 mb-1">Come funziona il calcolo</p>
                <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-600">
                  <li>
                    Consideriamo il mese come ciclo stipendio: dal giorno dopo il <em>cutoffDay</em> del mese precedente fino al <em>cutoffDay</em> del mese selezionato. Se cade di sabato o domenica, lo spostiamo al venerdi precedente.
                  </li>
                  <li>
                    Sommiamo tutte le tue spese di <strong>Necessita</strong> e <strong>Svago</strong> nel mese selezionato
                    (conta la tab del mese, non la data inserita sulla singola spesa; i risparmi non contano).
                  </li>
                  <li>
                    Le spese fisse vengono contate una sola volta. Solo le spese variabili vengono <strong>proiettate</strong> al giorno di stipendio, cosi i costi ricorrenti caricati a inizio mese non vengono trattati come ritmo giornaliero.
                  </li>
                  <li>
                    Confrontiamo la proiezione con il <strong>target di budget</strong>, cioè la parte delle tue entrate
                    destinata alle spese (Necessità + Svago). Per la regola 65/25/10, il target è il 90% delle entrate.
                  </li>
                </ol>
              </div>

              <div>
                <p className="font-semibold text-slate-800 mb-2">Zone del tachimetro</p>
                <ul className="space-y-1.5 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#16a34a' }} />
                    <span><strong className="text-slate-800">Ottimo</strong> — la proiezione è sotto il target: stai risparmiando più del previsto.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#f59e0b' }} />
                    <span><strong className="text-slate-800">Attenzione</strong> — la proiezione è vicino al target: modera le prossime spese.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#dc2626' }} />
                    <span><strong className="text-slate-800">Critico</strong> — la proiezione supera il target: stai spendendo troppo.</span>
                  </li>
                </ul>
                <p className="text-xs text-slate-500 mt-2">
                  La lancetta si posiziona al 50% quando la proiezione coincide esattamente con il target.
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-800 mb-1">Il confronto secondario</p>
                <p className="text-sm text-slate-600">
                  Sotto il tachimetro trovi anche un confronto con il mese in cui hai risparmiato di più
                  <em> in proporzione alle entrate</em> (non il mese con più euro risparmiati in assoluto, ma quello con la
                  migliore percentuale di risparmio). Il confronto e fatto alla <strong>stessa percentuale di ciclo-stipendio trascorso</strong>,
                  proiettando in modo lineare lo stesso avanzamento sul mese migliore.
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-800 mb-1">
                  Indicatore per punto percentuale
                </p>
                <p className="text-sm text-slate-600">
                  La scala sotto il tachimetro traduce ogni punto percentuale in euro di nuova
                  spesa variabile effettuata oggi. L'importo cambia ogni giorno perché una spesa
                  registrata prima nel ciclo incide su più giorni della proiezione.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="mt-5 w-full bg-sky-600 hover:bg-sky-700 text-white rounded-lg py-2.5 px-4 text-sm font-medium transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

