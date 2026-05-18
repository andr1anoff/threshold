import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Sparkline from "../components/Sparkline";
import { REGIONS } from "../data/seed";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

const EI_COLOR = s => s==null?"#94a3b8":s>=65?"#8B2030":s>=45?"#C0622B":s>=25?"#B07D1A":"#2D7A4F";
const EI_LABEL = s => s==null?"NO DATA":s>=65?"HIGH":s>=45?"MODERATE":s>=25?"ELEVATED":"LOW";
const EI_BG    = s => s==null?"rgba(148,163,184,0.08)":s>=65?"rgba(139,32,48,0.07)":s>=45?"rgba(192,98,43,0.07)":s>=25?"rgba(176,125,26,0.07)":"rgba(45,122,79,0.07)";

const SORT_OPTS = [
  {key:"ei",label:"By Index"},
  {key:"alpha",label:"A–Z"},
  {key:"rising",label:"Rising"},
];
const FILTER_OPTS = [
  {key:"all",label:"All"},
  {key:"high",label:"High"},
  {key:"moderate",label:"Moderate"},
  {key:"low",label:"Low"},
  {key:"conflict",label:"Active Conflict"},
  {key:"tension",label:"Strategic Tension"},
];

function RegionCard({ region, onClick, selected, sparkData }) {
  const color = EI_COLOR(region.ei);
  const label = EI_LABEL(region.ei);
  const bg    = EI_BG(region.ei);
  const isSel = selected?.id === region.id;
  const trend = region.trend; // null = no data, number = delta

  return (
    <div
      role="button" tabIndex={0}
      aria-pressed={isSel}
      onClick={() => onClick(region)}
      onKeyDown={e => (e.key==="Enter"||e.key===" ") && onClick(region)}
      style={{
        background: isSel ? bg : "#fff",
        border: `1px solid ${isSel ? color+"50" : "rgba(26,16,8,0.08)"}`,
        borderRadius:12, padding:"18px 20px", cursor:"pointer",
        transition:"all .18s",
        boxShadow: isSel ? `0 4px 20px rgba(26,16,8,0.10)` : "0 1px 3px rgba(26,16,8,0.04)",
        outline:"none",
      }}
    >
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <span style={{ fontSize:13, fontWeight:600, color:"var(--ink)", lineHeight:1.3 }}>{region.label}</span>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:"1.5px", padding:"3px 8px", borderRadius:999, background:bg, color, border:`1px solid ${color}22`, whiteSpace:"nowrap", flexShrink:0, marginLeft:8 }}>
          {label}
        </span>
      </div>

      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ fontSize:44, fontWeight:800, lineHeight:1, color, letterSpacing:"-1.5px", fontVariantNumeric:"tabular-nums" }}>
          {region.ei ?? "—"}
        </div>
        {/* Sparkline — shows when history exists, invisible otherwise */}
        <div style={{ paddingBottom:4 }}>
          <Sparkline data={sparkData} color={color} width={72} height={26}/>
        </div>
      </div>

      <div style={{ height:2, background:"rgba(26,16,8,0.06)", borderRadius:1, overflow:"hidden", marginBottom:10 }}>
        <div style={{ height:"100%", width:`${region.ei||0}%`, background:color, opacity:0.55, borderRadius:1 }}/>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:9, letterSpacing:"0.8px", fontWeight:500, color:"rgba(26,16,8,0.35)" }}>
          {region.category==="conflict"?"ACTIVE CONFLICT":"STRATEGIC TENSION"}
        </div>
        {/* Trend — only shows when real data available */}
        {trend != null && (
          <div style={{ fontSize:10, fontWeight:600, fontVariantNumeric:"tabular-nums",
            color: trend > 0 ? "#8B2030" : trend < 0 ? "#2D7A4F" : "rgba(26,16,8,0.35)" }}>
            {trend > 0 ? `↑ +${trend}` : trend < 0 ? `↓ ${trend}` : "→ stable"}
          </div>
        )}
      </div>
    </div>
  );
}

