const CRIMSON = "#6B1A2A";
const CAT = {
  cyber:    ["rgba(220,38,38,0.08)","rgba(220,38,38,0.7)"],
  airspace: ["rgba(234,88,12,0.08)","rgba(234,88,12,0.7)"],
  maritime: ["rgba(37,99,235,0.08)","rgba(37,99,235,0.7)"],
  disinfo:  ["rgba(124,58,237,0.08)","rgba(124,58,237,0.7)"],
  economic: ["rgba(202,138,4,0.08)","rgba(202,138,4,0.7)"],
  proxy:    ["rgba(100,116,139,0.08)","rgba(100,116,139,0.7)"],
  exercise: ["rgba(22,163,74,0.08)","rgba(22,163,74,0.7)"],
  unknown:  ["rgba(0,0,0,0.05)","rgba(0,0,0,0.4)"],
};
const ICONS = { cyber:"⚡",airspace:"✈",maritime:"⚓",disinfo:"📡",proxy:"◎",exercise:"⊕",unknown:"·",economic:"💱" };

function Item({ item, type }) {
  const cat = type==="exercise" ? "exercise" : (item.category||"unknown");
  const [bg,col] = CAT[cat]||CAT.unknown;
  const date = type==="exercise" ? item.start_date : item.date;
  const title = item.name||item.title||"";
  const sub = type==="exercise"
    ? `${item.lead_nation||""} · ${item.scale?.toLocaleString()||""} troops`
    : item.description||item.summary||"";
  const src = item.source_url;
  const srcName = item.source_name;

  return (
    <div style={{ display:"flex",gap:10,padding:"10px 16px",borderBottom:"1px solid rgba(0,0,0,0.05)",transition:"background .12s",cursor:"pointer" }}
      onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.02)"}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}
    >
      <div style={{ width:26,height:26,borderRadius:8,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,color:col }}>{ICONS[cat]||"·"}</div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:2 }}>
          <span style={{ fontSize:9,color:"rgba(0,0,0,0.3)",fontWeight:500 }}>{date?.slice(0,10)}</span>
          <span style={{ fontSize:8.5,fontWeight:700,letterSpacing:"0.8px",padding:"1px 7px",borderRadius:999,background:bg,color:col }}>{cat.toUpperCase()}</span>
          {srcName && <a href={src||"#"} target="_blank" rel="noopener noreferrer" style={{ fontSize:8.5,color:CRIMSON,opacity:0.7,marginLeft:"auto" }} onClick={e=>e.stopPropagation()}>{srcName} ↗</a>}
        </div>
        <div style={{ fontSize:12,fontWeight:500,color:"#1a1a1a",lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{title}</div>
        {sub && <div style={{ fontSize:10,color:"rgba(0,0,0,0.35)",marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function Timeline({ incidents=[], exercises=[] }) {
  const all = [
    ...incidents.map(i=>({...i,_type:"incident",_d:i.date||""})),
    ...exercises.map(e=>({...e,_type:"exercise",_d:e.start_date||""})),
  ].sort((a,b)=>b._d.localeCompare(a._d));
  return (
    <div style={{ overflowY:"auto",maxHeight:360 }}>
      {all.map(item=><Item key={item.id} item={item} type={item._type}/>)}
    </div>
  );
}
