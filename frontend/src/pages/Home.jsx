import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Sparkline from "../components/Sparkline";
import AnimatedNumber from "../components/AnimatedNumber";
import { REGIONS, CATS, EI_COLOR, EI_LABEL, getConf } from "../data/seed";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

export default function Home() {
  const navigate = useNavigate();
  const [sort, setSort]     = useState("ei");
  const [filter, setFilter] = useState("all");
  const [view, setView]     = useState("grid");
  const [incidents, setIncidents] = useState([]);
  const [totalIndexed, setTotalIndexed] = useState(null);
  // Live EI scores from API — merged with seed so Overview and Dossier use the same source
  const [liveEI, setLiveEI] = useState({});

  useEffect(() => {
    fetch(`${API}/api/incidents/?limit=6`)
      .then(r => r.json())
      .then(d => { if (d.data?.length) setIncidents(d.data.slice(0, 6)); })
      .catch(() => {});
    fetch(`${API}/api/incidents/`)
      .then(r => r.json())
      .then(d => {
        // Prefer a server-side total/count field; fall back to data array length.
        // TODO: if /api/incidents/ is paginated and d.data.length is capped,
        // a dedicated count endpoint (e.g. /api/incidents/count) is needed for accuracy.
        const count = d.total ?? d.count ?? (d.data?.length ?? null);
        if (count != null) setTotalIndexed(count);
      })
      .catch(() => {});
    // Real EI + 7d delta + 30d history per region — one call, no synthetic data
    fetch(`${API}/api/di/overview`)
      .then(r => r.json())
      .then(d => { if (d.data && Object.keys(d.data).length) setLiveEI(d.data); })
      .catch(() => {});
  }, []);

  // Merge live data into static region config. No API data -> ei/trend/spark
  // stay null and the UI shows "no data" instead of inventing numbers.
  const regions = useMemo(() => REGIONS.map(r => {
    const live = liveEI[r.id];
    return {
      ...r,
      ei:    live?.ei_score != null ? Math.round(live.ei_score) : null,
      trend: live?.delta_7d != null ? Math.round(live.delta_7d) : null,
      spark: live?.history?.length >= 2 ? live.history.map(p => p.ei_score) : null,
    };
  }), [liveEI]);

  const critical = regions.filter(r => r.ei != null && r.ei >= 50);
  const rising   = regions.filter(r => (r.trend ?? 0) > 0).length;

  const formatIndexed = (n) =>
    n == null ? "—" :
    n < 1000 ? n.toLocaleString() :
    `${Math.floor(n / 1000) * 1000}+`;

  const filtered = useMemo(() => regions.filter(r => {
    if (filter === "all")      return true;
    if (filter === "high")     return r.ei != null && r.ei >= 50;
    if (filter === "moderate") return r.ei != null && r.ei >= 25 && r.ei < 50;
    if (filter === "low")      return r.ei != null && r.ei < 25;
    if (filter === "conflict") return r.cat === "conflict";
    if (filter === "tension")  return r.cat === "tension";
    if (filter === "rising")   return (r.trend ?? 0) > 0;
    return true;
  }), [filter, regions]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sort === "ei")     return (b.ei ?? -1) - (a.ei ?? -1);
    if (sort === "alpha")  return a.label.localeCompare(b.label);
    if (sort === "rising") return (b.trend ?? 0) - (a.trend ?? 0);
    return 0;
  }), [filtered, sort]);

  return (
    <Layout>
      <div className="route-in">

        {/* ─── HERO ─────────────────────── */}
        <section style={{ paddingTop:72, paddingBottom:56 }}>
          <div className="container-wide">
            <div className="stack-mobile" style={{ display:"grid", gridTemplateColumns:"1.1fr 1fr", gap:56, alignItems:"end" }}>
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
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
                  <StatBlock n={totalIndexed} label="signals indexed" format={formatIndexed} />
                  <StatBlock n={20} label="regions monitored" />
                  <StatBlock n={critical.length} label="at high escalation" emphasis />
                  <StatBlock n={rising} label="rising · 7-day" />
                </div>
              </div>
              {/* Mobile: compact inline stats */}
              <div style={{ display:"none" }} className="show-mobile-flex">
                <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginTop:8 }}>
                  {[
                    [totalIndexed, "signals", false, formatIndexed],
                    [critical.length, "high EI", true, null],
                    [rising, "rising", false, null],
                  ].map(([n, label, emph, fmt]) => (
                    <div key={label} style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                      <span style={{ fontSize:24, fontWeight:800, letterSpacing:"-0.03em", color: emph ? "var(--accent)" : "var(--ink)" }}>
                        {fmt ? fmt(n) : (n ?? "—")}
                      </span>
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
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14 }} className="stack-mobile">
              {incidents.slice(0,6).map((inc, i) => <DispatchTile key={inc.id||i} inc={inc} />)}
            </div>
          </section>
        )}

      </div>
    </Layout>
  );
}

