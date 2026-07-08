import type { BillingInterval } from "../lib/billingParams";

const OPTIONS: { value: BillingInterval; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Annual — save ~15%" },
];

export default function BillingIntervalToggle({
  value,
  onChange,
  className = "",
}: {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  className?: string;
}) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="inline-flex rounded-xl border border-mist bg-white p-1">
        {OPTIONS.map(({ value: optionValue, label }) => (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              value === optionValue ? "bg-brand text-white" : "text-smoke hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
