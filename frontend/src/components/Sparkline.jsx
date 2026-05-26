export default function Sparkline({
  data,
  color = "#8B2030",
  width = 80,
  height = 28,
  strokeWidth = 1.5,
  showArea = false,
  showDot = false,
}) {
  if (!data || data.length < 2) return null;

  const values = data.map(d => (typeof d === "number" ? d : d.ei_score ?? d.di_score ?? 0)).filter(v => v != null);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pad = 2;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y];
  });

  const polyPts = pts.map(([x, y]) => `${x},${y}`).join(" ");

  const areaPath = pts.reduce((d, [x, y], i) =>
    i === 0 ? `M${x},${y}` : `${d} L${x},${y}`,
    ""
  ) + ` L${pts[pts.length-1][0]},${height} L${pts[0][0]},${height} Z`;

  const [lastX, lastY] = pts[pts.length - 1];

  return (
    <svg width={width} height={height} style={{ display:"block", overflow:"visible" }}>
      {showArea && (
        <path d={areaPath} fill={color} opacity={0.08} />
      )}
      <polyline
        points={polyPts}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.75}
      />
      {showDot && (
        <circle cx={lastX} cy={lastY} r={3} fill={color} opacity={0.9} />
      )}
    </svg>
  );
}
