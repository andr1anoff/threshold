export default function ExerciseCard({ exercise: ex }) {
  const rh = ((ex.rhetoric_score??0)+1)/2;
  const isNATO = ex.exercise_type==="NATO";
  return (
    <div style={{ padding:"12px 16px",borderBottom:"1px solid rgba(0,0,0,0.05)",transition:"background .12s",cursor:"default" }}
      onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.02)"}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}
    >
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5 }}>
        <span style={{ fontSize:13,fontWeight:600,color:"#1a1a1a" }}>{ex.name}</span>
        <span style={{ fontSize:9,fontWeight:700,letterSpacing:"1px",padding:"2px 8px",borderRadius:999,background:isNATO?"rgba(37,99,235,0.08)":"rgba(220,38,38,0.08)",color:isNATO?"#1d4ed8":"#b91c1c" }}>
          {ex.exercise_type?.toUpperCase()||"EXERCISE"}
        </span>
      </div>
      <div style={{ fontSize:11,color:"rgba(0,0,0,0.4)",marginBottom:6 }}>
        {ex.lead_nation} · {ex.scale?.toLocaleString()} troops · {ex.start_date?.slice(0,10)} – {ex.end_date?.slice(0,10)}
      </div>
      <div style={{ display:"flex",alignItems:"center",gap:8,fontSize:10,color:"rgba(0,0,0,0.35)" }}>
        <span>Signal: <strong>{ex.signal_target||"—"}</strong></span>
        <div style={{ flex:1,height:2,background:"rgba(0,0,0,0.08)" }}>
          <div style={{ height:"100%",width:`${rh*100}%`,background:"rgba(220,38,38,0.5)" }}/>
        </div>
        <span>{ex.rhetoric_score?.toFixed(2)??"—"}</span>
      </div>
      {ex.participants?.length>0 && (
        <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginTop:8 }}>
          {ex.participants.slice(0,6).map(p=>(
            <span key={p} style={{ fontSize:10,padding:"2px 7px",borderRadius:999,background:"rgba(0,0,0,0.05)",color:"rgba(0,0,0,0.5)" }}>{p}</span>
          ))}
        </div>
      )}
    </div>
  );
}
