export default function Logo({ size = 28, white = false }) {
  // Theme-aware: steps follow the wordmark colour (--ink flips to beige in dark
  // mode), connectors use a logo-specific accent that stays legible on dark.
  const c   = white ? "#fff" : "var(--ink)";
  const acc = white ? "rgba(255,255,255,0.6)" : "var(--logo-acc, var(--crimson))";
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Threshold step symbol */}
      <rect x="2" y="18" width="8" height="2" fill={c}/>
      <rect x="10" y="10" width="8" height="2" fill={c}/>
      <rect x="18" y="4" width="8" height="2" fill={c}/>
      {/* Vertical connectors */}
      <rect x="10" y="12" width="2" height="6" fill={acc}/>
      <rect x="18" y="6" width="2" height="4" fill={acc}/>
      {/* Base line */}
      <rect x="2" y="24" width="24" height="1.5" fill={acc} opacity="0.4"/>
    </svg>
  );
}
