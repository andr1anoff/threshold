import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Sparkline from "../components/Sparkline";
import AnimatedNumber from "../components/AnimatedNumber";
import { REGIONS, SPARKLINES, CATS, EI_COLOR, EI_LABEL, getConf, INCIDENTS } from "../data/seed";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

export default function Home() {
  const navigate = useNavigate();
  const [sort, setSort]     = useState("ei");
  const [filter, setFilter] = useState("all");
  const [view, setView]     = useState("grid");
  const [incidents, setIncidents] = useState(INCIDENTS.slice(0,6));
  const [totalIndexed, setTotalIndexed] = useState(1247);
  // Live EI scores from API — merged with seed so Overview and Dossier use the same source
  const [liveEI, setLiveEI] = useState({});

  useEffect(() => {
    fetch(`${API}/api/incidents/?limit=6`)
      .then(r => r.json())
      .then(d => { if (d.data?.length) setIncidents(d.data.slice(0, 6)); })
      .catch(() => {});
    fetch(`${API}/api/incidents/`)
      .then(r => r.json())
      .then(d => { if (d.data?.length) setTotalIndexed(d.data.length); })
      .catch(() => {});
    // Fetch live EI scores for all regions (same endpoint Region.jsx uses)
    fetch(`${API}/api/di/global`)
      .then(r => r.json())
      .then(d => {
        if (d.data?.length) {
          const map = {};
          d.data.forEach(row => {
            if (row.region && row.ei_score != null) map[row.region] = row.ei_score;
          });
          setLiveEI(map);
        }
      })
      .catch(() => {});
  }, []);

  // Merge live EI into regions — same data source as Region Dossier
  const regions = useMemo(() => REGIONS.map(r => ({
    ...r,
    ei: liveEI[r.id] != null ? Math.round(liveEI[r.id]) : r.ei,
  })), [liveEI]);

  const critical = regions.filter(r => r.ei >= 50);
  const rising   = regions.filter(r => r.trend > 0).length;

  const filtered = useMemo(() => regions.filter(r => {
    if (filter === "all")      return true;
    if (filter === "high")     return r.ei >= 50;
    if (filter === "moderate") return r.ei >= 25 && r.ei < 50;
    if (filter === "low")      return r.ei < 25;
    if (filter === "conflict") return r.cat === "conflict";
    if (filter === "tension")  return r.cat === "tension";
    if (filter === "rising")   return r.trend > 0;
    return true;
  }), [filter, regions]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sort === "ei")     return b.ei - a.ei;
    if (sort === "alpha")  return a.label.localeCompare(b.label);
    if (sort === "rising") return b.trend - a.trend;
    return 0;
  }), [filtered, sort]);

  return (
    <Layout>
      <div className="route-in">

        {/* ─── HERO ─────────────────────── */}
        <section style={{ paddingTop:72, paddingBottom:56 }}>
          <div className="container-wide">
            <div className="stack-mobile" style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:80, alignItems:"end" }}>
              <div>
                <div className="micro micro-accent" style={{ marginBottom:24 }}>ESCALATION MONITOR</div>
                <h1 className="h1" style={{ fontSize:"clamp(40px, 4.6vw, 64px)", marginBottom:24, maxWidth:720 }}>
                  Twenty regions. One index. Observed daily through open sources.
                </h1>
                <p className="body-lg" style={{ maxWidth:520, marginBottom:32, color:"var(--ink-55)" }}>
                  A research indicator covering active conflict and strategic-tension theatres. Not an official intelligence assessment.
                </p>
                <button className="btn-ghost" onClick={() => navigate("/incidents")}>View incidents</button>
              </div>
              <div className="hide-mobile">
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                  <StatBlock n={totalIndexed} label="incidents indexed" />
                  <StatBlock n={20} label="regions monitored" />
                  <StatBlock n={critical.length} label="at high escalation" emphasis />
                  <StatBlock n={rising} label="rising · 7-day" />
                </div>
              </div>
              {/* Mobile: compact inline stats */}
              <div style={{ display:"none" }} className="show-mobile-flex">
                <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginTop:8 }}>
                  {[
                    [totalIndexed, "incidents"],
                    [critical.length, "high EI", true],
                    [rising, "rising"],
                  ].map(([n, label, emph]) => (
                    <div key={label} style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                      <span style={{ fontSize:24, fontWeight:800, letterSpacing:"-0.03em", color: emph ? "var(--accent)" : "var(--ink)" }}>{n}</span>
                      <span className="micro" style={{ color:"var(--ink-40)" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── REGION INDEX ─────────────────────── */}
        <section className="container-wide" style={{ paddingTop:32, paddingBottom:60 }}>
          <div className="section-bar">
            <span className="micro micro-strong">Regions</span>
            <span className="micro" style={{ color:"var(--ink-40)" }}>
              {sort==="ei" && "sorted by escalation index"}
              {sort==="alpha" && "sorted A–Z"}
              {sort==="rising" && "sorted by 7-day rise"}
            </span>
            <div className="meta" style={{ display:"flex", gap:8 }}>
              <button className={`chip ${view==="grid"?"is-active":""}`} onClick={()=>setView("grid")}>Grid</button>
              <button className={`chip ${view==="index"?"is-active":""}`} onClick={()=>setView("index")}>Table</button>
            </div>
          </div>

          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 }}>
            <span className="micro" style={{ alignSelf:"center", marginRight:6 }}>SORT</span>
            {[["ei","By index"],["alpha","A–Z"],["rising","Rising"]].map(([k,l]) => (
              <button key={k} className={`chip ${sort===k?"is-active":""}`} onClick={()=>setSort(k)}>{l}</button>
            ))}
            <span style={{ width:1, height:22, background:"var(--rule)", margin:"0 8px", alignSelf:"center" }}/>
            <span className="micro" style={{ alignSelf:"center", marginRight:6 }}>FILTER</span>
            {[["all","All"],["high","High"],["moderate","Moderate"],["low","Low"],["conflict","Active"],["tension","Tension"],["rising","Rising"]].map(([k,l]) => (
              <button key={k} className={`chip is-accent ${filter===k?"is-active":""}`} onClick={()=>setFilter(k)}>{l}</button>
            ))}
            <span className="micro" style={{ marginLeft:"auto", alignSelf:"center", color:"var(--ink-40)" }}>{sorted.length}/20</span>
          </div>

          {view === "index"
            ? <RegionTable regions={sorted} onSelect={r => navigate(`/region/${encodeURIComponent(r.id)}`)} />
            : <RegionGrid  regions={sorted} onSelect={r => navigate(`/region/${encodeURIComponent(r.id)}`)} />
          }
        </section>

        {/* ─── LATEST DISPATCHES ─────────────────────── */}
        {incidents.length > 0 && (
          <section className="container-wide" style={{ paddingTop:24, paddingBottom:72 }}>
            <div className="section-bar">
              <span className="micro micro-strong">§ 02 · LATEST DISPATCHES</span>
              <span className="micro hide-mobile" style={{ color:"var(--ink-40)" }}>recent · {incidents.length} entries</span>
              <button className="micro" style={{ cursor:"pointer", textDecoration:"underline", textUnderlineOffset:4, marginLeft:"auto", color:"var(--ink-55)" }} onClick={()=>navigate("/incidents")}>
                All incidents →
              </button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:0 }} className="stack-mobile">
              {incidents.slice(0,6).map((inc, i) => <DispatchTile key={inc.id||i} inc={inc} idx={i} />)}
            </div>
          </section>
        )}

      </div>
    </Layout>
  );
}