function RegionDrawer({ region, onClose, incidents }) {
  const navigate = useNavigate();
  if (!region) return null;
  const color = EI_COLOR(region.ei);

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(26,16,8,0.15)", zIndex:40, backdropFilter:"blur(2px)" }}/>
      <div role="dialog" aria-label={`${region.label} detail`} style={{
        position:"fixed", right:0, top:56, bottom:0, width:360,
        background:"var(--cream)", zIndex:50,
        borderLeft:"1px solid rgba(26,16,8,0.10)",
        display:"flex", flexDirection:"column",
        boxShadow:"-8px 0 32px rgba(26,16,8,0.08)",
        overflow:"hidden",
      }}>
        <div style={{ padding:"18px 20px", borderBottom:"1px solid rgba(26,16,8,0.08)", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"2px", color:"var(--crimson)", marginBottom:6 }}>REGION DETAIL</div>
            <div style={{ fontSize:17, fontWeight:700, color:"var(--ink)" }}>{region.label}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background:"none", border:"1px solid rgba(26,16,8,0.12)", borderRadius:6, padding:"5px 9px", cursor:"pointer", fontSize:14, color:"var(--ink-muted)" }}>✕</button>
        </div>

        <div style={{ padding:"16px 20px", borderBottom:"1px solid rgba(26,16,8,0.08)", background:`${color}06` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
            <div>
              <div style={{ fontSize:10, letterSpacing:"1.5px", color:"rgba(26,16,8,0.4)", marginBottom:4 }}>ESCALATION INDEX</div>
              <div style={{ fontSize:48, fontWeight:800, color, lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{region.ei ?? "—"}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:"1px", padding:"4px 10px", borderRadius:999, background:`${color}12`, color, border:`1px solid ${color}25`, marginBottom:6 }}>
                {EI_LABEL(region.ei)}
              </div>
              <div style={{ fontSize:11, color:"rgba(26,16,8,0.4)" }}>
                {region.category==="conflict"?"Active conflict":"Strategic tension"}
              </div>
            </div>
          </div>
          <div style={{ height:3, background:"rgba(26,16,8,0.06)", borderRadius:2, overflow:"hidden", marginTop:12 }}>
            <div style={{ height:"100%", width:`${region.ei||0}%`, background:color, opacity:0.6 }}/>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"14px 20px" }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"2px", color:"var(--ink-muted)", marginBottom:12 }}>RECENT INCIDENTS</div>
          {incidents.length === 0 ? (
            <div style={{ fontSize:12, color:"rgba(26,16,8,0.3)", lineHeight:1.6 }}>No indexed incidents for this region yet.</div>
          ) : incidents.slice(0,5).map((inc,i) => (
            <div key={i} style={{ marginBottom:10, paddingBottom:10, borderBottom:i<4?"1px solid rgba(26,16,8,0.06)":"none" }}>
              <div style={{ fontSize:9, color:"rgba(26,16,8,0.35)", marginBottom:3, fontVariantNumeric:"tabular-nums" }}>{inc.date?.slice(0,10)}</div>
              <div style={{ fontSize:12, fontWeight:500, color:"var(--ink)", lineHeight:1.4 }}>{inc.title}</div>
            </div>
          ))}
        </div>

        <div style={{ padding:"14px 20px", borderTop:"1px solid rgba(26,16,8,0.08)", display:"flex", gap:10 }}>
          <button onClick={() => navigate("/incidents")} style={{ flex:1, fontSize:12, color:"var(--ink-muted)", background:"none", border:"1px solid rgba(26,16,8,0.15)", borderRadius:6, padding:"9px 0", cursor:"pointer", fontWeight:500 }}>
            All incidents
          </button>
          <button onClick={() => navigate("/briefs")} style={{ flex:1, fontSize:12, color:"#fff", background:"var(--crimson)", border:"none", borderRadius:6, padding:"9px 0", cursor:"pointer", fontWeight:600 }}>
            Generate brief →
          </button>
        </div>
      </div>
    </>
  );
}

