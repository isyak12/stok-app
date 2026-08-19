type Props = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn";
};

export default function StatCard({ label, value, hint, tone = "default" }: Props) {
  return (
    <div className="bg-white border border-ink/10 rounded-sm p-5 relative overflow-hidden">
      <div
        className={`absolute top-0 left-0 h-1 w-full ${
          tone === "warn" ? "bg-rust" : "bg-ink/15"
        }`}
      />
      <div className="text-[11px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </div>
      <div className="font-display text-3xl font-semibold mt-2 text-ink">
        {value}
      </div>
      {hint && (
        <div
          className={`text-xs mt-1 font-mono ${
            tone === "warn" ? "text-rust" : "text-ink/50"
          }`}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
