export type UnderwritingInputs = {
  purchasePrice: number;
  unitCount: number;
  avgMonthlyRentPerUnit: number;
  otherMonthlyIncome: number;
  vacancyRatePct: number;
  operatingExpenseRatioPct: number;
  loanAmount: number;
  annualInterestRatePct: number;
  amortizationYears: number;
  capexReservesEnabled: boolean;
};

export type UnderwritingResults = {
  grossPotentialRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  capexReserves: number;
  netOperatingIncome: number;
  goingInCapRate: number;
  annualDebtService: number;
  dscr: number;
  annualCashFlow: number;
  totalEquityRequired: number;
  cashOnCashReturn: number;
};

export const CAPEX_RESERVE_PER_UNIT_PER_YEAR = 275;
export const STRESS_TEST_EXPENSE_RATIOS = [35, 40, 45, 50];

function calculateAnnualDebtService(
  loanAmount: number,
  annualInterestRatePct: number,
  amortizationYears: number,
): number {
  const paymentsCount = amortizationYears * 12;
  if (paymentsCount <= 0 || loanAmount <= 0) return 0;

  const monthlyRate = annualInterestRatePct / 100 / 12;
  if (monthlyRate === 0) {
    return (loanAmount / paymentsCount) * 12;
  }

  const monthlyPayment =
    (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -paymentsCount));
  return monthlyPayment * 12;
}

export function calculateUnderwriting(inputs: UnderwritingInputs): UnderwritingResults {
  const grossPotentialRent = inputs.avgMonthlyRentPerUnit * inputs.unitCount * 12;
  const annualOtherIncome = inputs.otherMonthlyIncome * 12;
  const vacancyLoss = grossPotentialRent * (inputs.vacancyRatePct / 100);
  const effectiveGrossIncome = grossPotentialRent - vacancyLoss + annualOtherIncome;
  const operatingExpenses = effectiveGrossIncome * (inputs.operatingExpenseRatioPct / 100);
  const capexReserves = inputs.capexReservesEnabled
    ? inputs.unitCount * CAPEX_RESERVE_PER_UNIT_PER_YEAR
    : 0;
  const netOperatingIncome = effectiveGrossIncome - operatingExpenses - capexReserves;

  const goingInCapRate =
    inputs.purchasePrice !== 0 ? netOperatingIncome / inputs.purchasePrice : NaN;

  const annualDebtService = calculateAnnualDebtService(
    inputs.loanAmount,
    inputs.annualInterestRatePct,
    inputs.amortizationYears,
  );
  const dscr = annualDebtService !== 0 ? netOperatingIncome / annualDebtService : NaN;
  const annualCashFlow = netOperatingIncome - annualDebtService;
  const totalEquityRequired = inputs.purchasePrice - inputs.loanAmount;
  const cashOnCashReturn =
    totalEquityRequired !== 0 ? annualCashFlow / totalEquityRequired : NaN;

  return {
    grossPotentialRent,
    effectiveGrossIncome,
    operatingExpenses,
    capexReserves,
    netOperatingIncome,
    goingInCapRate,
    annualDebtService,
    dscr,
    annualCashFlow,
    totalEquityRequired,
    cashOnCashReturn,
  };
}

export type CapRateStressTestRow = {
  expenseRatioPct: number;
  requiredRentPerUnitPerMonth: number;
};

export type CapRateStressTest = {
  impliedNoi: number;
  rows: CapRateStressTestRow[];
};

/**
 * Given a cap rate advertised on a listing, back into the NOI it implies,
 * then find the monthly rent per unit required to hit that NOI at a range
 * of plausible operating-expense ratios (net of capex reserves, if enabled).
 */
