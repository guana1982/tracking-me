import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Cell,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronRight, Loader2, Pencil, Plus, X } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { portfolioApi } from '../lib/api';
import {
  InvestedPortfolioPerformanceChart,
  PORTFOLIO_PERFORMANCE_METRIC_OPTIONS,
} from '../components/InvestedPortfolioPerformanceChart';
import { StudyPortfoliosOverlayPerformanceChart } from '../components/StudyPortfoliosOverlayPerformanceChart';
import type {
  PortfolioAssetClassDTO,
  PortfolioCompanyExposureResponseDTO,
  PortfolioCompareRequestDTO,
  PortfolioCompareResponseDTO,
  PortfolioGeographicExposureCountryDTO,
  PortfolioGeographicExposureResponseDTO,
  PortfolioHistoryHorizonDTO,
  PortfolioInstrumentDTO,
  PortfolioInputValueModeDTO,
  PortfolioSectorExposureResponseDTO,
  PortfolioStaticPerformanceMetricDTO,
} from '@budget/shared';

type Horizon = PortfolioHistoryHorizonDTO;
type Invested = { symbol: string; amount: number };
type InvestedDraft = {
  amount: string;
  instrumentId: string | null;
  symbol: string;
  name: string;
  isin: string;
  assetClassId: string;
  newAssetClassName: string;
  renameAssetClassName: string;
};
type StudyRow = { id: string; label: string; weight: string };
type StudyPortfolio = { id: string; name: string; rows: StudyRow[] };
type InvestedAssetClassSlice = {
  key: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
};
type InvestedGeographicSlice = {
  key: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
};
type PieLabelPoint = { label: string; percentage: number };
type PieLabelRendererProps = { cx: number; cy: number; midAngle: number; outerRadius: number; index: number };

const COLORS = ['#0ea5e9', '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#14b8a6'];
const INVESTED_ASSET_CLASS_COLORS = ['#94A3B8', '#38BDF8', '#F59E0B', '#10B981', '#14B8A6', '#6366F1', '#EF4444', '#CBD5E1'];
const INVESTED_PIE_LABEL_MIN_GAP = 12;
const INVESTED_PIE_LABEL_OUTER_OFFSET = 12;
const INVESTED_PIE_LABEL_SIDE_OFFSET = 20;
const GEOGRAPHIC_ASSET_CLASS_FILTER_OPTIONS = ['AZIONARIO', 'OBBLIGAZIONARIO', 'COMMODITIES', 'MONETARIO'] as const;
const mk = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
const pct = (v: number | null | undefined) => (!Number.isFinite(v ?? NaN) ? 'N/A' : `${((v as number) * 100).toFixed(2)}%`);
const month = (d: string) => new Date(d).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });

type GeographicAssetClassFilter = (typeof GEOGRAPHIC_ASSET_CLASS_FILTER_OPTIONS)[number];
type GeographicAssetClassCanonical = GeographicAssetClassFilter | 'ALTRO';
type GeographicExposureTableRow = {
  country: string;
  amount: number;
  percentage: number;
  etfs: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeGeographicAssetClass(assetClassName: string): GeographicAssetClassCanonical {
  const normalized = assetClassName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  if (normalized.includes('AZIONARIO')) return 'AZIONARIO';
  if (normalized.includes('OBBLIGAZIONARIO')) return 'OBBLIGAZIONARIO';
  if (normalized.includes('COMMODITIES')) return 'COMMODITIES';
  if (normalized.includes('MONETARIO')) return 'MONETARIO';
  return 'ALTRO';
}

function buildGeographicExposureTableRows(
  countries: PortfolioGeographicExposureCountryDTO[],
  selectedFilters: GeographicAssetClassFilter[],
  resolveEtfAssetClass: (etfSymbol: string) => GeographicAssetClassCanonical,
): GeographicExposureTableRow[] {
  const selectedFilterSet = new Set(selectedFilters);
  const isAllSelected = selectedFilterSet.size === 0;

  const rows = countries
    .map((country) => {
      const amount = isAllSelected
        ? country.amount
        : (country.assetClassBreakdown ?? [])
            .filter((entry) => {
              const normalizedAssetClass = normalizeGeographicAssetClass(entry.assetClass);
              return normalizedAssetClass !== 'ALTRO' && selectedFilterSet.has(normalizedAssetClass);
            })
            .reduce((sum, entry) => sum + Math.max(0, Number(entry.amount)), 0);

      const etfs = isAllSelected
        ? [...(country.etfs ?? [])]
        : (country.etfs ?? []).filter((etfSymbol) => {
            const normalizedAssetClass = resolveEtfAssetClass(etfSymbol);
            return normalizedAssetClass !== 'ALTRO' && selectedFilterSet.has(normalizedAssetClass);
          });

      return {
        country: country.country,
        amount,
        etfs: Array.from(new Set(etfs)).sort((left, right) => left.localeCompare(right)),
      };
    })
    .filter((row) => Number.isFinite(row.amount) && row.amount > 0.0001)
    .sort((left, right) => right.amount - left.amount);

  const filteredTotal = rows.reduce((sum, row) => sum + row.amount, 0);
  return rows.map((row) => ({
    ...row,
    percentage: filteredTotal > 0 ? (row.amount / filteredTotal) * 100 : 0,
  }));
}

function createPieLabelRenderer(points: PieLabelPoint[]) {
  const slotsBySide: Record<'left' | 'right', Array<{ index: number; y: number }>> = {
    left: [],
    right: [],
  };

  const reserveY = (side: 'left' | 'right', index: number, desiredY: number, yMin: number, yMax: number): number => {
    const slots = slotsBySide[side];
    slots.push({ index, y: clamp(desiredY, yMin, yMax) });
    slots.sort((a, b) => a.y - b.y);

    for (let i = 1; i < slots.length; i += 1) {
      if (slots[i].y - slots[i - 1].y < INVESTED_PIE_LABEL_MIN_GAP) {
        slots[i].y = slots[i - 1].y + INVESTED_PIE_LABEL_MIN_GAP;
      }
    }

    if (slots.length > 0 && slots[slots.length - 1].y > yMax) {
      slots[slots.length - 1].y = yMax;
      for (let i = slots.length - 2; i >= 0; i -= 1) {
        if (slots[i + 1].y - slots[i].y < INVESTED_PIE_LABEL_MIN_GAP) {
          slots[i].y = slots[i + 1].y - INVESTED_PIE_LABEL_MIN_GAP;
        }
      }
    }

    if (slots.length > 0 && slots[0].y < yMin) {
      const shift = yMin - slots[0].y;
      slots.forEach((slot) => {
        slot.y = clamp(slot.y + shift, yMin, yMax);
      });
    }

    return slots.find((slot) => slot.index === index)?.y ?? clamp(desiredY, yMin, yMax);
  };

  return (props: PieLabelRendererProps) => {
    const point = points[props.index];
    if (!point) return null;

    const angle = (-props.midAngle * Math.PI) / 180;
    const isRightSide = Math.cos(angle) >= 0;
    const side: 'left' | 'right' = isRightSide ? 'right' : 'left';
    const yMin = props.cy - (props.outerRadius + 18);
    const yMax = props.cy + (props.outerRadius + 18);
    const desiredY = props.cy + Math.sin(angle) * (props.outerRadius + INVESTED_PIE_LABEL_OUTER_OFFSET);
    const y = reserveY(side, props.index, desiredY, yMin, yMax);
    const startX = props.cx + Math.cos(angle) * (props.outerRadius + 1);
    const startY = props.cy + Math.sin(angle) * (props.outerRadius + 1);
    const elbowX = props.cx + (isRightSide ? 1 : -1) * (props.outerRadius + 8);
    const text = `${point.label} ${point.percentage.toFixed(1)}%`;
    const chartWidth = props.cx * 2;
    const estimatedTextWidth = text.length * 5.1;

    let labelX = props.cx + (isRightSide ? 1 : -1) * (props.outerRadius + INVESTED_PIE_LABEL_SIDE_OFFSET);
    let anchor: 'start' | 'end' = isRightSide ? 'start' : 'end';

    if (!isRightSide) {
      const minXForEndAnchor = estimatedTextWidth + 6;
      if (labelX < minXForEndAnchor) {
        labelX = 6;
        anchor = 'start';
      }
    } else {
      const maxXForStartAnchor = chartWidth - estimatedTextWidth - 6;
      if (labelX > maxXForStartAnchor) {
        labelX = chartWidth - 6;
        anchor = 'end';
      }
    }

    const textX = anchor === 'start' ? labelX + 2 : labelX - 2;

    return (
      <g>
        <path
          d={`M ${startX} ${startY}
               L ${elbowX} ${y}
               L ${labelX} ${y}`}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth={1}
        />
        <text
          x={textX}
          y={y}
          textAnchor={anchor}
          dominantBaseline="central"
          fontSize={8.5}
          fontWeight={600}
          fill="#334155"
        >
          {text}
        </text>
      </g>
    );
  };
}

function normalizeInvestedForSave(positions: Invested[]): Invested[] {
  const bySymbol = new Map<string, number>();
  positions.forEach((item) => {
    const symbol = item.symbol.trim().toUpperCase();
    const amount = Number(item.amount);
    if (!symbol || !Number.isFinite(amount) || amount <= 0) return;
    bySymbol.set(symbol, (bySymbol.get(symbol) ?? 0) + amount);
  });
  return Array.from(bySymbol.entries())
    .map(([symbol, amount]) => ({ symbol, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

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
  const [horizon, setHorizon] = useState<Horizon>('3Y');
  const [inputValue, setInputValue] = useState<PortfolioInputValueModeDTO>('quote_with_dividends');
  const [riskFreeAnnual, setRiskFreeAnnual] = useState('0.03');
  const [study, setStudy] = useState<StudyPortfolio[]>(defaultStudy());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortfolioCompareResponseDTO | null>(null);
  const [assetClasses, setAssetClasses] = useState<PortfolioAssetClassDTO[]>([]);
  const [instruments, setInstruments] = useState<PortfolioInstrumentDTO[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [geographicExposure, setGeographicExposure] = useState<PortfolioGeographicExposureResponseDTO | null>(null);
  const [geographicExposureLoading, setGeographicExposureLoading] = useState(false);
  const [geographicExposureError, setGeographicExposureError] = useState<string | null>(null);
  const [isGeographicModalOpen, setIsGeographicModalOpen] = useState(false);
  const [geographicAssetClassFilters, setGeographicAssetClassFilters] = useState<GeographicAssetClassFilter[]>([]);
  const [sectorExposure, setSectorExposure] = useState<PortfolioSectorExposureResponseDTO | null>(null);
  const [sectorExposureLoading, setSectorExposureLoading] = useState(false);
  const [sectorExposureError, setSectorExposureError] = useState<string | null>(null);
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [companyExposure, setCompanyExposure] = useState<PortfolioCompanyExposureResponseDTO | null>(null);
  const [companyExposureLoading, setCompanyExposureLoading] = useState(false);
  const [companyExposureError, setCompanyExposureError] = useState<string | null>(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [studyGeographicExposure, setStudyGeographicExposure] = useState<PortfolioGeographicExposureResponseDTO | null>(null);
  const [studyGeographicExposureLoading, setStudyGeographicExposureLoading] = useState(false);
  const [studyGeographicExposureError, setStudyGeographicExposureError] = useState<string | null>(null);
  const [isStudyGeographicModalOpen, setIsStudyGeographicModalOpen] = useState(false);
  const [studyGeographicAssetClassFilters, setStudyGeographicAssetClassFilters] = useState<GeographicAssetClassFilter[]>([]);
  const [studyGeographicPortfolioName, setStudyGeographicPortfolioName] = useState('');
  const [studyGeographicActivePortfolioId, setStudyGeographicActivePortfolioId] = useState<string | null>(null);
  const [studyGeographicBaseAmount, setStudyGeographicBaseAmount] = useState(0);
  const [studySectorExposure, setStudySectorExposure] = useState<PortfolioSectorExposureResponseDTO | null>(null);
  const [studySectorExposureLoading, setStudySectorExposureLoading] = useState(false);
  const [studySectorExposureError, setStudySectorExposureError] = useState<string | null>(null);
  const [isStudySectorModalOpen, setIsStudySectorModalOpen] = useState(false);
  const [studySectorPortfolioName, setStudySectorPortfolioName] = useState('');
  const [studySectorActivePortfolioId, setStudySectorActivePortfolioId] = useState<string | null>(null);
  const [studySectorBaseAmount, setStudySectorBaseAmount] = useState(0);
  const [studyCompanyExposure, setStudyCompanyExposure] = useState<PortfolioCompanyExposureResponseDTO | null>(null);
  const [studyCompanyExposureLoading, setStudyCompanyExposureLoading] = useState(false);
  const [studyCompanyExposureError, setStudyCompanyExposureError] = useState<string | null>(null);
  const [isStudyCompanyModalOpen, setIsStudyCompanyModalOpen] = useState(false);
  const [studyCompanyPortfolioName, setStudyCompanyPortfolioName] = useState('');
  const [studyCompanyActivePortfolioId, setStudyCompanyActivePortfolioId] = useState<string | null>(null);
  const [studyCompanyBaseAmount, setStudyCompanyBaseAmount] = useState(0);
  const [isInvestedOpen, setIsInvestedOpen] = useState(true);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isStudyPerformanceModalOpen, setIsStudyPerformanceModalOpen] = useState(false);
  const [isStudyPerformanceOverlayModalOpen, setIsStudyPerformanceOverlayModalOpen] = useState(false);
  const [studyPerformanceMetric, setStudyPerformanceMetric] = useState<PortfolioStaticPerformanceMetricDTO>('relative');
  const [isInvestedModalOpen, setIsInvestedModalOpen] = useState(false);
  const [investedDraft, setInvestedDraft] = useState<InvestedDraft | null>(null);
  const [editingInvestedSymbol, setEditingInvestedSymbol] = useState<string | null>(null);
  const [investedDraftError, setInvestedDraftError] = useState<string | null>(null);
  const [savingInvestedDraft, setSavingInvestedDraft] = useState(false);
  const [instrumentModalMode, setInstrumentModalMode] = useState<'invested' | 'portfolio'>('invested');
  const [portfolioDraftTargetRowId, setPortfolioDraftTargetRowId] = useState<string | null>(null);
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [portfolioDraft, setPortfolioDraft] = useState<StudyPortfolio | null>(null);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [portfolioDraftError, setPortfolioDraftError] = useState<string | null>(null);
  const [isInvestedLoaded, setIsInvestedLoaded] = useState(false);
  const skipNextInvestedSaveRef = useRef(true);

  const instrumentBySymbol = useMemo(
    () => new Map(instruments.map((instrument) => [instrument.symbol.toUpperCase(), instrument])),
    [instruments],
  );

  const investedTotal = useMemo(() => invested.reduce((s, p) => s + Math.max(0, p.amount), 0), [invested]);
  const investedSplit = useMemo(() => {
    const equity = invested.reduce((sum, item) => {
      const instrument = instrumentBySymbol.get(item.symbol.toUpperCase());
      if (!instrument || instrument.assetClassName.toUpperCase() !== 'AZIONARIO') return sum;
      return sum + Math.max(0, item.amount);
    }, 0);
    const bond = invested.reduce((sum, item) => {
      const instrument = instrumentBySymbol.get(item.symbol.toUpperCase());
      if (!instrument || instrument.assetClassName.toUpperCase() !== 'OBBLIGAZIONARIO') return sum;
      return sum + Math.max(0, item.amount);
    }, 0);
    return { equity, bond };
  }, [invested, instrumentBySymbol]);
  const investedAssetClassChart = useMemo(() => {
    const totals = new Map<string, number>();

    invested.forEach((item) => {
      const amount = Math.max(0, item.amount);
      if (!amount) return;
      const className = instrumentBySymbol.get(item.symbol.toUpperCase())?.assetClassName?.trim().toUpperCase() || 'NON CLASSIFICATO';
      totals.set(className, (totals.get(className) ?? 0) + amount);
    });

    const preferredOrder = ['AZIONARIO', 'OBBLIGAZIONARIO', 'COMMODITIES', 'MONETARIO'];
    const orderedKeys = [
      ...preferredOrder.filter((assetClass) => totals.has(assetClass)),
      ...Array.from(totals.keys())
        .filter((assetClass) => !preferredOrder.includes(assetClass))
        .sort((a, b) => a.localeCompare(b)),
    ];

    const total = orderedKeys.reduce((sum, key) => sum + (totals.get(key) ?? 0), 0);
    const slices: InvestedAssetClassSlice[] = orderedKeys.map((key, index) => {
      const value = totals.get(key) ?? 0;
      return {
        key,
        label: key,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: INVESTED_ASSET_CLASS_COLORS[index % INVESTED_ASSET_CLASS_COLORS.length],
      };
    });

    return { total, slices };
  }, [invested, instrumentBySymbol]);
  const investedEtfPositions = useMemo(() => {
    const byIsin = new Map<string, number>();
    invested.forEach((position) => {
      const instrument = instrumentBySymbol.get(position.symbol.toUpperCase());
      const isin = instrument?.isin?.trim().toUpperCase() ?? '';
      const amount = Math.max(0, Number(position.amount));

      if (!isin || !amount) return;
      byIsin.set(isin, (byIsin.get(isin) ?? 0) + amount);
    });

    return Array.from(byIsin.entries()).map(([isin, amount]) => ({ isin, amount }));
  }, [invested, instrumentBySymbol]);
  const geographicExposureChart = useMemo(() => {
    const slices: InvestedGeographicSlice[] = (geographicExposure?.countries ?? []).map((country, index) => ({
      key: country.country,
      label: country.country,
      value: country.amount,
      percentage: country.percentage * 100,
      color: INVESTED_ASSET_CLASS_COLORS[index % INVESTED_ASSET_CLASS_COLORS.length],
    }));

    return {
      total: geographicExposure?.totalAmount ?? 0,
      slices,
    };
  }, [geographicExposure]);
  const sectorExposureChart = useMemo(() => {
    const slices: InvestedGeographicSlice[] = (sectorExposure?.sectors ?? []).map((sector, index) => ({
      key: sector.sector,
      label: sector.sector,
      value: sector.amount,
      percentage: sector.percentage * 100,
      color: INVESTED_ASSET_CLASS_COLORS[index % INVESTED_ASSET_CLASS_COLORS.length],
    }));

    return {
      total: sectorExposure?.totalAmount ?? 0,
      slices,
    };
  }, [sectorExposure]);
  const companyExposureChart = useMemo(() => {
    const slices: InvestedGeographicSlice[] = (companyExposure?.companies ?? []).map((company, index) => ({
      key: `${company.company}-${company.isin ?? 'NA'}`,
      label: company.company,
      value: company.amount,
      percentage: company.percentage * 100,
      color: INVESTED_ASSET_CLASS_COLORS[index % INVESTED_ASSET_CLASS_COLORS.length],
    }));

    return {
      total: companyExposure?.totalAmount ?? 0,
      slices,
    };
  }, [companyExposure]);
  const studyGeographicExposureChart = useMemo(() => {
    const slices: InvestedGeographicSlice[] = (studyGeographicExposure?.countries ?? []).map((country, index) => ({
      key: country.country,
      label: country.country,
      value: country.amount,
      percentage: country.percentage * 100,
      color: INVESTED_ASSET_CLASS_COLORS[index % INVESTED_ASSET_CLASS_COLORS.length],
    }));

    return {
      total: studyGeographicExposure?.totalAmount ?? 0,
      slices,
    };
  }, [studyGeographicExposure]);
  const studySectorExposureChart = useMemo(() => {
    const slices: InvestedGeographicSlice[] = (studySectorExposure?.sectors ?? []).map((sector, index) => ({
      key: sector.sector,
      label: sector.sector,
      value: sector.amount,
      percentage: sector.percentage * 100,
      color: INVESTED_ASSET_CLASS_COLORS[index % INVESTED_ASSET_CLASS_COLORS.length],
    }));

    return {
      total: studySectorExposure?.totalAmount ?? 0,
      slices,
    };
  }, [studySectorExposure]);
  const studyCompanyExposureChart = useMemo(() => {
    const slices: InvestedGeographicSlice[] = (studyCompanyExposure?.companies ?? []).map((company, index) => ({
      key: `${company.company}-${company.isin ?? 'NA'}`,
      label: company.company,
      value: company.amount,
      percentage: company.percentage * 100,
      color: INVESTED_ASSET_CLASS_COLORS[index % INVESTED_ASSET_CLASS_COLORS.length],
    }));

    return {
      total: studyCompanyExposure?.totalAmount ?? 0,
      slices,
    };
  }, [studyCompanyExposure]);
  const resolveEtfAssetClass = useCallback(
    (etfSymbol: string): GeographicAssetClassCanonical =>
      normalizeGeographicAssetClass(
        instrumentBySymbol.get(etfSymbol.trim().toUpperCase())?.assetClassName ?? 'ALTRO',
      ),
    [instrumentBySymbol],
  );
  const geographicExposureTableRows = useMemo(
    () =>
      buildGeographicExposureTableRows(
        geographicExposure?.countries ?? [],
        geographicAssetClassFilters,
        resolveEtfAssetClass,
      ),
    [geographicAssetClassFilters, geographicExposure?.countries, resolveEtfAssetClass],
  );
  const studyGeographicExposureTableRows = useMemo(
    () =>
      buildGeographicExposureTableRows(
        studyGeographicExposure?.countries ?? [],
        studyGeographicAssetClassFilters,
        resolveEtfAssetClass,
      ),
    [resolveEtfAssetClass, studyGeographicAssetClassFilters, studyGeographicExposure?.countries],
  );

  const renderInvestedPieLabel = useMemo(
    () => createPieLabelRenderer(investedAssetClassChart.slices),
    [investedAssetClassChart.slices],
  );
  const universeByLabel = useMemo(
    () =>
      instruments.reduce<Record<string, string>>((acc, instrument) => {
        acc[instrument.symbol] = instrument.isin;
        return acc;
      }, {}),
    [instruments],
  );

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

  const refreshCatalog = useCallback(async () => {
    try {
      setCatalogLoading(true);
      setCatalogError(null);
      const [nextAssetClasses, nextInstruments] = await Promise.all([
        portfolioApi.getAssetClasses(),
        portfolioApi.getInstruments(),
      ]);
      setAssetClasses(nextAssetClasses);
      setInstruments(nextInstruments);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Errore caricamento anagrafica strumenti');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    let isCancelled = false;

    const loadInvested = async () => {
      try {
        const persisted = await portfolioApi.getInvested();
        if (isCancelled) return;
        if (persisted.hasSaved) {
          setInvested(
            normalizeInvestedForSave(
              persisted.positions.map((position) => ({
                symbol: position.symbol,
                amount: position.amount,
              })),
            ),
          );
        }
      } catch (err) {
        console.error('Unable to load invested portfolio from DB', err);
      } finally {
        if (!isCancelled) setIsInvestedLoaded(true);
      }
    };

    void loadInvested();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isInvestedLoaded) return;
    if (skipNextInvestedSaveRef.current) {
      skipNextInvestedSaveRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      void portfolioApi.updateInvested({
        positions: normalizeInvestedForSave(invested),
      }).catch((err) => {
        console.error('Unable to persist invested portfolio to DB', err);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [invested, isInvestedLoaded]);

  useEffect(() => {
    let isCancelled = false;

    const loadGeographicExposure = async () => {
      if (investedEtfPositions.length === 0) {
        setGeographicExposure(null);
        setGeographicExposureError(null);
        setGeographicExposureLoading(false);
        return;
      }

      try {
        setGeographicExposureLoading(true);
        setGeographicExposureError(null);

        const response = await portfolioApi.getGeographicExposure({ positions: investedEtfPositions });
        if (isCancelled) return;
        setGeographicExposure(response);
      } catch (err) {
        if (isCancelled) return;
        setGeographicExposure(null);
        setGeographicExposureError(err instanceof Error ? err.message : 'Errore caricamento esposizione geografica');
      } finally {
        if (!isCancelled) {
          setGeographicExposureLoading(false);
        }
      }
    };

    void loadGeographicExposure();

    return () => {
      isCancelled = true;
    };
  }, [investedEtfPositions]);

  useEffect(() => {
    let isCancelled = false;

    const loadCompanyExposure = async () => {
      if (investedEtfPositions.length === 0) {
        setCompanyExposure(null);
        setCompanyExposureError(null);
        setCompanyExposureLoading(false);
        return;
      }

      try {
        setCompanyExposureLoading(true);
        setCompanyExposureError(null);

        const response = await portfolioApi.getCompanyExposure({ positions: investedEtfPositions });
        if (isCancelled) return;
        setCompanyExposure(response);
      } catch (err) {
        if (isCancelled) return;
        setCompanyExposure(null);
        setCompanyExposureError(err instanceof Error ? err.message : 'Errore caricamento esposizione aziende');
      } finally {
        if (!isCancelled) {
          setCompanyExposureLoading(false);
        }
      }
    };

    void loadCompanyExposure();

    return () => {
      isCancelled = true;
    };
  }, [investedEtfPositions]);

  useEffect(() => {
    let isCancelled = false;

    const loadSectorExposure = async () => {
      if (investedEtfPositions.length === 0) {
        setSectorExposure(null);
        setSectorExposureError(null);
        setSectorExposureLoading(false);
        return;
      }

      try {
        setSectorExposureLoading(true);
        setSectorExposureError(null);

        const response = await portfolioApi.getSectorExposure({ positions: investedEtfPositions });
        if (isCancelled) return;
        setSectorExposure(response);
      } catch (err) {
        if (isCancelled) return;
        setSectorExposure(null);
        setSectorExposureError(err instanceof Error ? err.message : 'Errore caricamento esposizione settoriale');
      } finally {
        if (!isCancelled) {
          setSectorExposureLoading(false);
        }
      }
    };

    void loadSectorExposure();

    return () => {
      isCancelled = true;
    };
  }, [investedEtfPositions]);

  const firstAssetClassId = assetClasses[0]?.id ?? '';
  const firstInstrument = instruments[0] ?? null;
  const isInstrumentCatalogMode = instrumentModalMode === 'portfolio';

  const openCreateInvestedModal = () => {
    setInstrumentModalMode('invested');
    setPortfolioDraftTargetRowId(null);
    setEditingInvestedSymbol(null);
    setInvestedDraftError(null);
    setInvestedDraft({
      amount: '1000',
      instrumentId: firstInstrument?.id ?? null,
      symbol: firstInstrument?.symbol ?? '',
      name: firstInstrument?.name ?? '',
      isin: firstInstrument?.isin ?? '',
      assetClassId: firstInstrument?.assetClassId ?? firstAssetClassId,
      newAssetClassName: '',
      renameAssetClassName: '',
    });
    setIsInvestedModalOpen(true);
  };

  const openCreateInstrumentForPortfolioDraft = (rowId: string) => {
    setInstrumentModalMode('portfolio');
    setPortfolioDraftTargetRowId(rowId);
    setEditingInvestedSymbol(null);
    setInvestedDraftError(null);
    setInvestedDraft({
      amount: '1000',
      instrumentId: null,
      symbol: '',
      name: '',
      isin: '',
      assetClassId: firstAssetClassId,
      newAssetClassName: '',
      renameAssetClassName: '',
    });
    setIsInvestedModalOpen(true);
  };

  const openEditInvestedModal = (item: Invested) => {
    const instrument = instrumentBySymbol.get(item.symbol.toUpperCase()) ?? null;
    setEditingInvestedSymbol(item.symbol.toUpperCase());
    setInvestedDraftError(null);
    setInvestedDraft({
      amount: String(item.amount),
      instrumentId: instrument?.id ?? null,
      symbol: instrument?.symbol ?? item.symbol.toUpperCase(),
      name: instrument?.name ?? '',
      isin: instrument?.isin ?? '',
      assetClassId: instrument?.assetClassId ?? firstAssetClassId,
      newAssetClassName: '',
      renameAssetClassName: '',
    });
    setIsInvestedModalOpen(true);
  };

  const closeInvestedModal = () => {
    setIsInvestedModalOpen(false);
    setInvestedDraft(null);
    setEditingInvestedSymbol(null);
    setInvestedDraftError(null);
    setSavingInvestedDraft(false);
    setInstrumentModalMode('invested');
    setPortfolioDraftTargetRowId(null);
  };

  const onDraftInstrumentSelect = (instrumentId: string) => {
    if (!investedDraft) return;
    if (instrumentId === '__new__') {
      setInvestedDraft({
        ...investedDraft,
        instrumentId: null,
        symbol: '',
        name: '',
        isin: '',
      });
      return;
    }
    const selected = instruments.find((item) => item.id === instrumentId);
    if (!selected) return;
    setInvestedDraft({
      ...investedDraft,
      instrumentId: selected.id,
      symbol: selected.symbol,
      name: selected.name,
      isin: selected.isin,
      assetClassId: selected.assetClassId,
      renameAssetClassName: '',
    });
  };

  const saveInvestedFromModal = async () => {
    if (!investedDraft) return;
    const isCatalogMode = instrumentModalMode === 'portfolio';
    const amount = Number(investedDraft.amount.replace(',', '.'));
    if (!isCatalogMode && (!Number.isFinite(amount) || amount <= 0)) {
      setInvestedDraftError('Inserisci un importo valido maggiore di 0');
      return;
    }

    const symbol = investedDraft.symbol.trim().toUpperCase();
    const name = investedDraft.name.trim();
    const isin = investedDraft.isin.trim().toUpperCase();
    if (!symbol || !name || !isin) {
      setInvestedDraftError('Compila simbolo, nome e ISIN dello strumento');
      return;
    }

    let selectedAssetClassId = investedDraft.assetClassId;
    if (!selectedAssetClassId && !investedDraft.newAssetClassName.trim()) {
      setInvestedDraftError("Seleziona un'asset class o creane una nuova");
      return;
    }

    try {
      setSavingInvestedDraft(true);
      setInvestedDraftError(null);

      if (selectedAssetClassId && investedDraft.renameAssetClassName.trim()) {
        const updatedClass = await portfolioApi.updateAssetClass(selectedAssetClassId, {
          name: investedDraft.renameAssetClassName.trim(),
        });
        setAssetClasses((prev) => prev.map((item) => (item.id === updatedClass.id ? updatedClass : item)));
      }

      if (investedDraft.newAssetClassName.trim()) {
        const createdClass = await portfolioApi.createAssetClass({ name: investedDraft.newAssetClassName.trim() });
        setAssetClasses((prev) => [...prev, createdClass].sort((a, b) => a.name.localeCompare(b.name)));
        selectedAssetClassId = createdClass.id;
      }

      if (!selectedAssetClassId) {
        setInvestedDraftError("Asset class non valida. Selezionane una o creane una nuova");
        setSavingInvestedDraft(false);
        return;
      }

      const savedInstrument = investedDraft.instrumentId
        ? await portfolioApi.updateInstrument(investedDraft.instrumentId, {
            symbol,
            name,
            isin,
            assetClassId: selectedAssetClassId,
          })
        : await portfolioApi.createInstrument({
            symbol,
            name,
            isin,
            assetClassId: selectedAssetClassId,
          });

      setInstruments((prev) => {
        const exists = prev.some((item) => item.id === savedInstrument.id);
        const next = exists
          ? prev.map((item) => (item.id === savedInstrument.id ? savedInstrument : item))
          : [...prev, savedInstrument];
        return next.sort((a, b) => a.symbol.localeCompare(b.symbol));
      });

      if (isCatalogMode) {
        if (portfolioDraftTargetRowId) {
          setPortfolioDraft((prev) =>
            prev
              ? {
                  ...prev,
                  rows: prev.rows.map((row) =>
                    row.id === portfolioDraftTargetRowId
                      ? { ...row, label: savedInstrument.symbol }
                      : row
                  ),
                }
              : prev,
          );
        }
        closeInvestedModal();
        return;
      }

      setInvested((prev) => {
        const savedSymbol = savedInstrument.symbol.toUpperCase();
        if (editingInvestedSymbol) {
          const withoutEditing = prev.filter((p) => p.symbol.toUpperCase() !== editingInvestedSymbol);
          const targetIndex = withoutEditing.findIndex((p) => p.symbol.toUpperCase() === savedSymbol);
          if (targetIndex >= 0) {
            const next = [...withoutEditing];
            next[targetIndex] = { symbol: savedSymbol, amount: next[targetIndex].amount + amount };
            return next;
          }
          return [...withoutEditing, { symbol: savedSymbol, amount }];
        }

        const existingIndex = prev.findIndex((p) => p.symbol.toUpperCase() === savedSymbol);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = { symbol: savedSymbol, amount: next[existingIndex].amount + amount };
          return next;
        }
        return [...prev, { symbol: savedSymbol, amount }];
      });

      closeInvestedModal();
    } catch (err) {
      setInvestedDraftError(err instanceof Error ? err.message : 'Errore salvataggio strumento');
      setSavingInvestedDraft(false);
    }
  };

  const openCreatePortfolioModal = () => {
    const defaultSymbol = instruments[0]?.symbol ?? '';
    setEditingPortfolioId(null);
    setPortfolioDraftError(null);
    setPortfolioDraft({
      id: mk('p'),
      name: `PORTFOLIO ${study.length + 1}`,
      rows: [{ id: mk('r'), label: defaultSymbol, weight: '10' }],
    });
    setIsPortfolioModalOpen(true);
  };

  const openEditPortfolioModal = (portfolio: StudyPortfolio) => {
    setEditingPortfolioId(portfolio.id);
    setPortfolioDraftError(null);
    setPortfolioDraft({
      id: portfolio.id,
      name: portfolio.name,
      rows: portfolio.rows.map((row) => ({ id: mk('r'), label: row.label, weight: row.weight })),
    });
    setIsPortfolioModalOpen(true);
  };

  const closePortfolioModal = () => {
    setIsPortfolioModalOpen(false);
    setPortfolioDraft(null);
    setEditingPortfolioId(null);
    setPortfolioDraftError(null);
  };

  const savePortfolioFromModal = () => {
    if (!portfolioDraft) return;
    const nextName = portfolioDraft.name.trim() || `PORTFOLIO ${study.length + 1}`;
    const nextRows = portfolioDraft.rows
      .map((row) => ({
        label: row.label.trim(),
        weight: row.weight.replace(',', '.').trim(),
      }))
      .filter((row) => {
        const weight = Number(row.weight);
        return row.label.length > 0 && Number.isFinite(weight) && weight > 0;
      })
      .map((row) => ({ id: mk('r'), label: row.label, weight: row.weight }));

    if (!nextRows.length) {
      setPortfolioDraftError('Inserisci almeno uno strumento con peso maggiore di 0');
      return;
    }

    if (editingPortfolioId) {
      setStudy((prev) => prev.map((p) => (p.id === editingPortfolioId ? { ...p, name: nextName, rows: nextRows } : p)));
    } else {
      setStudy((prev) => [...prev, { id: mk('p'), name: nextName, rows: nextRows }]);
    }
    closePortfolioModal();
  };

  const importInvestedAsStudyPortfolio = () => {
    setError(null);

    const validPositions = invested
      .map((position) => ({
        symbol: position.symbol.trim().toUpperCase(),
        amount: Number(position.amount),
      }))
      .filter((position) => position.symbol.length > 0 && Number.isFinite(position.amount) && position.amount > 0)
      .filter((position) => instrumentBySymbol.has(position.symbol));

    const totalAmount = validPositions.reduce((sum, position) => sum + position.amount, 0);
    if (validPositions.length === 0 || totalAmount <= 0) {
      setError('Impossibile importare: nessuno strumento valido nel portafoglio investito');
      return;
    }

    const importedRows = validPositions.map((position) => ({
      id: mk('r'),
      label: position.symbol,
      weight: ((position.amount / totalAmount) * 100).toFixed(2),
    }));

    const importedName = 'portafoglio investito';

    setStudy((prev) => {
      const existingIndex = prev.findIndex((portfolio) => portfolio.name.trim().toLowerCase() === importedName);
      if (existingIndex < 0) {
        return [...prev, { id: mk('p'), name: importedName, rows: importedRows }];
      }

      return prev.map((portfolio, index) =>
        index === existingIndex
          ? { ...portfolio, name: importedName, rows: importedRows }
          : portfolio
      );
    });
  };

  const buildStudyExposurePositions = (portfolio: StudyPortfolio) => {
    const weightedRows = portfolio.rows
      .map((row) => {
        const symbol = row.label.trim().toUpperCase();
        const weight = Number(row.weight.replace(',', '.'));
        const isin = instrumentBySymbol.get(symbol)?.isin?.trim().toUpperCase() ?? '';
        return { isin, weight };
      })
      .filter((row) => row.isin.length > 0 && Number.isFinite(row.weight) && row.weight > 0);

    const totalWeight = weightedRows.reduce((sum, row) => sum + row.weight, 0);
    if (weightedRows.length === 0 || totalWeight <= 0) {
      return {
        error: 'Nessuno strumento valido con ISIN e peso > 0 nel portafoglio di studio',
        baseAmount: 0,
        positions: [] as Array<{ isin: string; amount: number }>,
      };
    }

    const baseAmount = investedTotal > 0 ? investedTotal : totalWeight;
    const positionsByIsin = new Map<string, number>();
    weightedRows.forEach((row) => {
      const amount = (row.weight / totalWeight) * baseAmount;
      positionsByIsin.set(row.isin, (positionsByIsin.get(row.isin) ?? 0) + amount);
    });

    const positions = Array.from(positionsByIsin.entries())
      .map(([isin, amount]) => ({ isin, amount }))
      .filter((position) => Number.isFinite(position.amount) && position.amount > 0);

    if (positions.length === 0) {
      return {
        error: 'Impossibile costruire le posizioni per questo portafoglio di studio',
        baseAmount,
        positions: [] as Array<{ isin: string; amount: number }>,
      };
    }

    return { error: null, baseAmount, positions };
  };

  const buildStudyPerformancePositions = (portfolio: StudyPortfolio) => {
    const rows = portfolio.rows
      .map((row) => {
        const symbol = row.label.trim().toUpperCase();
        const weight = Number(row.weight.replace(',', '.'));
        const isin = instrumentBySymbol.get(symbol)?.isin?.trim().toUpperCase() ?? '';
        return { isin, weight };
      })
      .filter((row) => row.isin.length > 0 && Number.isFinite(row.weight) && row.weight > 0);

    if (rows.length === 0) {
      return {
        error: 'Nessuno strumento valido con ISIN e peso > 0',
        positions: [] as Array<{ isin: string; amount: number }>,
      };
    }

    const positionsByIsin = new Map<string, number>();
    rows.forEach((row) => {
      positionsByIsin.set(row.isin, (positionsByIsin.get(row.isin) ?? 0) + row.weight);
    });

    const positions = Array.from(positionsByIsin.entries())
      .map(([isin, amount]) => ({ isin, amount }))
      .filter((position) => Number.isFinite(position.amount) && position.amount > 0);

    if (positions.length === 0) {
      return {
        error: 'Impossibile costruire una composizione valida',
        positions: [] as Array<{ isin: string; amount: number }>,
      };
    }

    return { error: null, positions };
  };

  const studyPerformanceCards = useMemo(
    () =>
      study.map((portfolio) => {
        const built = buildStudyPerformancePositions(portfolio);
        return {
          id: portfolio.id,
          name: portfolio.name.trim() || 'Portafoglio di studio',
          positions: built.positions,
          error: built.error,
        };
      }),
    [study, instrumentBySymbol],
  );

  const studyPerformanceGridClass = useMemo(() => {
    const count = studyPerformanceCards.length;
    if (count <= 1) return 'grid grid-cols-1 gap-3';
    if (count <= 4) return 'grid grid-cols-1 md:grid-cols-2 gap-3';
    return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3';
  }, [studyPerformanceCards.length]);

  const hasStudyPerformanceOverlayData = useMemo(
    () => studyPerformanceCards.some((card) => !card.error && card.positions.length > 0),
    [studyPerformanceCards],
  );

  const closeStudyPerformanceModal = () => {
    setIsStudyPerformanceOverlayModalOpen(false);
    setIsStudyPerformanceModalOpen(false);
  };

  const toggleAssetClassFilter = (
    value: GeographicAssetClassFilter,
    setter: Dispatch<SetStateAction<GeographicAssetClassFilter[]>>,
  ) => {
    setter((prev) => {
      if (prev.includes(value)) return prev.filter((item) => item !== value);
      return [...prev, value];
    });
  };

  const openGeographicModal = () => {
    setGeographicAssetClassFilters([]);
    setIsGeographicModalOpen(true);
  };

  const closeGeographicModal = () => {
    setGeographicAssetClassFilters([]);
    setIsGeographicModalOpen(false);
  };

  const closeCompanyModal = () => {
    setIsCompanyModalOpen(false);
  };

  const closeStudyGeographicModal = () => {
    setStudyGeographicAssetClassFilters([]);
    setIsStudyGeographicModalOpen(false);
    setStudyGeographicActivePortfolioId(null);
  };

  const openStudyGeographicModal = async (portfolio: StudyPortfolio) => {
    setStudyGeographicPortfolioName(portfolio.name.trim() || 'Portafoglio di studio');
    setStudyGeographicExposure(null);
    setStudyGeographicExposureError(null);
    setStudyGeographicExposureLoading(true);
    setStudyGeographicAssetClassFilters([]);
    setStudyGeographicActivePortfolioId(portfolio.id);
    setIsStudyGeographicModalOpen(true);

    const studyExposure = buildStudyExposurePositions(portfolio);
    if (studyExposure.error) {
      setStudyGeographicExposureError(studyExposure.error);
      setStudyGeographicExposureLoading(false);
      setStudyGeographicActivePortfolioId(null);
      return;
    }

    setStudyGeographicBaseAmount(studyExposure.baseAmount);

    try {
      const response = await portfolioApi.getGeographicExposure({ positions: studyExposure.positions });
      setStudyGeographicExposure(response);
    } catch (err) {
      setStudyGeographicExposureError(err instanceof Error ? err.message : 'Errore caricamento esposizione geografica');
    } finally {
      setStudyGeographicExposureLoading(false);
      setStudyGeographicActivePortfolioId(null);
    }
  };

  const closeStudySectorModal = () => {
    setIsStudySectorModalOpen(false);
    setStudySectorActivePortfolioId(null);
  };

  const openStudySectorModal = async (portfolio: StudyPortfolio) => {
    setStudySectorPortfolioName(portfolio.name.trim() || 'Portafoglio di studio');
    setStudySectorExposure(null);
    setStudySectorExposureError(null);
    setStudySectorExposureLoading(true);
    setStudySectorActivePortfolioId(portfolio.id);
    setIsStudySectorModalOpen(true);

    const studyExposure = buildStudyExposurePositions(portfolio);
    if (studyExposure.error) {
      setStudySectorExposureError(studyExposure.error);
      setStudySectorExposureLoading(false);
      setStudySectorActivePortfolioId(null);
      return;
    }

    setStudySectorBaseAmount(studyExposure.baseAmount);

    try {
      const response = await portfolioApi.getSectorExposure({ positions: studyExposure.positions });
      setStudySectorExposure(response);
    } catch (err) {
      setStudySectorExposureError(err instanceof Error ? err.message : 'Errore caricamento esposizione settoriale');
    } finally {
      setStudySectorExposureLoading(false);
      setStudySectorActivePortfolioId(null);
    }
  };

  const closeStudyCompanyModal = () => {
    setIsStudyCompanyModalOpen(false);
    setStudyCompanyActivePortfolioId(null);
  };

  const openStudyCompanyModal = async (portfolio: StudyPortfolio) => {
    setStudyCompanyPortfolioName(portfolio.name.trim() || 'Portafoglio di studio');
    setStudyCompanyExposure(null);
    setStudyCompanyExposureError(null);
    setStudyCompanyExposureLoading(true);
    setStudyCompanyActivePortfolioId(portfolio.id);
    setIsStudyCompanyModalOpen(true);

    const studyExposure = buildStudyExposurePositions(portfolio);
    if (studyExposure.error) {
      setStudyCompanyExposureError(studyExposure.error);
      setStudyCompanyExposureLoading(false);
      setStudyCompanyActivePortfolioId(null);
      return;
    }

    setStudyCompanyBaseAmount(studyExposure.baseAmount);

    try {
      const response = await portfolioApi.getCompanyExposure({ positions: studyExposure.positions });
      setStudyCompanyExposure(response);
    } catch (err) {
      setStudyCompanyExposureError(err instanceof Error ? err.message : 'Errore caricamento esposizione aziende');
    } finally {
      setStudyCompanyExposureLoading(false);
      setStudyCompanyActivePortfolioId(null);
    }
  };

  const runCompare = async () => {
    setError(null);
    const rf = Number(riskFreeAnnual.replace(',', '.'));
    if (!Number.isFinite(rf)) return setError('Risk free non valido');
    if (Object.keys(universeByLabel).length === 0) {
      return setError('Nessuno strumento censito. Inserisci almeno uno strumento reale.');
    }

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
    <div className="sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56 space-y-3 xl:space-y-4">
      <div className="card !p-3">
        <div className="space-y-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Portafoglio</h2>
            <p className="text-sm text-slate-500">Confronto multi-portafoglio di studio su dati justETF.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
            <div className="flex flex-col">
              <div className="h-[220px] relative">
                {investedAssetClassChart.slices.length === 0 ? (
                  <div className="h-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                    Nessun dato disponibile per il grafico.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 12, right: 32, bottom: 12, left: 32 }}>
                        <Pie
                          data={investedAssetClassChart.slices}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={68}
                          minAngle={2}
                          paddingAngle={2}
                          startAngle={90}
                          endAngle={-270}
                          stroke="#ffffff"
                          strokeWidth={2}
                          labelLine={false}
                          label={renderInvestedPieLabel}
                        >
                          {investedAssetClassChart.slices.map((slice) => (
                            <Cell key={slice.key} fill={slice.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          wrapperStyle={{ zIndex: 40, pointerEvents: 'none' }}
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const point = payload[0]?.payload as InvestedAssetClassSlice | undefined;
                            if (!point) return null;

                            return (
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                                <p className="text-sm font-semibold text-slate-900">{point.label}</p>
                                <p className="text-sm text-slate-700 tabular-nums">{formatCurrency(point.value)}</p>
                                <p className="text-xs text-slate-500">{point.percentage.toFixed(1)}%</p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none px-3">
                      <p className="text-xs font-semibold text-slate-700">{formatCurrency(investedAssetClassChart.total)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="h-[220px] relative">
                {geographicExposureLoading ? (
                  <div className="h-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Caricamento esposizione geografica...
                  </div>
                ) : geographicExposureError ? (
                  <div className="h-full rounded-xl border border-red-200 bg-red-50 px-4 flex items-center justify-center text-sm text-red-700 text-center">
                    {geographicExposureError}
                  </div>
                ) : geographicExposureChart.slices.length === 0 ? (
                  <div className="h-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                    Nessun dato geografico disponibile.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 12, right: 32, bottom: 12, left: 32 }}>
                        <Pie
                          data={geographicExposureChart.slices}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={68}
                          minAngle={2}
                          paddingAngle={2}
                          startAngle={90}
                          endAngle={-270}
                          stroke="#ffffff"
                          strokeWidth={2}
                          labelLine={false}
                        >
                          {geographicExposureChart.slices.map((slice) => (
                            <Cell key={slice.key} fill={slice.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          wrapperStyle={{ zIndex: 40, pointerEvents: 'none' }}
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const point = payload[0]?.payload as InvestedGeographicSlice | undefined;
                            if (!point) return null;

                            return (
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                                <p className="text-sm font-semibold text-slate-900">{point.label}</p>
                                <p className="text-sm text-slate-700 tabular-nums">{formatCurrency(point.value)}</p>
                                <p className="text-xs text-slate-500">{point.percentage.toFixed(1)}%</p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none px-3">
                      <p className="text-xs font-semibold text-slate-700">{formatCurrency(geographicExposureChart.total)}</p>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-2 min-h-5 flex justify-center">
                {geographicExposureChart.slices.length > 0 && (
                  <button
                    type="button"
                    onClick={openGeographicModal}
                    className="inline-flex items-center text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900 hover:decoration-slate-500 transition-colors"
                  >
                    Dettaglio ripartizione geografica
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="h-[220px] relative">
                {sectorExposureLoading ? (
                  <div className="h-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Caricamento esposizione settoriale...
                  </div>
                ) : sectorExposureError ? (
                  <div className="h-full rounded-xl border border-red-200 bg-red-50 px-4 flex items-center justify-center text-sm text-red-700 text-center">
                    {sectorExposureError}
                  </div>
                ) : sectorExposureChart.slices.length === 0 ? (
                  <div className="h-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                    Nessun dato settoriale disponibile.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 12, right: 32, bottom: 12, left: 32 }}>
                        <Pie
                          data={sectorExposureChart.slices}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={68}
                          minAngle={2}
                          paddingAngle={2}
                          startAngle={90}
                          endAngle={-270}
                          stroke="#ffffff"
                          strokeWidth={2}
                          labelLine={false}
                        >
                          {sectorExposureChart.slices.map((slice) => (
                            <Cell key={slice.key} fill={slice.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          wrapperStyle={{ zIndex: 40, pointerEvents: 'none' }}
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const point = payload[0]?.payload as InvestedGeographicSlice | undefined;
                            if (!point) return null;

                            return (
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                                <p className="text-sm font-semibold text-slate-900">{point.label}</p>
                                <p className="text-sm text-slate-700 tabular-nums">{formatCurrency(point.value)}</p>
                                <p className="text-xs text-slate-500">{point.percentage.toFixed(1)}%</p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none px-3">
                      <p className="text-xs font-semibold text-slate-700">{formatCurrency(sectorExposureChart.total)}</p>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-2 min-h-5 flex justify-center">
                {sectorExposureChart.slices.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsSectorModalOpen(true)}
                    className="inline-flex items-center text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900 hover:decoration-slate-500 transition-colors"
                  >
                    Dettaglio ripartizione settoriale
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="h-[220px] relative">
                {companyExposureLoading ? (
                  <div className="h-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Caricamento esposizione aziende...
                  </div>
                ) : companyExposureError ? (
                  <div className="h-full rounded-xl border border-red-200 bg-red-50 px-4 flex items-center justify-center text-sm text-red-700 text-center">
                    {companyExposureError}
                  </div>
                ) : companyExposureChart.slices.length === 0 ? (
                  <div className="h-full rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                    Nessun dato aziende disponibile.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 12, right: 32, bottom: 12, left: 32 }}>
                        <Pie
                          data={companyExposureChart.slices}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={68}
                          minAngle={2}
                          paddingAngle={2}
                          startAngle={90}
                          endAngle={-270}
                          stroke="#ffffff"
                          strokeWidth={2}
                          labelLine={false}
                        >
                          {companyExposureChart.slices.map((slice) => (
                            <Cell key={slice.key} fill={slice.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          wrapperStyle={{ zIndex: 40, pointerEvents: 'none' }}
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null;
                            const point = payload[0]?.payload as InvestedGeographicSlice | undefined;
                            if (!point) return null;

                            return (
                              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                                <p className="text-sm font-semibold text-slate-900">{point.label}</p>
                                <p className="text-sm text-slate-700 tabular-nums">{formatCurrency(point.value)}</p>
                                <p className="text-xs text-slate-500">{point.percentage.toFixed(1)}%</p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none px-3">
                      <p className="text-xs font-semibold text-slate-700">{formatCurrency(companyExposureChart.total)}</p>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-2 min-h-5 flex justify-center">
                {companyExposureChart.slices.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCompanyModalOpen(true)}
                    className="inline-flex items-center text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900 hover:decoration-slate-500 transition-colors"
                  >
                    Dettaglio ripartizione aziende
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsInvestedOpen((prev) => !prev)}
          className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
        >
          <div className="text-left flex items-center gap-2 min-w-0">
            <ChevronRight className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isInvestedOpen ? 'rotate-90' : ''}`} />
            <h3 className="text-[15px] font-semibold text-slate-900 leading-none">Portafoglio Investito</h3>
            <p className="text-sm text-slate-500 truncate leading-none">- Totale allocato: {formatCurrency(investedTotal)}</p>
          </div>
        </button>

        {isInvestedOpen && (
          <div className="px-4 pb-4 pt-3.5 space-y-4 border-t border-slate-200 bg-white">
            {catalogError && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{catalogError}</div>}
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

            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-600">Gestione strumenti del portafoglio reale.</p>
              <button className="btn btn-secondary" onClick={openCreateInvestedModal} disabled={catalogLoading}>
                <Plus className="w-4 h-4 mr-1" />
                Nuovo strumento
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <div className="min-w-0 rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-[540px] w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-slate-500">
                        <th className="px-2.5 py-2 font-medium">Strumento</th>
                        <th className="px-2.5 py-2 font-medium">ISIN</th>
                        <th className="px-2.5 py-2 font-medium">Asset Class</th>
                        <th className="px-2.5 py-2 font-medium text-right">Importo</th>
                        <th className="px-2.5 py-2 font-medium text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invested.map((position) => {
                        const instrument = instrumentBySymbol.get(position.symbol.toUpperCase());
                        return (
                          <tr key={position.symbol} className="border-t border-slate-100">
                            <td className="px-2.5 py-2 font-medium text-slate-800">{position.symbol}</td>
                            <td className="px-2.5 py-2 text-slate-600">{instrument?.isin ?? 'N/A'}</td>
                            <td className="px-2.5 py-2 text-slate-600">{instrument?.assetClassName ?? 'N/A'}</td>
                            <td className="px-2.5 py-2 text-right text-slate-800 font-medium">{formatCurrency(position.amount)}</td>
                            <td className="px-2.5 py-2">
                              <div className="flex items-center justify-end gap-2">
                                <button className="btn btn-secondary py-1 px-2 text-xs" onClick={() => openEditInvestedModal(position)}>
                                  <Pencil className="w-3.5 h-3.5 mr-1" />
                                  Modifica
                                </button>
                                <button
                                  className="btn py-1 px-2 text-xs"
                                  onClick={() => setInvested((prev) => prev.filter((x) => x.symbol !== position.symbol))}
                                >
                                  Rimuovi
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="min-w-0">
              <InvestedPortfolioPerformanceChart
                positions={investedEtfPositions}
                title="Andamento Storico Portafoglio Investito"
                height={360}
              />
              </div>
            </div>
          </div>
        )}
      </section>

      {isInvestedModalOpen && investedDraft && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeInvestedModal} />
          <div className="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">
                  {editingInvestedSymbol && !isInstrumentCatalogMode ? 'Modifica strumento' : 'Nuovo strumento'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isInstrumentCatalogMode
                    ? 'Puoi censire un nuovo strumento (ISIN) da usare nel portafoglio di studio.'
                    : 'Puoi usare uno strumento censito o crearne/modificarne uno nuovo.'}
                </p>
              </div>
              <button type="button" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" onClick={closeInvestedModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="label">Strumento censito</label>
                <select
                  className="input"
                  value={investedDraft.instrumentId ?? '__new__'}
                  onChange={(e) => onDraftInstrumentSelect(e.target.value)}
                >
                  <option value="__new__">+ Nuovo strumento</option>
                  {instruments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.symbol} - {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="label">Simbolo</label>
                  <input
                    className="input"
                    value={investedDraft.symbol}
                    onChange={(e) => setInvestedDraft((prev) => (prev ? { ...prev, symbol: e.target.value.toUpperCase() } : prev))}
                    placeholder="Es. WORLD"
                  />
                </div>
                <div>
                  <label className="label">ISIN</label>
                  <input
                    className="input"
                    value={investedDraft.isin}
                    onChange={(e) => setInvestedDraft((prev) => (prev ? { ...prev, isin: e.target.value.toUpperCase() } : prev))}
                    placeholder="Es. IE00B4L5Y983"
                  />
                </div>
              </div>

              <div>
                <label className="label">Nome strumento</label>
                <input
                  className="input"
                  value={investedDraft.name}
                  onChange={(e) => setInvestedDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="label">Asset class</label>
                  <select
                    className="input"
                    value={investedDraft.assetClassId}
                    onChange={(e) => setInvestedDraft((prev) => (prev ? { ...prev, assetClassId: e.target.value } : prev))}
                  >
                    {assetClasses.map((assetClass) => (
                      <option key={assetClass.id} value={assetClass.id}>
                        {assetClass.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Nuova asset class (opzionale)</label>
                  <input
                    className="input"
                    value={investedDraft.newAssetClassName}
                    onChange={(e) => setInvestedDraft((prev) => (prev ? { ...prev, newAssetClassName: e.target.value } : prev))}
                    placeholder="Es. REAL ESTATE"
                  />
                </div>
              </div>

              <div>
                <label className="label">Rinomina asset class selezionata (opzionale)</label>
                <input
                  className="input"
                  value={investedDraft.renameAssetClassName}
                  onChange={(e) => setInvestedDraft((prev) => (prev ? { ...prev, renameAssetClassName: e.target.value } : prev))}
                />
              </div>

              {!isInstrumentCatalogMode && (
                <div>
                  <label className="label">Importo</label>
                  <input
                    className="input"
                    value={investedDraft.amount}
                    onChange={(e) => setInvestedDraft((prev) => (prev ? { ...prev, amount: e.target.value } : prev))}
                    type="number"
                  />
                </div>
              )}

              {investedDraftError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{investedDraftError}</div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button type="button" className="btn" onClick={closeInvestedModal} disabled={savingInvestedDraft}>
                Annulla
              </button>
              <button type="button" className="btn btn-primary" onClick={saveInvestedFromModal} disabled={savingInvestedDraft}>
                {savingInvestedDraft && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {isInstrumentCatalogMode ? 'Crea strumento' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGeographicModalOpen && geographicExposureChart.slices.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeGeographicModal} />
          <div className="relative w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Ripartizione geografica</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dettaglio completo delle partecipazioni per paese calcolate sul portafoglio investito.
                </p>
              </div>
              <button type="button" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" onClick={closeGeographicModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Totale allocato</p>
                  <p className="text-base font-semibold text-slate-900 mt-1">
                    {formatCurrency(geographicExposureTableRows.reduce((sum, row) => sum + row.amount, 0))}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Calcolato il</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {geographicExposure?.generatedAt
                      ? new Date(geographicExposure.generatedAt).toLocaleString('it-IT')
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Filtra la tabella per tipologia ETF. Con filtri vuoti vedi TUTTI i dati.
                </p>
                <details className="relative">
                  <summary className="list-none btn btn-secondary text-xs whitespace-nowrap cursor-pointer">
                    Filtro ETF: {geographicAssetClassFilters.length === 0 ? 'TUTTI' : geographicAssetClassFilters.join(', ')}
                  </summary>
                  <div className="absolute right-0 mt-2 z-20 w-[260px] rounded-lg border border-slate-200 bg-white shadow-lg p-2 space-y-1">
                    <label className="flex items-center gap-2 text-xs text-slate-700 px-1 py-1">
                      <input
                        type="checkbox"
                        checked={geographicAssetClassFilters.length === 0}
                        onChange={() => setGeographicAssetClassFilters([])}
                      />
                      TUTTI
                    </label>
                    {GEOGRAPHIC_ASSET_CLASS_FILTER_OPTIONS.map((assetClass) => (
                      <label key={`geo-filter-${assetClass}`} className="flex items-center gap-2 text-xs text-slate-700 px-1 py-1">
                        <input
                          type="checkbox"
                          checked={geographicAssetClassFilters.includes(assetClass)}
                          onChange={() => toggleAssetClassFilter(assetClass, setGeographicAssetClassFilters)}
                        />
                        {assetClass}
                      </label>
                    ))}
                  </div>
                </details>
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-2 font-medium">Paese</th>
                        <th className="px-3 py-2 font-medium text-right">% sul totale</th>
                        <th className="px-3 py-2 font-medium text-right">Importo</th>
                        <th className="px-3 py-2 font-medium">ETF coinvolti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {geographicExposureTableRows.length === 0 ? (
                        <tr className="border-t border-slate-100">
                          <td colSpan={4} className="px-3 py-3 text-sm text-slate-500 text-center">
                            Nessun paese disponibile con i filtri selezionati.
                          </td>
                        </tr>
                      ) : (
                        geographicExposureTableRows.map((row) => (
                          <tr key={`geo-row-${row.country}`} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-800">{row.country}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{row.percentage.toFixed(2)}%</td>
                            <td className="px-3 py-2 text-right text-slate-800 font-medium tabular-nums">{formatCurrency(row.amount)}</td>
                            <td className="px-3 py-2 text-slate-700">
                              {row.etfs.length > 0 ? row.etfs.join(', ') : 'N/A'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end">
              <button type="button" className="btn btn-primary" onClick={closeGeographicModal}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {isSectorModalOpen && sectorExposureChart.slices.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsSectorModalOpen(false)} />
          <div className="relative w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Ripartizione settoriale</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dettaglio completo delle partecipazioni per settore calcolate sul portafoglio investito.
                </p>
              </div>
              <button type="button" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" onClick={() => setIsSectorModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Totale allocato</p>
                  <p className="text-base font-semibold text-slate-900 mt-1">{formatCurrency(sectorExposureChart.total)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Calcolato il</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {sectorExposure?.generatedAt
                      ? new Date(sectorExposure.generatedAt).toLocaleString('it-IT')
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-[560px] w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-2 font-medium">Settore</th>
                        <th className="px-3 py-2 font-medium text-right">% sul totale</th>
                        <th className="px-3 py-2 font-medium text-right">Importo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectorExposureChart.slices.map((slice) => (
                        <tr key={`sector-row-${slice.key}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-800">{slice.label}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{slice.percentage.toFixed(2)}%</td>
                          <td className="px-3 py-2 text-right text-slate-800 font-medium tabular-nums">{formatCurrency(slice.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end">
              <button type="button" className="btn btn-primary" onClick={() => setIsSectorModalOpen(false)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {isCompanyModalOpen && companyExposureChart.slices.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeCompanyModal} />
          <div className="relative w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Ripartizione aziende</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dettaglio completo delle partecipazioni per azienda calcolate sul portafoglio investito.
                </p>
              </div>
              <button type="button" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" onClick={closeCompanyModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Totale allocato</p>
                  <p className="text-base font-semibold text-slate-900 mt-1">{formatCurrency(companyExposureChart.total)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Calcolato il</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {companyExposure?.generatedAt
                      ? new Date(companyExposure.generatedAt).toLocaleString('it-IT')
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-[640px] w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-2 font-medium">Azienda</th>
                        <th className="px-3 py-2 font-medium">ISIN</th>
                        <th className="px-3 py-2 font-medium text-right">% sul totale</th>
                        <th className="px-3 py-2 font-medium text-right">Importo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(companyExposure?.companies ?? []).map((company) => (
                        <tr key={`company-row-${company.company}-${company.isin ?? 'NA'}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-800">{company.company}</td>
                          <td className="px-3 py-2 text-slate-700">{company.isin ?? 'N/A'}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{(company.percentage * 100).toFixed(2)}%</td>
                          <td className="px-3 py-2 text-right text-slate-800 font-medium tabular-nums">{formatCurrency(company.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end">
              <button type="button" className="btn btn-primary" onClick={closeCompanyModal}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {isStudyGeographicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeStudyGeographicModal} />
          <div className="relative w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Ripartizione geografica - {studyGeographicPortfolioName}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dettaglio completo delle partecipazioni per paese calcolate al click sul portafoglio di studio.
                </p>
              </div>
              <button type="button" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" onClick={closeStudyGeographicModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              {studyGeographicExposureLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 py-10 flex items-center justify-center text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Calcolo ripartizione geografica in corso...
                </div>
              ) : studyGeographicExposureError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {studyGeographicExposureError}
                </div>
              ) : studyGeographicExposureChart.slices.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Nessun dato geografico disponibile per questo portafoglio di studio.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Totale allocato</p>
                      <p className="text-base font-semibold text-slate-900 mt-1">
                        {formatCurrency(studyGeographicExposureTableRows.reduce((sum, row) => sum + row.amount, 0))}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Calcolato il</p>
                      <p className="text-sm font-semibold text-slate-900 mt-1">
                        {studyGeographicExposure?.generatedAt
                          ? new Date(studyGeographicExposure.generatedAt).toLocaleString('it-IT')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    Base calcolo: {formatCurrency(studyGeographicBaseAmount)} (ricalcolata al click, senza salvataggio su DB).
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      Filtra la tabella per tipologia ETF. Con filtri vuoti vedi TUTTI i dati.
                    </p>
                    <details className="relative">
                      <summary className="list-none btn btn-secondary text-xs whitespace-nowrap cursor-pointer">
                        Filtro ETF: {studyGeographicAssetClassFilters.length === 0 ? 'TUTTI' : studyGeographicAssetClassFilters.join(', ')}
                      </summary>
                      <div className="absolute right-0 mt-2 z-20 w-[260px] rounded-lg border border-slate-200 bg-white shadow-lg p-2 space-y-1">
                        <label className="flex items-center gap-2 text-xs text-slate-700 px-1 py-1">
                          <input
                            type="checkbox"
                            checked={studyGeographicAssetClassFilters.length === 0}
                            onChange={() => setStudyGeographicAssetClassFilters([])}
                          />
                          TUTTI
                        </label>
                        {GEOGRAPHIC_ASSET_CLASS_FILTER_OPTIONS.map((assetClass) => (
                          <label key={`study-geo-filter-${assetClass}`} className="flex items-center gap-2 text-xs text-slate-700 px-1 py-1">
                            <input
                              type="checkbox"
                              checked={studyGeographicAssetClassFilters.includes(assetClass)}
                              onChange={() => toggleAssetClassFilter(assetClass, setStudyGeographicAssetClassFilters)}
                            />
                            {assetClass}
                          </label>
                        ))}
                      </div>
                    </details>
                  </div>

                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-[760px] w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="text-left text-slate-500">
                            <th className="px-3 py-2 font-medium">Paese</th>
                            <th className="px-3 py-2 font-medium text-right">% sul totale</th>
                            <th className="px-3 py-2 font-medium text-right">Importo</th>
                            <th className="px-3 py-2 font-medium">ETF coinvolti</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studyGeographicExposureTableRows.length === 0 ? (
                            <tr className="border-t border-slate-100">
                              <td colSpan={4} className="px-3 py-3 text-sm text-slate-500 text-center">
                                Nessun paese disponibile con i filtri selezionati.
                              </td>
                            </tr>
                          ) : (
                            studyGeographicExposureTableRows.map((row) => (
                              <tr key={`study-geo-row-${row.country}`} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-medium text-slate-800">{row.country}</td>
                                <td className="px-3 py-2 text-right text-slate-700">{row.percentage.toFixed(2)}%</td>
                                <td className="px-3 py-2 text-right text-slate-800 font-medium tabular-nums">{formatCurrency(row.amount)}</td>
                                <td className="px-3 py-2 text-slate-700">
                                  {row.etfs.length > 0 ? row.etfs.join(', ') : 'N/A'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end">
              <button type="button" className="btn btn-primary" onClick={closeStudyGeographicModal}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {isStudySectorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeStudySectorModal} />
          <div className="relative w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Ripartizione settoriale - {studySectorPortfolioName}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dettaglio completo delle partecipazioni per settore calcolate al click sul portafoglio di studio.
                </p>
              </div>
              <button type="button" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" onClick={closeStudySectorModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              {studySectorExposureLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 py-10 flex items-center justify-center text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Calcolo ripartizione settoriale in corso...
                </div>
              ) : studySectorExposureError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {studySectorExposureError}
                </div>
              ) : studySectorExposureChart.slices.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Nessun dato settoriale disponibile per questo portafoglio di studio.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Totale allocato</p>
                      <p className="text-base font-semibold text-slate-900 mt-1">{formatCurrency(studySectorExposureChart.total)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Calcolato il</p>
                      <p className="text-sm font-semibold text-slate-900 mt-1">
                        {studySectorExposure?.generatedAt
                          ? new Date(studySectorExposure.generatedAt).toLocaleString('it-IT')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    Base calcolo: {formatCurrency(studySectorBaseAmount)} (ricalcolata al click, senza salvataggio su DB).
                  </p>

                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-[560px] w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="text-left text-slate-500">
                            <th className="px-3 py-2 font-medium">Settore</th>
                            <th className="px-3 py-2 font-medium text-right">% sul totale</th>
                            <th className="px-3 py-2 font-medium text-right">Importo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studySectorExposureChart.slices.map((slice) => (
                            <tr key={`study-sector-row-${slice.key}`} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-medium text-slate-800">{slice.label}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{slice.percentage.toFixed(2)}%</td>
                              <td className="px-3 py-2 text-right text-slate-800 font-medium tabular-nums">{formatCurrency(slice.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end">
              <button type="button" className="btn btn-primary" onClick={closeStudySectorModal}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {isStudyCompanyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeStudyCompanyModal} />
          <div className="relative w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Ripartizione aziende - {studyCompanyPortfolioName}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dettaglio completo delle partecipazioni per azienda calcolate al click sul portafoglio di studio.
                </p>
              </div>
              <button type="button" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" onClick={closeStudyCompanyModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              {studyCompanyExposureLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 py-10 flex items-center justify-center text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Calcolo ripartizione aziende in corso...
                </div>
              ) : studyCompanyExposureError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {studyCompanyExposureError}
                </div>
              ) : studyCompanyExposureChart.slices.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Nessun dato aziende disponibile per questo portafoglio di studio.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Totale allocato</p>
                      <p className="text-base font-semibold text-slate-900 mt-1">{formatCurrency(studyCompanyExposureChart.total)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Calcolato il</p>
                      <p className="text-sm font-semibold text-slate-900 mt-1">
                        {studyCompanyExposure?.generatedAt
                          ? new Date(studyCompanyExposure.generatedAt).toLocaleString('it-IT')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    Base calcolo: {formatCurrency(studyCompanyBaseAmount)} (ricalcolata al click, senza salvataggio su DB).
                  </p>

                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-[640px] w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="text-left text-slate-500">
                            <th className="px-3 py-2 font-medium">Azienda</th>
                            <th className="px-3 py-2 font-medium">ISIN</th>
                            <th className="px-3 py-2 font-medium text-right">% sul totale</th>
                            <th className="px-3 py-2 font-medium text-right">Importo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(studyCompanyExposure?.companies ?? []).map((company) => (
                            <tr key={`study-company-row-${company.company}-${company.isin ?? 'NA'}`} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-medium text-slate-800">{company.company}</td>
                              <td className="px-3 py-2 text-slate-700">{company.isin ?? 'N/A'}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{(company.percentage * 100).toFixed(2)}%</td>
                              <td className="px-3 py-2 text-right text-slate-800 font-medium tabular-nums">{formatCurrency(company.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end">
              <button type="button" className="btn btn-primary" onClick={closeStudyCompanyModal}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {isStudyPerformanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeStudyPerformanceModal} />
          <div className="relative w-full sm:max-w-7xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Confronto Rendimenti Portafogli</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vista comparativa rapida degli andamenti storici (pesi statici) per i portafogli in laboratorio.
                </p>
              </div>
              <button
                type="button"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                onClick={closeStudyPerformanceModal}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Portafogli: {studyPerformanceCards.length}. Layout automatico: max 3 grafici per riga.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    className="btn btn-primary text-xs whitespace-nowrap min-w-[180px] justify-center"
                    onClick={() => setIsStudyPerformanceOverlayModalOpen(true)}
                    disabled={!hasStudyPerformanceOverlayData}
                  >
                    Curve sovrapposte
                  </button>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Metrica</label>
                    <select
                      className="input text-xs min-w-[220px]"
                      value={studyPerformanceMetric}
                      onChange={(event) => setStudyPerformanceMetric(event.target.value as PortfolioStaticPerformanceMetricDTO)}
                    >
                      {PORTFOLIO_PERFORMANCE_METRIC_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {studyPerformanceCards.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Nessun portafoglio disponibile nel laboratorio strategico.
                </div>
              ) : (
                <div className={studyPerformanceGridClass}>
                  {studyPerformanceCards.map((card) => (
                    <div key={`study-performance-${card.id}`} className="min-w-0">
                      {card.error ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                          <p className="text-sm font-semibold text-red-800">{card.name}</p>
                          <p className="text-xs text-red-700 mt-1">{card.error}</p>
                        </div>
                      ) : (
                        <InvestedPortfolioPerformanceChart
                          positions={card.positions}
                          metric={studyPerformanceMetric}
                          showMetricSelector={false}
                          title={card.name}
                          height={260}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end">
              <button type="button" className="btn btn-primary" onClick={closeStudyPerformanceModal}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {isStudyPerformanceModalOpen && isStudyPerformanceOverlayModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsStudyPerformanceOverlayModalOpen(false)} />
          <div className="relative w-full sm:max-w-7xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[94vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Curve Sovrapposte Portafogli</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unico grafico con tutte le curve in overlay, colore dedicato per portafoglio.
                </p>
              </div>
              <button
                type="button"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                onClick={() => setIsStudyPerformanceOverlayModalOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              <StudyPortfoliosOverlayPerformanceChart
                portfolios={studyPerformanceCards}
                metric={studyPerformanceMetric}
                showMetricSelector={false}
                title="Andamento storico sovrapposto"
                height={480}
              />
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsStudyPerformanceOverlayModalOpen(false)}
              >
                Chiudi overlay
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsAnalysisOpen((prev) => !prev)}
          className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
        >
          <div className="text-left flex items-center gap-2 min-w-0">
            <ChevronRight className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isAnalysisOpen ? 'rotate-90' : ''}`} />
            <h3 className="text-[15px] font-semibold text-slate-900 leading-none">Laboratorio Strategico Portafogli</h3>
            <p className="text-sm text-slate-500 truncate leading-none">- Portafogli in analisi: {study.length}</p>
          </div>
        </button>

        {isAnalysisOpen && (
          <div className="px-4 pb-4 pt-3.5 space-y-4 border-t border-slate-200 bg-white">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
              <select value={horizon} onChange={(e) => setHorizon(e.target.value as Horizon)} className="input">
                <option value="1Y">1Y</option><option value="3Y">3Y</option><option value="5Y">5Y</option>
              </select>
              <select value={inputValue} onChange={(e) => setInputValue(e.target.value as PortfolioInputValueModeDTO)} className="input">
                <option value="quote_with_dividends">quote_with_dividends</option>
                <option value="quote">quote</option>
              </select>
              <input value={riskFreeAnnual} onChange={(e) => setRiskFreeAnnual(e.target.value)} className="input w-28" />
              <button className="btn btn-secondary" onClick={openCreatePortfolioModal} disabled={catalogLoading || instruments.length === 0}>
                <Plus className="w-4 h-4 mr-1" /> Nuovo portafoglio
              </button>
              <button
                className="btn btn-secondary"
                onClick={importInvestedAsStudyPortfolio}
                disabled={catalogLoading || investedTotal <= 0}
              >
                Importa portafoglio investito
              </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button className="btn btn-primary whitespace-nowrap min-w-[130px] justify-center" onClick={runCompare} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Confronta
                </button>
              <button
                className="btn btn-primary whitespace-nowrap min-w-[190px] justify-center"
                onClick={() => setIsStudyPerformanceModalOpen(true)}
                disabled={study.length === 0}
              >
                Confronta Rendimenti
              </button>
              </div>
            </div>

            {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {study.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        Strumenti: {p.rows.length} - Peso totale:{' '}
                        {p.rows
                          .reduce((sum, row) => {
                            const n = Number(row.weight.replace(',', '.'));
                            return sum + (Number.isFinite(n) && n > 0 ? n : 0);
                          }, 0)
                          .toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-secondary py-1 px-2 text-xs"
                        onClick={() => void openStudyGeographicModal(p)}
                        disabled={studyGeographicExposureLoading && studyGeographicActivePortfolioId === p.id}
                      >
                        {studyGeographicExposureLoading && studyGeographicActivePortfolioId === p.id && (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        )}
                        Ripartizione geo
                      </button>
                      <button
                        className="btn btn-secondary py-1 px-2 text-xs"
                        onClick={() => void openStudySectorModal(p)}
                        disabled={studySectorExposureLoading && studySectorActivePortfolioId === p.id}
                      >
                        {studySectorExposureLoading && studySectorActivePortfolioId === p.id && (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        )}
                        Ripartizione settori
                      </button>
                      <button
                        className="btn btn-secondary py-1 px-2 text-xs"
                        onClick={() => void openStudyCompanyModal(p)}
                        disabled={studyCompanyExposureLoading && studyCompanyActivePortfolioId === p.id}
                      >
                        {studyCompanyExposureLoading && studyCompanyActivePortfolioId === p.id && (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        )}
                        Ripartizione aziende
                      </button>
                      <button className="btn btn-secondary py-1 px-2 text-xs" onClick={() => openEditPortfolioModal(p)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Modifica
                      </button>
                      {study.length > 1 && (
                        <button className="btn py-1 px-2 text-xs" onClick={() => setStudy((prev) => prev.filter((x) => x.id !== p.id))}>
                          Rimuovi
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[440px] w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="px-3 py-2 font-medium">Strumento</th>
                          <th className="px-3 py-2 font-medium">ISIN</th>
                          <th className="px-3 py-2 font-medium text-right">Peso</th>
                        </tr>
                      </thead>
                      <tbody>
                    {p.rows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">{row.label}</td>
                        <td className="px-3 py-2 text-slate-600">{universeByLabel[row.label] ?? 'N/A'}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{row.weight}%</td>
                      </tr>
                    ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {isPortfolioModalOpen && portfolioDraft && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                <div className="absolute inset-0 bg-black/50" onClick={closePortfolioModal} />
                <div className="relative w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">
                        {editingPortfolioId ? 'Modifica portafoglio' : 'Nuovo portafoglio'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">Inserisci nome e strumenti da confrontare.</p>
                    </div>
                    <button type="button" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" onClick={closePortfolioModal}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4 space-y-3 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                      <input
                        className="input"
                        value={portfolioDraft.name}
                        onChange={(e) => setPortfolioDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                        placeholder="Nome portafoglio"
                      />
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() =>
                          setPortfolioDraft((prev) =>
                            prev ? { ...prev, rows: [...prev.rows, { id: mk('r'), label: instruments[0]?.symbol ?? '', weight: '10' }] } : prev,
                          )
                        }
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Strumento
                      </button>
                    </div>

                    {portfolioDraftError && (
                      <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{portfolioDraftError}</div>
                    )}

                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-[620px] w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-left text-slate-500">
                              <th className="px-3 py-2 font-medium">Strumento</th>
                              <th className="px-3 py-2 font-medium">ISIN</th>
                              <th className="px-3 py-2 font-medium text-right">Peso %</th>
                              <th className="px-3 py-2 font-medium text-right">Azione</th>
                            </tr>
                          </thead>
                          <tbody>
                            {portfolioDraft.rows.map((row) => (
                              <tr key={row.id} className="border-t border-slate-100">
                                <td className="px-3 py-2">
                                  <select
                                    className="input"
                                    value={row.label}
                                    onChange={(e) =>
                                      e.target.value === '__new__'
                                        ? openCreateInstrumentForPortfolioDraft(row.id)
                                        : setPortfolioDraft((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  rows: prev.rows.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)),
                                                }
                                              : prev,
                                          )
                                    }
                                  >
                                    <option value="__new__">+ Nuovo strumento</option>
                                    {instruments.map((item) => (
                                      <option key={item.id} value={item.symbol}>
                                        {item.symbol} - {item.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{universeByLabel[row.label] ?? 'N/A'}</td>
                                <td className="px-3 py-2">
                                  <input
                                    className="input text-right"
                                    value={row.weight}
                                    onChange={(e) =>
                                      setPortfolioDraft((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              rows: prev.rows.map((r) => (r.id === row.id ? { ...r, weight: e.target.value } : r)),
                                            }
                                          : prev,
                                      )
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    className="btn py-1 px-2 text-xs"
                                    type="button"
                                    disabled={portfolioDraft.rows.length <= 1}
                                    onClick={() =>
                                      setPortfolioDraft((prev) =>
                                        prev ? { ...prev, rows: prev.rows.filter((r) => r.id !== row.id) } : prev,
                                      )
                                    }
                                  >
                                    Rimuovi
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button type="button" className="btn" onClick={closePortfolioModal}>
                      Annulla
                    </button>
                    <button type="button" className="btn btn-primary" onClick={savePortfolioFromModal}>
                      Conferma portafoglio
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                      <ScatterChart margin={{ top: 18, right: 12, bottom: 8, left: 8 }}>
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="annualizedVolatility"
                          tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
                        />
                        <YAxis
                          type="number"
                          dataKey="annualizedReturn"
                          tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
                        />
                        <Tooltip />
                        <Scatter data={result.scatter} fill="#0ea5e9">
                          <LabelList
                            dataKey="name"
                            position="top"
                            offset={8}
                            fill="#334155"
                            fontSize={11}
                            fontWeight={600}
                          />
                        </Scatter>
                      </ScatterChart>
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
