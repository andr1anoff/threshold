/**
 * THRESHOLD — logo mark.
 *
 * Three treads ascending left-to-right, each trailing an offset crimson echo.
 * The echo is not a shadow: it is the trace of the step, and it strengthens
 * as the climb goes on. Depth comes from displacement, not from shading —
 * which is why the mark survives at 16px and why it behaves identically on
 * cream and on ink.
 *
 * Geometry lives in ONE place (BARS / ECHOES below) and is mirrored exactly
 * in public/favicon.svg. If you change one, change the other.
 *
 * Grid: 32×32. Tread 9×4. Run 8, rise 6 — even climb. Echo offset (−2, +2).
 */

// x, y of each tread, bottom step first
const BARS = [
  [5, 19],
  [13, 13],
  [21, 7],
];

// echo positions: each tread displaced (−2, +2)
const ECHOES = [
  [3, 21],
  [11, 15],
  [19, 9],
];

const TW = 9; // tread width
const TH = 4; // tread height

export default function Logo({ size = 28, white = false }) {
  // Treads follow the wordmark: --ink flips to bone in dark mode.
  const tread = white ? "#fff" : "var(--ink)";

  // The echo escalates. Solid tints, not opacity — a washed-out echo goes
  // muddy on cream and vanishes on ink. Each rung has its own declared value.
  const echo = white
    ? ["rgba(255,255,255,0.30)", "rgba(255,255,255,0.45)", "rgba(255,255,255,0.62)"]
    : [
        "var(--logo-echo-1, #B08A92)",
        "var(--logo-echo-2, #8E4655)",
        "var(--logo-echo-3, var(--logo-acc, var(--crimson)))",
      ];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "none" }}
    >
      {ECHOES.map(([x, y], i) => (
        <rect key={`e${i}`} x={x} y={y} width={TW} height={TH} fill={echo[i]} />
      ))}
      {BARS.map(([x, y], i) => (
        <rect key={`b${i}`} x={x} y={y} width={TW} height={TH} fill={tread} />
      ))}
    </svg>
  );
}
