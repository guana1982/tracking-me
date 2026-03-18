import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { portfolioApi } from '../lib/api';
import type {
  PortfolioCompareRequestDTO,
  PortfolioCompareResponseDTO,
  PortfolioHistoryHorizonDTO,
  PortfolioInputValueModeDTO,
} from '@budget/shared';

type AssetClass = 'AZIONARIO' | 'OBBLIGAZIONARIO';
type Horizon = PortfolioHistoryHorizonDTO;
type Instrument = { symbol: string; isin: string; name: string; assetClass: AssetClass };
type Invested = { symbol: string; amount: number };
type StudyRow = { id: string; label: string; weight: string };
type StudyPortfolio = { id: string; name: string; rows: StudyRow[] };

const INSTRUMENTS: Instrument[] = [
  { symbol: 'XEON', isin: 'LU0290358497', name: 'Xtrackers EUR Overnight', assetClass: 'OBBLIGAZIONARIO' },
  { symbol: 'GOLD', isin: 'IE00B579F325', name: 'WisdomTree Physical Gold', assetClass: 'OBBLIGAZIONARIO' },
  { symbol: 'AMUNDI_EMERGING', isin: 'LU1681045370', name: 'Amundi Emerging', assetClass: 'AZIONARIO' },
  { symbol: 'PACIFIC_EXJP', isin: 'IE00B52MJY50', name: 'iShares Pacific ex Japan', assetClass: 'AZIONARIO' },
  { symbol: 'WORLD', isin: 'IE00B4L5Y983', name: 'iShares MSCI World', assetClass: 'AZIONARIO' },
  { symbol: 'JP_SMALLCAP', isin: 'IE00B2QWDY88', name: 'Japan Small Cap', assetClass: 'AZIONARIO' },
  { symbol: 'LG_CLEAN_ENERGY', isin: 'IE00BK5BCH80', name: 'L&G Clean Energy', assetClass: 'AZIONARIO' },
  { symbol: 'WORLD_SMALL_CAP', isin: 'IE00BCBJG560', name: 'World Small Cap', assetClass: 'AZIONARIO' },
  { symbol: 'WISDOM_AI', isin: 'IE00BDVPNG13', name: 'Wisdom AI', assetClass: 'AZIONARIO' },
  { symbol: 'EMERGING', isin: 'IE00BKM4GZ66', name: 'MSCI Emerging IMI', assetClass: 'AZIONARIO' },
  { symbol: 'US_SMALLCAP', isin: 'IE00BJ38QD84', name: 'US Small Cap', assetClass: 'AZIONARIO' },
  { symbol: 'WORLD_EX_USA', isin: 'IE000R4ZNTN3', name: 'World ex USA', assetClass: 'AZIONARIO' },
  { symbol: 'UTILITIES', isin: 'IE00B4KBBD01', name: 'S&P500 Utilities', assetClass: 'AZIONARIO' },
  { symbol: 'EM_EX_CHINA', isin: 'IE00BMG6Z448', name: 'EM ex China', assetClass: 'AZIONARIO' },
  { symbol: 'SWITZERLAND', isin: 'LU0977261329', name: 'MSCI Switzerland', assetClass: 'AZIONARIO' },
  { symbol: 'UK', isin: 'LU0950670850', name: 'MSCI UK', assetClass: 'AZIONARIO' },
  { symbol: 'AI_BIGDATA', isin: 'IE00BGV5VN51', name: 'AI Big Data', assetClass: 'AZIONARIO' },
  { symbol: 'JAPAN', isin: 'LU1781541252', name: 'MSCI Japan', assetClass: 'AZIONARIO' },
  { symbol: 'EUROPE', isin: 'LU0908500753', name: 'MSCI Europe', assetClass: 'AZIONARIO' },
  { symbol: 'CHINA-A', isin: 'IE00BQT3WG13', name: 'China A', assetClass: 'AZIONARIO' },
  { symbol: 'BRAZIL', isin: 'LU1900066207', name: 'Brazil', assetClass: 'AZIONARIO' },
  { symbol: 'SUSW', isin: 'IE00BYX2JD69', name: 'MSCI World SRI', assetClass: 'AZIONARIO' },
  { symbol: 'S&P500', isin: 'IE00B5BMR087', name: 'S&P500', assetClass: 'AZIONARIO' },
  { symbol: 'XTR_GOLD', isin: 'DE000A2T0VU5', name: 'Xtrackers Gold', assetClass: 'OBBLIGAZIONARIO' },
  { symbol: 'MSCI_EUROPE_ENERGY', isin: 'IE00BKWQ0F09', name: 'Europe Energy', assetClass: 'AZIONARIO' },
  { symbol: 'AMUNDI_SMART_OVERNOGHT', isin: 'LU1190417599', name: 'Amundi Smart Overnight', assetClass: 'OBBLIGAZIONARIO' },
  { symbol: 'USB_FOREIN_DIST', isin: 'LU0879397742', name: 'UBS US Bond Dist', assetClass: 'OBBLIGAZIONARIO' },
  { symbol: 'AMUNDI_BLOOMERG_EX_AGRIC', isin: 'LU1829218749', name: 'Amundi Bloomberg Ex Agric', assetClass: 'OBBLIGAZIONARIO' },
  { symbol: 'ISHARE_CINA_A', isin: 'IE00BJ5JPG56', name: 'iShares China A', assetClass: 'AZIONARIO' },
  { symbol: 'MSCI_EMU', isin: 'IE00B53QG562', name: 'MSCI EMU', assetClass: 'AZIONARIO' },
  { symbol: 'MSCI_SMALLCAP', isin: 'IE00BF4RFH31', name: 'MSCI Small Cap', assetClass: 'AZIONARIO' },
];