export default function Home() {
  const [regions, setRegions]         = useState(REGIONS);
  const [sort, setSort]               = useState("ei");
  const [filter, setFilter]           = useState("all");
  const [live, setLive]               = useState(false);
  const [status, setStatus]           = useState(null);
  const [drawerRegion, setDrawerRegion] = useState(null);
  const [drawerIncidents, setDrawerIncidents] = useState([]);
  // F2: trends from API — null per region until data available
  const [trends, setTrends]           = useState({});
  // F8: sparkline history per region
  const [sparklines, setSparklines]   = useState({});

  useEffect(() => {
    // Load EI scores
    fetch(`${API}/api/di/global`)
      .then(r=>r.json())
      .then(res => {
        if (res.data?.length) {
          setRegions(REGIONS.map(r => {
            const lv = res.data.find(d => d.region===r.id);
            return lv ? {...r, ei: Math.round(lv.ei_score ?? lv.di_score ?? r.ei)} : r;
          }));
          setLive(true);
        }
      }).catch(()=>{});

    // F2: Load trends — returns null per region if insufficient data
    fetch(`${API}/api/di/trends`)
      .then(r=>r.json())
      .then(d => { if (d.trends) setTrends(d.trends); })
      .catch(()=>{});

    // Status
    fetch(`${API}/api/admin/status`)
      .then(r=>r.json()).then(d=>setStatus(d)).catch(()=>{});
  }, []);

  // F8: Load sparkline history for all regions lazily
  // Only fetch when we know there's data (status.ei_records > 20)
  useEffect(() => {
    if (!status?.ei_records || status.ei_records < 20) return;
    // Fetch history for all regions in parallel, quietly
    REGIONS.forEach(r => {
      fetch(`${API}/api/di/history/${encodeURIComponent(r.id)}`)
        .then(res=>res.json())
        .then(d => {
          if (d.data?.length >= 2) {
            setSparklines(prev => ({...prev, [r.id]: d.data}));
          }
        }).catch(()=>{});
    });
  }, [status]);

  function openDrawer(region) {
    if (drawerRegion?.id === region.id) { setDrawerRegion(null); return; }
    setDrawerRegion(region);
    setDrawerIncidents([]);
    fetch(`${API}/api/incidents/?region=${encodeURIComponent(region.id)}`)
      .then(r=>r.json()).then(d=>setDrawerIncidents(d.data||[])).catch(()=>{});
  }

  // Merge live trends into regions (null = no data = don't show)
  const regionsWithTrends = regions.map(r => ({
    ...r,
    trend: trends[r.id] ?? null,
  }));

  const filtered = regionsWithTrends.filter(r => {
    if (filter==="all") return true;
    if (filter==="high") return (r.ei??0)>=65;
    if (filter==="moderate") return (r.ei??0)>=45&&(r.ei??0)<65;
    if (filter==="low") return (r.ei??0)<45;
    if (filter==="conflict") return r.category==="conflict";
    if (filter==="tension") return r.category==="tension";
    return true;
  });

  const sorted = [...filtered].sort((a,b) => {
    if (sort==="ei") return (b.ei??0)-(a.ei??0);
    if (sort==="alpha") return a.label.localeCompare(b.label);
    if (sort==="rising") return (b.trend??-999)-(a.trend??-999);
    return 0;
  });

  const critical = regions.filter(r=>(r.ei??0)>=65);

  return (
    <Layout>
      {/* Hero */}
      <div style={{ background:"linear-gradient(135deg,#6B1A2A 0%,#3D0A14 55%,#1A0508 100%)", padding:"36px 20px 32px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, opacity:0.03, backgroundImage:"radial-gradient(circle, white 1px, transparent 1px)", backgroundSize:"40px 40px" }} aria-hidden="true"/>
        <div style={{ position:"relative", maxWidth:700 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:10, fontWeight:700, letterSpacing:"2.5px", color:"rgba(245,240,232,0.4)", marginBottom:16 }}>
            <div style={{ width:18, height:1.5, background:"rgba(245,240,232,0.4)" }} aria-hidden="true"/>
            GEOPOLITICAL INTELLIGENCE
          </div>
          <h1 style={{ fontSize:"clamp(28px, 5vw, 42px)", fontWeight:800, letterSpacing:"-1px", lineHeight:1.1, color:"#fff", marginBottom:12 }}>
            Escalation signals,<br/>monitored through open sources.
          </h1>
          <p style={{ fontSize:14, color:"rgba(245,240,232,0.55)", lineHeight:1.65, maxWidth:440, marginBottom:20 }}>
            Open-source escalation monitoring across 20 conflict and strategic tension areas. Not an official intelligence assessment.
          </p>
          <div style={{ display:"flex", gap:20, flexWrap:"wrap", fontSize:11, color:"rgba(245,240,232,0.45)", letterSpacing:"0.5px" }}>
            {live && <span style={{ display:"flex", alignItems:"center", gap:5, color:"rgba(74,222,128,0.85)", fontWeight:600 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"#4ade80" }} aria-hidden="true"/>OSINT MONITORING ACTIVE
            </span>}
            <span>20 REGIONS</span>
            {status?.incidents ? <span>{status.incidents.toLocaleString()} INCIDENTS INDEXED</span> : null}
            <span>30-DAY WINDOW</span>
          </div>
        </div>
      </div>

      <div style={{ padding:"24px 20px 52px", maxWidth:1240, margin:"0 auto", width:"100%" }}>
        {critical.length > 0 && (
          <div role="alert" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", marginBottom:20, fontSize:12, fontWeight:500, background:"rgba(139,32,48,0.05)", border:"1px solid rgba(139,32,48,0.15)", borderRadius:10, color:"#8B2030" }}>
            <span aria-hidden="true">▲</span>
            <span>{critical.length} region{critical.length>1?"s":""} at high escalation: {critical.map(r=>r.label).join(", ")}</span>
          </div>
        )}

        {/* Controls */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"1.5px", color:"var(--ink-muted)" }}>SORT</span>
            {SORT_OPTS.map(o=>(
              <button key={o.key} onClick={()=>setSort(o.key)} aria-pressed={sort===o.key} style={{ fontSize:12, fontWeight:sort===o.key?600:400, padding:"4px 12px", borderRadius:999, border:"1px solid", borderColor:sort===o.key?"var(--ink)":"rgba(26,16,8,0.15)", background:sort===o.key?"var(--ink)":"transparent", color:sort===o.key?"var(--cream)":"var(--ink-muted)", cursor:"pointer" }}>
                {o.label}
              </button>
            ))}
          </div>
          <div style={{ width:1, height:18, background:"rgba(26,16,8,0.1)" }} aria-hidden="true"/>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"1.5px", color:"var(--ink-muted)" }}>FILTER</span>
            {FILTER_OPTS.map(o=>(
              <button key={o.key} onClick={()=>setFilter(o.key)} aria-pressed={filter===o.key} style={{ fontSize:12, fontWeight:filter===o.key?600:400, padding:"4px 12px", borderRadius:999, border:"1px solid", borderColor:filter===o.key?"var(--crimson)":"rgba(26,16,8,0.15)", background:filter===o.key?"rgba(107,26,42,0.08)":"transparent", color:filter===o.key?"var(--crimson)":"var(--ink-muted)", cursor:"pointer" }}>
                {o.label}
              </button>
            ))}
          </div>
          <span style={{ marginLeft:"auto", fontSize:11, color:"var(--ink-muted)", fontStyle:"italic" }}>
            {sorted.length}/{regions.length} regions
          </span>
        </div>

        {/* Grid */}
        {sorted.length === 0 ? (
          <div style={{ padding:"48px 0", textAlign:"center", color:"var(--ink-muted)", fontSize:14 }}>No regions match this filter.</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap:10 }}>
            {sorted.map(r => (
              <RegionCard
                key={r.id} region={r}
                onClick={openDrawer}
                selected={drawerRegion}
                sparkData={sparklines[r.id] || null}
              />
            ))}
          </div>
        )}

        <p style={{ marginTop:28, fontSize:11, color:"rgba(26,16,8,0.28)", lineHeight:1.6, maxWidth:600 }}>
          The Escalation Index is a heuristic research indicator based on open-source data. Not a predictive model. Not an official intelligence assessment.
        </p>
      </div>

      <RegionDrawer region={drawerRegion} onClose={()=>setDrawerRegion(null)} incidents={drawerIncidents}/>
    </Layout>
  );
}
