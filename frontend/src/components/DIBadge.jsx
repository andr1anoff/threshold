export function DIBadge({ score, size = "md" }) {
  const color =
    score >= 75 ? "#ef4444" :
    score >= 50 ? "#f97316" :
    score >= 25 ? "#eab308" : "#22c55e";

  const label =
    score >= 75 ? "CRITICAL" :
    score >= 50 ? "HIGH" :
    score >= 25 ? "MODERATE" : "LOW";

  const sizeClass = size === "lg" ? "text-4xl font-black" : "text-2xl font-bold";

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={sizeClass} style={{ color }}>{score}</span>
      <span className="text-xs tracking-widest font-mono" style={{ color: color + "aa" }}>
        {label}
      </span>
    </div>
  );
}

export function DIBar({ gz, ex, rh }) {
  return (
    <div className="space-y-2 text-xs">
      {[
        { label: "Gray Zone", value: gz, color: "#ef4444" },
        { label: "Exercises", value: ex, color: "#3b82f6" },
        { label: "Rhetoric", value: rh, color: "#a855f7" },
      ].map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-gray-500 w-20">{label}</span>
          <div className="flex-1 h-1 rounded bg-gray-800 overflow-hidden">
            <div className="h-full rounded" style={{ width: `${value}%`, backgroundColor: color }} />
          </div>
          <span className="text-gray-400 w-6 text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}
