import UnderwritingCalculator from "@/app/components/underwriting-calculator";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      <UnderwritingCalculator />
    </div>
  );
}