function StatBlock({ n, label, emphasis }) {
  return (
    <div style={{
      padding:"16px 20px",
      background:"linear-gradient(135deg, #1a1a1a 0%, #2a2220 100%)",
      borderLeft:`4px solid ${emphasis ? "#DC143C" : "rgba(220,20,60,0.45)"}`,
      borderRadius:2,
    }}>
      <div className="tab-num" style={{ fontSize:48, fontWeight:800, letterSpacing:"-0.035em", lineHeight:1, color:emphasis?"#DC143C":"#e8e0d4", marginBottom:6 }}>
        <AnimatedNumber value={n} duration={emphasis ? 1800 : 1200} />
      </div>
      <div className="micro" style={{ color:"rgba(232,224,212,0.55)", letterSpacing:"0.12em" }}>{label}</div>
    </div>
  );
}

function RegionTable({ regions, onSelect }) {
  return (
    <div style={{ borderTop:"1px solid var(--ink)" }}>
      {/* Desktop header */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"32px 1fr 130px 80px 64px 160px 100px 24px",
        gap:16, padding:"10px 0",
        borderBottom:"1px solid var(--rule-strong)",
        fontFamily:"var(--mono)", fontSize:10, fontWeight:500,
        letterSpacing:"0.18em", textTransform:"uppercase", color:"var(--ink-55)",
      }}>
        <span style={{ textAlign:"center" }}>#</span>
        <span>Region</span>
        <span>Category</span>
        <span style={{ textAlign:"right" }}>EI</span>
        <span style={{ textAlign:"right" }}>7-day</span>
        <span>30-day trend</span>
        <span style={{ textAlign:"right" }}>Status</span>
        <span/>
      </div>

      {regions.map((r, i) => {
        const color = EI_COLOR(r.ei);
        const spark = SPARKLINES[r.id];
        return (
          <div key={r.id}
            onClick={() => onSelect(r)}
            style={{
              display:"grid",
              gridTemplateColumns:"32px 1fr 130px 80px 64px 160px 100px 24px",
              gap:16, padding:"16px 0",
              borderBottom:"1px solid var(--rule)",
              alignItems:"center", cursor:"pointer",
              transition:"background 0.12s",
            }}
            onMouseEnter={e => e.currentTarget.style.background="var(--paper)"}
            onMouseLeave={e => e.currentTarget.style.background="transparent"}
          >
            <span className="mono small" style={{ textAlign:"center", color:"var(--ink-40)" }}>{String(i+1).padStart(2,"0")}</span>
            <div>
              <div style={{ fontSize:16, fontWeight:600, color:"var(--ink)", marginBottom:2 }}>{r.label}</div>
              <Coord lat={r.lat} lng={r.lng} />
            </div>
            <span className="mono small" style={{ color:"var(--ink-55)", letterSpacing:"0.06em", textTransform:"uppercase" }}>
              {r.cat === "conflict" ? "Active conflict" : "Strategic tension"}
            </span>
            <span style={{ fontSize:28, fontWeight:700, fontVariantNumeric:"tabular-nums", color, textAlign:"right", letterSpacing:"-0.02em" }}>
              {r.ei}
            </span>
            <span className="mono small tab-num" style={{ textAlign:"right", color: r.trend > 0 ? "var(--hi)" : r.trend < 0 ? "var(--lo)" : "var(--ink-40)" }}>
              {r.trend > 0 ? `+${r.trend}` : r.trend < 0 ? r.trend : "·"}
            </span>
            <div style={{ display:"flex", alignItems:"center" }}>
              {spark && <Sparkline data={spark} color={color} width={150} height={22} strokeWidth={1.25} />}
            </div>
            <span style={{ textAlign:"right" }}>
              <span className="micro" style={{ color }}>{EI_LABEL(r.ei)}</span>
            </span>
            <span style={{ color:"var(--ink-40)", textAlign:"right" }}>→</span>
          </div>
        );
      })}
    </div>
  );
}

