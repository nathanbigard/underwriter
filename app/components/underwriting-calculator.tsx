"use client";

import { useMemo, useState } from "react";
import {
  CAPEX_RESERVE_PER_UNIT_PER_YEAR,
  calculateCapRateStressTest,
  calculateRedFlags,
  calculateUnderwriting,
  calculateVerdict,
  type UnderwritingInputs,
  type Verdict,
} from "@/lib/underwriting";
import { InfoTooltip } from "./info-tooltip";

const DEFAULT_INPUTS: UnderwritingInputs = {
  purchasePrice: 5_000_000,
  unitCount: 40,
  avgMonthlyRentPerUnit: 1_400,
  otherMonthlyIncome: 2_000,
  vacancyRatePct: 5,
  operatingExpenseRatioPct: 45,
  loanAmount: 3_500_000,
  annualInterestRatePct: 6.5,
  amortizationYears: 30,
  capexReservesEnabled: false,
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function fmtCurrency(value: number): string {
  return Number.isFinite(value) ? currencyFormatter.format(value) : "—";
}

function fmtPercent(value: number, digits = 2): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "—";
}

function fmtMultiple(value: number, digits = 2): string {
  return Number.isFinite(value) ? `${value.toFixed(digits)}x` : "—";
}

type NumericInputKey = Exclude<keyof UnderwritingInputs, "capexReservesEnabled">;

type FieldConfig = {
  key: NumericInputKey;
  label: string;
  tooltip: string;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
};

const FIELDS: FieldConfig[] = [
  {
    key: "purchasePrice",
    label: "Purchase price",
    tooltip: "Total acquisition price for the property.",
    prefix: "$",
    step: 10_000,
  },
  {
    key: "unitCount",
    label: "Unit count",
    tooltip: "Total number of rentable residential units.",
    step: 1,
  },
  {
    key: "avgMonthlyRentPerUnit",
    label: "Avg. monthly rent / unit",
    tooltip: "Average in-place or market monthly rent across all units.",
    prefix: "$",
    step: 25,
  },
  {
    key: "otherMonthlyIncome",
    label: "Other monthly income",
    tooltip:
      "Non-rent income for the whole property (laundry, parking, storage, fees). Not reduced by vacancy.",
    prefix: "$",
    step: 25,
  },
  {
    key: "vacancyRatePct",
    label: "Vacancy rate",
    tooltip: "Percentage of gross potential rent lost to vacancy and credit loss.",
    suffix: "%",
    step: 0.5,
  },
  {
    key: "operatingExpenseRatioPct",
    label: "Operating expense ratio",
    tooltip: "Operating expenses as a percentage of Effective Gross Income (EGI).",
    suffix: "%",
    step: 1,
  },
  {
    key: "loanAmount",
    label: "Loan amount",
    tooltip: "Principal amount of acquisition debt.",
    prefix: "$",
    step: 10_000,
  },
  {
    key: "annualInterestRatePct",
    label: "Annual interest rate",
    tooltip: "Nominal annual interest rate on the loan, compounded monthly.",
    suffix: "%",
    step: 0.125,
  },
  {
    key: "amortizationYears",
    label: "Amortization period",
    tooltip: "Number of years over which the loan fully amortizes.",
    suffix: "yrs",
    step: 1,
  },
];

function InputField({
  config,
  value,
  onChange,
}: {
  config: FieldConfig;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
        {config.label}
        <InfoTooltip text={config.tooltip} />
      </span>
      <div className="mt-1.5 flex items-center rounded-md border border-slate-300 bg-white transition-colors focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-500 dark:border-slate-700 dark:bg-slate-900">
        {config.prefix && (
          <span className="pl-3 text-sm text-slate-400">{config.prefix}</span>
        )}
        <input
          type="number"
          inputMode="decimal"
          value={value}
          step={config.step ?? 1}
          min={config.min ?? 0}
          onChange={(event) => onChange(event.target.valueAsNumber || 0)}
          className="w-full bg-transparent px-3 py-2 text-sm text-slate-900 outline-none dark:text-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {config.suffix && (
          <span className="pr-3 text-sm text-slate-400">{config.suffix}</span>
        )}
      </div>
    </label>
  );
}

function ToggleField({
  label,
  tooltip,
  checked,
  onChange,
}: {
  label: string;
  tooltip: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 sm:col-span-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-900"
      />
      <span className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        <InfoTooltip text={tooltip} />
      </span>
    </label>
  );
}