export function calculateCapRateStressTest(
  inputs: UnderwritingInputs,
  statedCapRatePct: number,
): CapRateStressTest {
  const impliedNoi = inputs.purchasePrice * (statedCapRatePct / 100);
  const capexReserves = inputs.capexReservesEnabled
    ? inputs.unitCount * CAPEX_RESERVE_PER_UNIT_PER_YEAR
    : 0;
  const annualOtherIncome = inputs.otherMonthlyIncome * 12;
  const vacancyFactor = 1 - inputs.vacancyRatePct / 100;

  const rows = STRESS_TEST_EXPENSE_RATIOS.map((expenseRatioPct) => {
    const requiredEgi = (impliedNoi + capexReserves) / (1 - expenseRatioPct / 100);
    const requiredGpr = (requiredEgi - annualOtherIncome) / vacancyFactor;
    const requiredRentPerUnitPerMonth =
      inputs.unitCount > 0 ? requiredGpr / (inputs.unitCount * 12) : NaN;
    return { expenseRatioPct, requiredRentPerUnitPerMonth };
  });

  return { impliedNoi, rows };
}

export type RedFlag = {
  id: string;
  message: string;
};

export function calculateRedFlags(
  inputs: UnderwritingInputs,
  results: UnderwritingResults,
): RedFlag[] {
  const flags: RedFlag[] = [];

  if (inputs.operatingExpenseRatioPct < 35) {
    flags.push({
      id: "expense-ratio",
      message: `Operating expense ratio of ${inputs.operatingExpenseRatioPct}% is unusually low for multifamily — verify the seller's expense assumptions before trusting this NOI.`,
    });
  }

  if (inputs.vacancyRatePct < 5) {
    flags.push({
      id: "vacancy",
      message: `Vacancy assumption of ${inputs.vacancyRatePct}% is below the typical 5% minimum — stress-test at a higher vacancy rate.`,
    });
  }

  if (Number.isFinite(results.dscr) && results.dscr < 1.25) {
    flags.push({
      id: "dscr",
      message: `DSCR of ${results.dscr.toFixed(2)}x is below the 1.25x lender comfort threshold.`,
    });
  }

  if (Number.isFinite(results.cashOnCashReturn) && results.cashOnCashReturn < 0.07) {
    flags.push({
      id: "cash-on-cash",
      message: `Cash-on-cash return of ${(results.cashOnCashReturn * 100).toFixed(1)}% is below the 7% target.`,
    });
  }

  if (!inputs.capexReservesEnabled) {
    flags.push({
      id: "capex",
      message: `Capex reserves are not included — NOI overstates sustainable cash flow. Consider enabling the $${CAPEX_RESERVE_PER_UNIT_PER_YEAR}/unit/year reserve.`,
    });
  }

  return flags;
}

export type Verdict = "PURSUE" | "PASS" | "NEEDS MORE INFO";

export type VerdictResult = {
  verdict: Verdict;
  reasoning: string;
};

export function calculateVerdict(results: UnderwritingResults): VerdictResult {
  const { dscr, cashOnCashReturn: coc } = results;

  const dscrStr = Number.isFinite(dscr) ? `${dscr.toFixed(2)}x` : "n/a (no debt service)";
  const cocStr = Number.isFinite(coc) ? `${(coc * 100).toFixed(1)}%` : "n/a";

  const dscrClearsPursue = dscr >= 1.25;
  const cocClearsPursue = coc >= 0.07;
  const dscrTripsPass = dscr < 1.2;
  const cocTripsPass = coc < 0.04;

  if (dscrClearsPursue && cocClearsPursue) {
    return {
      verdict: "PURSUE",
      reasoning: `DSCR of ${dscrStr} and cash-on-cash of ${cocStr} both clear the underwriting bar (≥1.25x DSCR, ≥7% CoC).`,
    };
  }

  if (dscrTripsPass || cocTripsPass) {
    const reasons: string[] = [];
    if (dscrTripsPass) reasons.push(`DSCR of ${dscrStr} is below the 1.20x minimum`);
    if (cocTripsPass) reasons.push(`cash-on-cash of ${cocStr} is below the 4% minimum`);
    return { verdict: "PASS", reasoning: `${reasons.join(" and ")}.` };
  }

  return {
    verdict: "NEEDS MORE INFO",
    reasoning: `DSCR of ${dscrStr} and cash-on-cash of ${cocStr} land between the PASS and PURSUE thresholds — underwrite further before deciding.`,
  };
}
