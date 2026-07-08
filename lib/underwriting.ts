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
};

export type UnderwritingResults = {
  grossPotentialRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  goingInCapRate: number;
  annualDebtService: number;
  dscr: number;
  annualCashFlow: number;
  totalEquityRequired: number;
  cashOnCashReturn: number;
};

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
  const netOperatingIncome = effectiveGrossIncome - operatingExpenses;

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
    netOperatingIncome,
    goingInCapRate,
    annualDebtService,
    dscr,
    annualCashFlow,
    totalEquityRequired,
    cashOnCashReturn,
  };
}
