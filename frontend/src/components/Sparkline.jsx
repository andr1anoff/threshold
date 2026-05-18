/**
 * Sparkline — tiny trend chart for region cards.
 * Shows nothing if no history data yet.
 * Automatically scales to available data.
 */
export default function Sparkline({ data, color = "#8B2030", width = 80, height = 28 }) {
  if (!data || data.length < 2) return null;

  const values = data.map(d => d.ei_score ?? d.di_score ?? 0).filter(v => v != null);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  const lastY = height - ((values[values.length-1] - min) / range) * (height - 4) - 2;

  return (
    <svg width={width} height={height} style={{ display:"block", overflow:"visible" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.7}
      />
      {/* Last point dot */}
      <circle
        cx={(values.length - 1) / (values.length - 1) * width}
        cy={lastY}
        r={2.5}
        fill={color}
        opacity={0.9}
      />
    </svg>
  );
}