const COLORS = ['#0ea5e9', '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#14b8a6'];
const mk = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
const pct = (v: number | null | undefined) => (!Number.isFinite(v ?? NaN) ? 'N/A' : `${((v as number) * 100).toFixed(2)}%`);
const month = (d: string) => new Date(d).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });

function defaultStudy(): StudyPortfolio[] {
  return [
    {
      id: mk('p'),
      name: 'ASIS',
      rows: [
        { id: mk('r'), label: 'WORLD', weight: '33' },
        { id: mk('r'), label: 'PACIFIC_EXJP', weight: '14' },
        { id: mk('r'), label: 'EM_EX_CHINA', weight: '12' },
        { id: mk('r'), label: 'SWITZERLAND', weight: '11' },
        { id: mk('r'), label: 'UK', weight: '11' },
        { id: mk('r'), label: 'AI_BIGDATA', weight: '7' },
        { id: mk('r'), label: 'JP_SMALLCAP', weight: '12' },
      ],
    },
    {
      id: mk('p'),
      name: 'NEW',
      rows: [
        { id: mk('r'), label: 'WORLD', weight: '33' },
        { id: mk('r'), label: 'PACIFIC_EXJP', weight: '14' },
        { id: mk('r'), label: 'EM_EX_CHINA', weight: '12' },
        { id: mk('r'), label: 'SWITZERLAND', weight: '11' },
        { id: mk('r'), label: 'UK', weight: '11' },
        { id: mk('r'), label: 'AI_BIGDATA', weight: '7' },
        { id: mk('r'), label: 'MSCI_SMALLCAP', weight: '12' },
      ],
    },
  ];
}