function RegionGrid({ regions, onSelect }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:0, borderTop:"1px solid var(--ink)", borderLeft:"1px solid var(--rule)" }}>
      {regions.map((r, i) => {
        const color = EI_COLOR(r.ei);
        const spark = SPARKLINES[r.id];
        return (
          <div key={r.id}
            onClick={() => onSelect(r)}
            style={{
              padding:"20px 20px 18px",
              borderBottom:"1px solid var(--rule)",
              borderRight:"1px solid var(--rule)",
              cursor:"pointer",
              background:"var(--paper)",
              transition:"all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background="var(--cream)"; e.currentTarget.style.transform="translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="var(--paper)"; e.currentTarget.style.transform=""; }}
          >
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
              <div>
                <div className="mono small" style={{ color:"var(--ink-40)", marginBottom:4 }}>№ {String(i+1).padStart(2,"0")} · {r.short||r.id.slice(0,3).toUpperCase()}</div>
                <div style={{ fontSize:17, fontWeight:600 }}>{r.label}</div>
              </div>
              <span className="micro" style={{ color }}>{EI_LABEL(r.ei)}</span>
            </div>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:12 }}>
              <span className="tab-num" style={{ fontSize:56, fontWeight:800, letterSpacing:"-0.035em", color, lineHeight:1 }}>{r.ei}</span>
              <span style={{ paddingBottom:6 }}>
                {spark && <Sparkline data={spark} color={color} width={88} height={28} />}
              </span>
            </div>
            <div style={{ height:2, background:"var(--ink-06)", marginBottom:12 }}>
              <div style={{ height:"100%", width:`${r.ei}%`, background:color, opacity:0.7 }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--mono)", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ink-40)" }}>
              <span>{r.cat === "conflict" ? "Active" : "Tension"}</span>
              <span style={{ color: r.trend > 0 ? "var(--hi)" : r.trend < 0 ? "var(--lo)" : "var(--ink-40)" }}>
                {r.trend > 0 ? `↑ +${r.trend}` : r.trend < 0 ? `↓ ${r.trend}` : "→ stable"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DispatchTile({ inc, idx }) {
  const catKey = inc.category || inc.cat || "unknown";
  const cat = CATS[catKey] || CATS.unknown;
  return (
    <div style={{
      borderTop: idx >= 3 ? "1px solid var(--rule)" : "none",
      borderRight: (idx % 3) < 2 ? "1px solid var(--rule)" : "none",
      borderBottom: "1px solid var(--rule)",
      borderLeft: idx % 3 === 0 ? "1px solid var(--rule)" : "none",
      padding:"20px 24px", cursor:"pointer", transition:"background 0.12s",
    }}
      onMouseEnter={e => e.currentTarget.style.background="var(--paper)"}
      onMouseLeave={e => e.currentTarget.style.background="transparent"}
    >
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <span style={{ fontSize:14, color:cat.color }}>{cat.glyph}</span>
        <span className="micro" style={{ color:cat.color }}>{cat.label}</span>
        <span className="mono small" style={{ color:"var(--ink-40)", marginLeft:"auto" }}>{inc.date?.slice(0,10)||""}</span>
      </div>
      <div style={{ fontSize:14, fontWeight:500, lineHeight:1.4, color:"var(--ink)", marginBottom:8 }}>{inc.title||"—"}</div>
      <div className="mono small" style={{ color:"var(--ink-40)", display:"flex", justifyContent:"space-between" }}>
        <span>{inc.region||""}</span>
        {inc.source_url ? (
          <a href={inc.source_url} target="_blank" rel="noopener noreferrer"
            style={{ color:"var(--ink-40)", textDecoration:"underline", textUnderlineOffset:3 }}
            onClick={e => e.stopPropagation()}
          >
            {(inc.source_name||inc.src||"src").split(" ")[0]} ↗
          </a>
        ) : (inc.source_name||inc.src) ? (
          <span>{(inc.source_name||inc.src)} ↗</span>
        ) : null}
      </div>
    </div>
  );
}

function Coord({ lat, lng }) {
  if (lat == null || lng == null) return null;
  return (
    <span className="mono" style={{ fontSize:10, color:"var(--ink-40)", letterSpacing:"0.05em" }}>
      {Math.abs(lat).toFixed(1)}°{lat>=0?"N":"S"} {Math.abs(lng).toFixed(1)}°{lng>=0?"E":"W"}
    </span>
  );
}