function OptionalNumberField({
  label,
  tooltip,
  suffix,
  placeholder,
  step,
  value,
  onChange,
}: {
  label: string;
  tooltip: string;
  suffix?: string;
  placeholder?: string;
  step?: number;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        <InfoTooltip text={tooltip} />
      </span>
      <div className="mt-1.5 flex items-center rounded-md border border-slate-300 bg-white transition-colors focus-within:border-slate-500 focus-within:ring-1 focus-within:ring-slate-500 dark:border-slate-700 dark:bg-slate-900">
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ""}
          placeholder={placeholder}
          step={step ?? 0.1}
          min={0}
          onChange={(event) => {
            const raw = event.target.valueAsNumber;
            onChange(Number.isNaN(raw) ? undefined : raw);
          }}
          className="w-full bg-transparent px-3 py-2 text-sm text-slate-900 outline-none dark:text-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix && <span className="pr-3 text-sm text-slate-400">{suffix}</span>}
      </div>
    </label>
  );
}

type Tone = "default" | "good" | "warn" | "bad";

const TONE_CLASSES: Record<Tone, string> = {
  default: "text-slate-900 dark:text-slate-100",
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
};

function MetricRow({
  label,
  tooltip,
  value,
  tone = "default",
  emphasis = false,
}: {
  label: string;
  tooltip: string;
  value: string;
  tone?: Tone;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="flex items-center text-sm text-slate-600 dark:text-slate-400">
        {label}
        <InfoTooltip text={tooltip} />
      </span>
      <span
        className={`text-right tabular-nums ${emphasis ? "text-base font-semibold" : "text-sm font-medium"} ${TONE_CLASSES[tone]}`}
      >
        {value}
      </span>
    </div>
  );
}

function ResultsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
        {title}
      </h3>
      <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
        {children}
      </div>
    </div>
  );
}

const VERDICT_BANNER_CLASSES: Record<Verdict, string> = {
  PURSUE:
    "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950",
  PASS: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950",
  "NEEDS MORE INFO":
    "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950",
};

const VERDICT_TEXT_CLASSES: Record<Verdict, string> = {
  PURSUE: "text-emerald-700 dark:text-emerald-400",
  PASS: "text-red-700 dark:text-red-400",
  "NEEDS MORE INFO": "text-amber-700 dark:text-amber-400",
};

function VerdictBanner({ verdict, reasoning }: { verdict: Verdict; reasoning: string }) {
  return (
    <div
      className={`mb-8 rounded-lg border px-5 py-4 ${VERDICT_BANNER_CLASSES[verdict]}`}
    >
      <span
        className={`text-sm font-bold uppercase tracking-wide ${VERDICT_TEXT_CLASSES[verdict]}`}
      >
        {verdict}
      </span>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{reasoning}</p>
    </div>
  );
}

