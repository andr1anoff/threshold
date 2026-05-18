export default function DIChart({ data }) {
  if (!data?.length) return null;
  const W = 400, H = 80, pl = 28, pr = 8, pt = 8, pb = 18;
  const iW = W-pl-pr, iH = H-pt-pb;
  const pts = data.map((d,i) => [pl+(i/Math.max(data.length-1,1))*iW, pt+(1-(d.ei_score||0)/100)*iH]);
  const line = pts.map(p=>p.join(",")).join(" ");
  const [lx,ly] = pts[pts.length-1];
  const area = `${pts[0][0]},${pt+iH} ${line} ${lx},${pt+iH}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"100%" }}>
      {[75,50,25].map(v => { const y=pt+(1-v/100)*iH; return (
        <g key={v}><line x1={pl} y1={y} x2={W-pr} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth="0.5"/>
        <text x={pl-4} y={y+3} fontSize="8" fill="rgba(0,0,0,0.3)" textAnchor="end" fontFamily="Inter,sans-serif">{v}</text></g>
      );})}
      <text x={pl} y={H-3} fontSize="8" fill="rgba(0,0,0,0.25)" fontFamily="Inter,sans-serif">{data[0]?.date?.slice(5)||""}</text>
      <text x={W-pr} y={H-3} fontSize="8" fill="rgba(0,0,0,0.25)" fontFamily="Inter,sans-serif" textAnchor="end">{data[data.length-1]?.date?.slice(5)||""}</text>
      <polygon points={area} fill="rgba(123,29,46,0.07)" stroke="none"/>
      <polyline points={line} fill="none" stroke={`rgba(123,29,46,0.7)`} strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx={lx} cy={ly} r="3" fill="rgba(123,29,46,0.85)"/>
    </svg>
  );
}