export function Portfolio() {
  const [invested, setInvested] = useState<Invested[]>([
    { symbol: 'WORLD', amount: 18000 },
    { symbol: 'PACIFIC_EXJP', amount: 7500 },
    { symbol: 'EM_EX_CHINA', amount: 6000 },
    { symbol: 'XEON', amount: 5000 },
  ]);
  const [addSymbol, setAddSymbol] = useState('WORLD');
  const [addAmount, setAddAmount] = useState('1000');
  const [horizon, setHorizon] = useState<Horizon>('3Y');
  const [inputValue, setInputValue] = useState<PortfolioInputValueModeDTO>('quote_with_dividends');
  const [riskFreeAnnual, setRiskFreeAnnual] = useState('0.03');
  const [study, setStudy] = useState<StudyPortfolio[]>(defaultStudy());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortfolioCompareResponseDTO | null>(null);
  const [isInvestedOpen, setIsInvestedOpen] = useState(true);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

  const investedTotal = useMemo(() => invested.reduce((s, p) => s + Math.max(0, p.amount), 0), [invested]);
  const investedSplit = useMemo(() => {
    const equity = invested.reduce((sum, item) => {
      const instrument = INSTRUMENTS.find((i) => i.symbol === item.symbol);
      if (!instrument || instrument.assetClass !== 'AZIONARIO') return sum;
      return sum + Math.max(0, item.amount);
    }, 0);
    const bond = invested.reduce((sum, item) => {
      const instrument = INSTRUMENTS.find((i) => i.symbol === item.symbol);
      if (!instrument || instrument.assetClass !== 'OBBLIGAZIONARIO') return sum;
      return sum + Math.max(0, item.amount);
    }, 0);
    return { equity, bond };
  }, [invested]);
  const universeByLabel = useMemo(() => INSTRUMENTS.reduce<Record<string, string>>((a, i) => ((a[i.symbol] = i.isin), a), {}), []);

  const cumulativeData = useMemo(() => {
    if (!result) return [] as Array<Record<string, string | number>>;
    const dates = new Set<string>();
    const maps = result.portfolios.map((p) => {
      let x = 100;
      const m = new Map<string, number>();
      [...p.series].sort((a, b) => a.date.localeCompare(b.date)).forEach((pt) => {
        x *= 1 + pt.value;
        m.set(pt.date, x);
        dates.add(pt.date);
      });
      return { name: p.name, m };
    });
    return Array.from(dates).sort((a, b) => a.localeCompare(b)).map((date) => {
      const row: Record<string, string | number> = { date, dateLabel: month(date) };
      maps.forEach((p) => {
        const v = p.m.get(date);
        if (Number.isFinite(v)) row[p.name] = v as number;
      });
      return row;
    });
  }, [result]);

  const addInvested = () => {
    const amount = Number(addAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) return;
    setInvested((prev) => {
      const idx = prev.findIndex((p) => p.symbol === addSymbol);
      if (idx < 0) return [...prev, { symbol: addSymbol, amount }];
      const next = [...prev];
      next[idx] = { ...next[idx], amount: next[idx].amount + amount };
      return next;
    });
  };

  const runCompare = async () => {
    setError(null);
    const rf = Number(riskFreeAnnual.replace(',', '.'));
    if (!Number.isFinite(rf)) return setError('Risk free non valido');

    const portfolios = study
      .map((p) => {
        const weights = p.rows.reduce<Record<string, number>>((acc, row) => {
          const w = Number(row.weight.replace(',', '.'));
          if (row.label && Number.isFinite(w) && w > 0) acc[row.label] = (acc[row.label] ?? 0) + w;
          return acc;
        }, {});
        return { name: p.name.trim() || 'Portfolio', weights };
      })
      .filter((p) => Object.keys(p.weights).length > 0);

    if (portfolios.length < 2) return setError('Servono almeno 2 portafogli con pesi validi');

    const payload: PortfolioCompareRequestDTO = { horizon, inputValue, riskFreeAnnual: rf, universeByLabel, portfolios };
    try {
      setLoading(true);
      setResult(await portfolioApi.compare(payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore confronto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sm:ml-60 space-y-4">
      <div className="card">
        <h2 className="text-lg font-semibold">Portafoglio</h2>
        <p className="text-sm text-slate-500">Confronto multi-portafoglio di studio su dati justETF.</p>
      </div>

      <section className="card p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsInvestedOpen((prev) => !prev)}
          className="w-full px-4 py-3 border-b border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">Portafoglio Investito</h3>
            <p className="text-xs text-slate-500 mt-0.5">Sezione reale. Totale: {formatCurrency(investedTotal)}</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isInvestedOpen ? 'rotate-180' : ''}`} />
        </button>

        {isInvestedOpen && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Totale</p>
                <p className="text-base font-semibold text-slate-900 mt-1">{formatCurrency(investedTotal)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Azionario</p>
                <p className="text-base font-semibold text-slate-900 mt-1">{investedTotal > 0 ? `${((investedSplit.equity / investedTotal) * 100).toFixed(1)}%` : '0.0%'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Obbligazionario</p>
                <p className="text-base font-semibold text-slate-900 mt-1">{investedTotal > 0 ? `${((investedSplit.bond / investedTotal) * 100).toFixed(1)}%` : '0.0%'}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <select value={addSymbol} onChange={(e) => setAddSymbol(e.target.value)} className="input min-w-[220px]">
                {INSTRUMENTS.map((i) => <option key={i.symbol} value={i.symbol}>{i.symbol}</option>)}
              </select>
              <input value={addAmount} onChange={(e) => setAddAmount(e.target.value)} className="input w-32" type="number" />
              <button className="btn btn-secondary" onClick={addInvested}><Plus className="w-4 h-4 mr-1" />Aggiungi</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {invested.map((p) => (
                <div key={p.symbol} className="rounded border border-slate-200 p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{p.symbol}</span>
                    <button className="p-1 text-slate-500 hover:text-red-600" onClick={() => setInvested((prev) => prev.filter((x) => x.symbol !== p.symbol))}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="number"
                    className="input w-full text-right"
                    value={p.amount}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setInvested((prev) => prev.map((x) => (x.symbol === p.symbol ? { ...x, amount: Number.isFinite(v) ? Math.max(0, v) : 0 } : x)));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsAnalysisOpen((prev) => !prev)}
          className="w-full px-4 py-3 border-b border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">Laboratorio Strategico Portafogli</h3>
            <p className="text-xs text-slate-500 mt-0.5">Costruisci N portafogli, confronta metriche e correlazioni.</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isAnalysisOpen ? 'rotate-180' : ''}`} />
        </button>

        {isAnalysisOpen && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <select value={horizon} onChange={(e) => setHorizon(e.target.value as Horizon)} className="input">
                <option value="1Y">1Y</option><option value="3Y">3Y</option><option value="5Y">5Y</option>
              </select>
              <select value={inputValue} onChange={(e) => setInputValue(e.target.value as PortfolioInputValueModeDTO)} className="input">
                <option value="quote_with_dividends">quote_with_dividends</option>
                <option value="quote">quote</option>
              </select>
              <input value={riskFreeAnnual} onChange={(e) => setRiskFreeAnnual(e.target.value)} className="input w-28" />
              <button className="btn btn-secondary" onClick={() => setStudy((prev) => [...prev, { id: mk('p'), name: `PORTFOLIO ${prev.length + 1}`, rows: [{ id: mk('r'), label: 'WORLD', weight: '10' }] }])}>
                <Plus className="w-4 h-4 mr-1" /> Nuovo portafoglio
              </button>
              <button className="btn btn-primary" onClick={runCompare} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Confronta
              </button>
            </div>

            {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
              {study.map((p) => (
                <div key={p.id} className="rounded border border-slate-200 p-3 space-y-2 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <input className="input w-44" value={p.name} onChange={(e) => setStudy((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
                    <div className="flex gap-2">
                      <button className="btn btn-secondary py-1" onClick={() => setStudy((prev) => prev.map((x) => (x.id === p.id ? { ...x, rows: [...x.rows, { id: mk('r'), label: 'WORLD', weight: '10' }] } : x)))}>Riga</button>
                      {study.length > 1 && <button className="btn py-1" onClick={() => setStudy((prev) => prev.filter((x) => x.id !== p.id))}>Rimuovi</button>}
                    </div>
                  </div>
                  <div className="max-h-56 overflow-auto space-y-2 pr-1">
                    {p.rows.map((row) => (
                      <div key={row.id} className="grid grid-cols-[1fr,96px,36px] gap-2">
                        <select className="input" value={row.label} onChange={(e) => setStudy((prev) => prev.map((x) => x.id === p.id ? { ...x, rows: x.rows.map((r) => r.id === row.id ? { ...r, label: e.target.value } : r) } : x))}>
                          {INSTRUMENTS.map((i) => <option key={i.symbol} value={i.symbol}>{i.symbol}</option>)}
                        </select>
                        <input className="input text-right" value={row.weight} onChange={(e) => setStudy((prev) => prev.map((x) => x.id === p.id ? { ...x, rows: x.rows.map((r) => r.id === row.id ? { ...r, weight: e.target.value } : r) } : x))} />
                        <button className="btn px-0" onClick={() => setStudy((prev) => prev.map((x) => x.id === p.id ? { ...x, rows: x.rows.filter((r) => r.id !== row.id) } : x))}>X</button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Peso totale inserito: {p.rows.reduce((sum, row) => {
                      const n = Number(row.weight.replace(',', '.'));
                      return sum + (Number.isFinite(n) && n > 0 ? n : 0);
                    }, 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {result && (
              <div className="space-y-4">
                <div className="rounded border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Ranking score</p>
                  <div className="flex flex-wrap gap-2 mt-2">{result.ranking.map((n, i) => <span key={n} className="text-xs rounded-full border px-2 py-1">#{i + 1} {n}</span>)}</div>
                </div>

                <div className="rounded border border-slate-200 p-3 overflow-x-auto">
                  <p className="text-sm font-semibold mb-2">Portfolio</p>
                  <table className="min-w-[760px] text-sm w-full">
                    <thead><tr className="text-left text-slate-500"><th>Portfolio</th><th className="text-right">Return</th><th className="text-right">Vol</th><th className="text-right">Sharpe</th><th className="text-right">Divers</th><th className="text-right">AvgCorr</th><th className="text-right">Score</th><th className="text-right">Mesi</th></tr></thead>
                    <tbody>
                      {result.portfolios.map((p) => (
                        <tr key={p.name} className="border-t border-slate-100">
                          <td className="py-1 font-medium">{p.name}</td><td className="text-right">{pct(p.metrics.annualizedReturn)}</td><td className="text-right">{pct(p.metrics.annualizedVolatility)}</td>
                          <td className="text-right">{p.metrics.sharpe === null ? 'N/A' : p.metrics.sharpe.toFixed(3)}</td><td className="text-right">{p.metrics.divers.toFixed(3)}</td>
                          <td className="text-right">{p.metrics.avgCorr === null ? 'N/A' : p.metrics.avgCorr.toFixed(3)}</td><td className="text-right">{p.metrics.score === null ? 'N/A' : p.metrics.score.toFixed(3)}</td><td className="text-right">{p.metrics.nMonths}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="rounded border border-slate-200 p-3 h-72">
                    <p className="text-sm font-semibold mb-2">Serie cumulative</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cumulativeData}><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" /><XAxis dataKey="dateLabel" /><YAxis /><Tooltip />{result.portfolios.map((p, i) => <Line key={p.name} type="monotone" dataKey={p.name} dot={false} stroke={COLORS[i % COLORS.length]} />)}</LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rounded border border-slate-200 p-3 h-72">
                    <p className="text-sm font-semibold mb-2">Scatter rischio/rendimento</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" /><XAxis type="number" dataKey="annualizedVolatility" tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} /><YAxis type="number" dataKey="annualizedReturn" tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} /><Tooltip /><Scatter data={result.scatter} fill="#0ea5e9" /></ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded border border-slate-200 p-3 overflow-x-auto">
                  <p className="text-sm font-semibold mb-2">Correlazione tra portafogli</p>
                  <table className="text-xs min-w-[520px]"><thead><tr><th className="text-left p-1">Portfolio</th>{result.correlationBetweenPortfolios.labels.map((l) => <th key={l} className="text-right p-1">{l}</th>)}</tr></thead><tbody>{result.correlationBetweenPortfolios.labels.map((row, i) => <tr key={row}><td className="font-medium p-1">{row}</td>{result.correlationBetweenPortfolios.values[i].map((v, j) => <td key={`${row}-${j}`} className="text-right p-1" style={{ background: v === null ? 'rgba(148,163,184,0.12)' : `rgba(${v >= 0 ? '16,185,129' : '239,68,68'},${0.12 + Math.min(1, Math.abs(v)) * 0.35})` }}>{v === null ? 'N/A' : v.toFixed(2)}</td>)}</tr>)}</tbody></table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