export default function UnderwritingCalculator() {
  const [inputs, setInputs] = useState<UnderwritingInputs>(DEFAULT_INPUTS);
  const [statedCapRatePct, setStatedCapRatePct] = useState<number | undefined>(undefined);

  const results = useMemo(() => calculateUnderwriting(inputs), [inputs]);
  const verdict = useMemo(() => calculateVerdict(results), [results]);
  const redFlags = useMemo(() => calculateRedFlags(inputs, results), [inputs, results]);
  const stressTest = useMemo(
    () =>
      statedCapRatePct && statedCapRatePct > 0
        ? calculateCapRateStressTest(inputs, statedCapRatePct)
        : null,
    [inputs, statedCapRatePct],
  );

  function updateField(key: NumericInputKey, value: number) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  const dscrTone: Tone = !Number.isFinite(results.dscr)
    ? "default"
    : results.dscr >= 1.25
      ? "good"
      : results.dscr >= 1.0
        ? "warn"
        : "bad";

  const cashFlowTone: Tone = !Number.isFinite(results.annualCashFlow)
    ? "default"
    : results.annualCashFlow >= 0
      ? "good"
      : "bad";

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Multifamily Acquisition Underwriting
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          A year-one snapshot of income, expenses, debt service, and returns for a
          multifamily acquisition.
        </p>
      </header>

      <VerdictBanner verdict={verdict.verdict} reasoning={verdict.reasoning} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
            Deal Inputs
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <InputField
                key={field.key}
                config={field}
                value={inputs[field.key]}
                onChange={(value) => updateField(field.key, value)}
              />
            ))}
            <OptionalNumberField
              label="Stated cap rate (from listing)"
              tooltip="Optional. The cap rate advertised in the listing. When filled in, shows the NOI it implies and the monthly rent per unit required to hit that NOI at a range of expense ratios."
              suffix="%"
              placeholder="e.g. 5.5"
              step={0.05}
              value={statedCapRatePct}
              onChange={setStatedCapRatePct}
            />
            <ToggleField
              label={`Include capex reserves ($${CAPEX_RESERVE_PER_UNIT_PER_YEAR}/unit/yr)`}
              tooltip="Deducts a capital expenditure reserve of $275 per unit per year from NOI before cap rate, DSCR, and cash-on-cash are calculated."
              checked={inputs.capexReservesEnabled}
              onChange={(checked) =>
                setInputs((prev) => ({ ...prev, capexReservesEnabled: checked }))
              }
            />
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <ResultsCard title="Income & Expenses">
            <MetricRow
              label="Gross potential rent"
              tooltip="Total rental income if every unit were leased at market rent with zero vacancy, on an annual basis."
              value={fmtCurrency(results.grossPotentialRent)}
            />
            <MetricRow
              label="Effective gross income"
              tooltip="Gross potential rent less vacancy loss, plus other income. The actual annual income collected."
              value={fmtCurrency(results.effectiveGrossIncome)}
            />
            <MetricRow
              label="Operating expenses"
              tooltip="Annual operating expenses, calculated as the operating expense ratio applied to effective gross income."
              value={fmtCurrency(results.operatingExpenses)}
            />
            {inputs.capexReservesEnabled && (
              <MetricRow
                label="Capex reserves"
                tooltip={`Capital expenditure reserve of $${CAPEX_RESERVE_PER_UNIT_PER_YEAR} per unit per year, deducted from NOI.`}
                value={fmtCurrency(results.capexReserves)}
              />
            )}
            <MetricRow
              label="Net operating income"
              tooltip="Effective gross income less operating expenses (and capex reserves, if enabled). Income before debt service; the core driver of property value."
              value={fmtCurrency(results.netOperatingIncome)}
              emphasis
            />
            <MetricRow
              label="Going-in cap rate"
              tooltip="Net operating income divided by purchase price. A measure of unlevered return at acquisition."
              value={fmtPercent(results.goingInCapRate)}
              emphasis
            />
          </ResultsCard>

          <ResultsCard title="Debt & Coverage">
            <MetricRow
              label="Annual debt service"
              tooltip="Total annual principal and interest payments on a fully amortizing loan at the stated rate and term."
              value={fmtCurrency(results.annualDebtService)}
            />
            <MetricRow
              label="DSCR"
              tooltip="Debt Service Coverage Ratio: net operating income divided by annual debt service. Lenders typically require 1.20x–1.25x or higher."
              value={fmtMultiple(results.dscr)}
              tone={dscrTone}
              emphasis
            />
            <MetricRow
              label="Annual cash flow after debt service"
              tooltip="Net operating income less annual debt service. Cash flow available to equity before capex reserves."
              value={fmtCurrency(results.annualCashFlow)}
              tone={cashFlowTone}
              emphasis
            />
          </ResultsCard>

          <ResultsCard title="Equity & Returns">
            <MetricRow
              label="Total equity required"
              tooltip="Purchase price less loan amount. Does not include closing costs, reserves, or loan fees."
              value={fmtCurrency(results.totalEquityRequired)}
            />
            <MetricRow
              label="Cash-on-cash return"
              tooltip="Annual cash flow after debt service divided by total equity required. A year-one levered return measure."
              value={fmtPercent(results.cashOnCashReturn)}
              emphasis
            />
          </ResultsCard>

          {stressTest && (
            <ResultsCard title="Cap Rate Stress Test">
              <MetricRow
                label="Implied NOI (from stated cap rate)"
                tooltip="Purchase price × stated cap rate. The NOI the listing's cap rate assumes."
                value={fmtCurrency(stressTest.impliedNoi)}
                emphasis
              />
              <div className="py-2.5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">
                      <th className="pb-2 text-left font-semibold">Expense ratio</th>
                      <th className="pb-2 text-right font-semibold">
                        Required rent / unit / mo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stressTest.rows.map((row) => (
                      <tr key={row.expenseRatioPct}>
                        <td className="py-2 text-slate-600 dark:text-slate-400">
                          {row.expenseRatioPct}%
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
                          {fmtCurrency(row.requiredRentPerUnitPerMonth)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ResultsCard>
          )}
        </div>
      </div>

      {redFlags.length > 0 && (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-400">
            Red Flags
          </h3>
          <ul className="mt-3 space-y-2">
            {redFlags.map((flag) => (
              <li
                key={flag.id}
                className="flex gap-2 text-sm text-amber-900 dark:text-amber-300"
              >
                <span aria-hidden>⚠</span>
                <span>{flag.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-10 text-xs leading-relaxed text-slate-400 dark:text-slate-600">
        Year-one static analysis only — excludes rent growth, exit assumptions, closing
        costs, and loan fees. Capex reserves are only reflected in NOI when the toggle
        above is enabled. Vacancy loss is applied to rental income only; other income is
        assumed collected regardless of vacancy.
      </p>
    </div>
  );
}