function StatBlock({ n, label, emphasis, format }) {
  return (
    <div className="panel" style={{
      position:"relative", overflow:"hidden", padding:"26px 28px",
      background: emphasis ? "linear-gradient(145deg, var(--card) 0%, rgba(107,26,42,0.07) 100%)" : "var(--card)",
      borderColor: emphasis ? "rgba(107,26,42,0.18)" : "var(--card-border)",
    }}>
      {emphasis && <span style={{ position:"absolute", left:0, top:14, bottom:14, width:3, background:"var(--crimson)", borderRadius:"0 2px 2px 0", opacity:0.85 }}/>}
      <div className="tab-num" style={{ fontSize:64, fontWeight:800, letterSpacing:"-0.035em", lineHeight:1, color:emphasis?"var(--crimson)":"var(--ink)", marginBottom:6 }}>
        {n == null
          ? "—"
          : <AnimatedNumber value={n} duration={emphasis ? 1800 : 1200} format={format} />
        }
      </div>
      <div className="micro" style={{ color:"var(--ink-40)", letterSpacing:"0.12em" }}>{label}</div>
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
        const spark = r.spark;
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
              {r.ei ?? "—"}
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
    <div className="card-grid">
      {regions.map((r, i) => {
        const color = EI_COLOR(r.ei);
        const spark = r.spark;
        return (
          <div key={r.id} className="tile" onClick={() => onSelect(r)}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
              <div>
                <div className="filing" style={{ marginBottom:4 }}>№ {String(i+1).padStart(2,"0")} · {r.short||r.id.slice(0,3).toUpperCase()}</div>
                <div style={{ fontSize:17, fontWeight:600 }}>{r.label}</div>
              </div>
              <span className="micro" style={{ color }}>{EI_LABEL(r.ei)}</span>
            </div>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:12 }}>
              <span className="tab-num" style={{ fontSize:56, fontWeight:800, letterSpacing:"-0.035em", color, lineHeight:1 }}>{r.ei ?? "—"}</span>
              <span style={{ paddingBottom:6 }}>
                {spark && <Sparkline data={spark} color={color} width={88} height={28} />}
              </span>
            </div>
            <div style={{ height:2, background:"var(--ink-06)", marginBottom:12 }}>
              <div style={{ height:"100%", width:`${r.ei ?? 0}%`, background:color, opacity:0.7 }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--mono)", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ink-40)" }}>
              <span>{r.cat === "conflict" ? "Active" : "Tension"}</span>
              <span style={{ color: r.trend > 0 ? "var(--hi)" : r.trend < 0 ? "var(--lo)" : "var(--ink-40)" }}>
                {r.trend == null ? "·" : r.trend > 0 ? `↑ +${r.trend}` : r.trend < 0 ? `↓ ${r.trend}` : "→ stable"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DispatchTile({ inc }) {
  const catKey = inc.category || inc.cat || "unknown";
  const cat = CATS[catKey] || CATS.unknown;
  return (
    <div className="card-soft" style={{ padding:"18px 20px" }}>
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
