import type { CashFlowCheckDTO, CashFlowColumnDTO, CashFlowSettingsDTO } from '@budget/shared';

// Net valuation of a cash-flow check — single source of truth shared by the
// KPI panel and the wealth goals, mirroring the cash-flow page total.
// Columns with a fiscal config (taxRatePct + investedCapital) hold the GROSS
// value and are netted of the capital-gain tax: value − max(0, value − invested)
// × rate. A config with fiscalSince applies only to checks dated on/after it:
// earlier checks keep the pre-config method, so history isn't rewritten.
// etfLordo also subtracts PAC commissions; without an (active) config it falls
// back to the legacy formula (rendimentoLordo × 26%). rendimentoLordo itself is
// never summed: it is the gain already contained in etfLordo.
export interface CheckValuation {
  countedKeys: Set<string>; // active && showInPie columns
  valueFor: (check: CashFlowCheckDTO, key: string) => number;
  sumKeys: (check: CashFlowCheckDTO, keys: Set<string>) => number;
  checkTotal: (check: CashFlowCheckDTO) => number;
}

export function buildCheckValuation(
  columns: CashFlowColumnDTO[],
  settings: CashFlowSettingsDTO
): CheckValuation {
  const commissionTotal = settings.commissionPerEtf * settings.etfCount;
  const columnByKey = new Map<string, CashFlowColumnDTO>(columns.map((c) => [c.key, c]));

  const netFiscalValue = (
    raw: number,
    column: CashFlowColumnDTO | undefined,
    checkDate: string
  ): number | null => {
    if (!column || column.taxRatePct == null || column.investedCapital == null) return null;
    if (column.fiscalSince && checkDate < column.fiscalSince) return null; // config not yet in force
    const gain = Math.max(0, raw - column.investedCapital);
    return raw - (gain * column.taxRatePct) / 100;
  };

  const valueFor = (check: CashFlowCheckDTO, key: string): number => {
    if (key === 'rendimentoLordo') return 0;
    const raw = check.values[key] ?? 0;
    const netted = netFiscalValue(raw, columnByKey.get(key), check.date);
    if (key === 'etfLordo') {
      if (netted !== null) return netted - commissionTotal;
      const rendimento = check.values['rendimentoLordo'] ?? 0;
      return raw - rendimento * 0.26 - commissionTotal;
    }
    return netted ?? raw;
  };

  const countedKeys = new Set(
    columns.filter((c) => c.isActive && c.showInPie).map((c) => c.key)
  );

  const sumKeys = (check: CashFlowCheckDTO, keys: Set<string>): number =>
    [...keys]
      .filter((key) => countedKeys.has(key))
      .reduce((sum, key) => sum + valueFor(check, key), 0);

  const checkTotal = (check: CashFlowCheckDTO): number => sumKeys(check, countedKeys);

  return { countedKeys, valueFor, sumKeys, checkTotal };
}
