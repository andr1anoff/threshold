export default function Logo({ size = 28, white = false }) {
  const c = white ? "#fff" : "#1A1008";
  const acc = white ? "rgba(255,255,255,0.6)" : "#6B1A2A";
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
