import { useState, useEffect, useMemo } from "react";
import Layout from "../components/Layout";
import { REGIONS, CATS, getConf, INCIDENTS } from "../data/seed";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState(INCIDENTS);
  const [lastSync, setLastSync]   = useState("2026-05-20");
  const [region, setRegion]       = useState("all");
  const [cat, setCat]             = useState("all");
  const [search, setSearch]       = useState("");
  const [elMin, setElMin]         = useState(0);

  useEffect(() => {
    const url = region === "all"
      ? `${API}/api/incidents/`
      : `${API}/api/incidents/?region=${encodeURIComponent(region)}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.data?.length) {
          setIncidents(d.data);
          const dates = d.data.map(i => i.date).filter(Boolean).sort().reverse();
          if (dates[0]) setLastSync(dates[0].slice(0,10));
        }
      })
      .catch(() => {});
  }, [region]);

  const filtered = useMemo(() => incidents.filter(inc => {
    if (cat !== "all" && (inc.category || inc.cat) !== cat) return false;
    if (elMin > 0 && (inc.escalation_level || 1) < elMin) return false;
    if (search && !inc.title?.toLowerCase().includes(search.toLowerCase()) && !inc.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (region !== "all") {
      const r = REGIONS.find(r => r.id === region);
      if (r && inc.region !== r.label && inc.region !== r.id) return false;
    }
    return true;
  }), [incidents, cat, search, elMin, region]);

  const groups = useMemo(() => {
    const g = {};
    filtered.forEach(i => { const d = i.date?.slice(0,10)||"Unknown"; (g[d]||=[]).push(i); });
    return Object.entries(g).sort(([a],[b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <Layout>
      <div className="route-in">

        {/* ─── MASTHEAD ─────────────────────── */}
        <section style={{ paddingTop:60, paddingBottom:36 }}>
          <div className="container-wide">
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:32, flexWrap:"wrap" }}>
              <div>
                <div className="micro micro-accent" style={{ marginBottom:18, display:"flex", alignItems:"center", gap:10 }}>
                  <span className="tick"/>
                  INCIDENT LEDGER · OPEN-SOURCE INDEX
                </div>
                <h1 className="h1" style={{ marginBottom:14, maxWidth:720 }}>
                  Gray-zone incidents,<br/>dated and sourced.
                </h1>
                <p className="body-lg" style={{ maxWidth:540 }}>
                  Events classified by LLM, cross-checked against UCDP and ReliefWeb baselines. 60-day rolling window.
                </p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span className="pulse" style={{ background:"var(--lo)" }}/>
                  <span className="micro" style={{ color:"var(--ink-55)" }}>
                    {lastSync ? `LAST DATA · ${lastSync}` : "LIVE"}
                  </span>
                </div>
                <div className="mono small" style={{ color:"var(--ink-40)" }}>
                  {filtered.length} of {incidents.length} entries shown
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FILTER RAIL ─────────────────────── */}
        <section className="container-wide" style={{ paddingBottom:24 }}>
          <div style={{ borderTop:"1px solid var(--ink)", borderBottom:"1px solid var(--rule)", padding:"16px 0", display:"flex", alignItems:"center", gap:14 }}>
            <span className="micro">SEARCH</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="title · description · region"
              style={{ flex:1, padding:"8px 0", fontSize:16, fontFamily:"var(--sans)", borderBottom:"1px solid var(--ink-25)", background:"transparent", outline:"none", transition:"border-color .15s" }}
              onFocus={e => e.target.style.borderColor="var(--accent)"}
              onBlur={e => e.target.style.borderColor="var(--ink-25)"}
            />
            {search && <button onClick={()=>setSearch("")} className="mono small" style={{ color:"var(--ink-40)" }}>× clear</button>}
          </div>

          {/* Region filter */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, padding:"16px 0", borderBottom:"1px solid var(--rule)" }}>
            <span className="micro" style={{ alignSelf:"center", marginRight:6 }}>REGION</span>
            <button className={`chip ${region==="all"?"is-active":""}`} onClick={()=>setRegion("all")}>All</button>
            {REGIONS.map(r => (
              <span key={r.id} className="tt-wrap">
                <button className={`chip ${region===r.id?"is-active":""}`} onClick={()=>setRegion(r.id)}>{r.short||r.id.slice(0,3).toUpperCase()}</button>
                <span className="tt">{r.label}</span>
              </span>
            ))}
          </div>

          {/* Type + EL filter */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, padding:"14px 0 0", alignItems:"center" }}>
            <span className="micro" style={{ marginRight:6 }}>TYPE</span>
            <button className={`chip is-accent ${cat==="all"?"is-active":""}`} onClick={()=>setCat("all")}>All</button>
            {Object.entries(CATS).filter(([k])=>!["none","unknown"].includes(k)).map(([k, m]) => (
              <button key={k} className={`chip is-accent ${cat===k?"is-active":""}`} onClick={()=>setCat(k)}>
                <span style={{ color:cat===k?"inherit":m.color }}>{m.glyph}</span>
                {m.label}
              </button>
            ))}
            <span style={{ width:1, height:22, background:"var(--rule)", margin:"0 8px" }}/>
            <span className="micro" style={{ marginRight:6 }}>EL ≥</span>
            {[0,1,2,3,4].map(v => (
              <button key={v} className={`chip is-accent ${elMin===v?"is-active":""}`} onClick={()=>setElMin(v)}>{v===0?"Any":v}</button>
            ))}
          </div>
        </section>

        {/* ─── LEDGER ─────────────────────── */}
        <section className="container-wide" style={{ maxWidth:920, paddingTop:32, paddingBottom:80 }}>
          {filtered.length === 0 ? (
            <div style={{ padding:"80px 0", textAlign:"center" }}>
              <div className="display-serif" style={{ fontSize:80, color:"var(--ink-15)", marginBottom:14 }}>—</div>
              <div className="body" style={{ marginBottom:16 }}>No incidents match these filters.</div>
              <button className="btn-ghost" onClick={()=>{ setRegion("all"); setCat("all"); setSearch(""); setElMin(0); }}>Clear filters</button>
            </div>
          ) : (
            groups.map(([date, items], gi) => (
              <DateGroup key={date} date={date} items={items} groupIdx={gi} />
            ))
          )}
        </section>
      </div>
    </Layout>
  );
}

function DateGroup({ date, items, groupIdx }) {
  const d = new Date(date + "T00:00:00");
  const dayLabel = d.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" }).toUpperCase();
  const isoShort = `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`;

  return (
    <div style={{ marginBottom:40 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:18, marginBottom:20 }}>
        <div>
          <span className="mono" style={{ fontSize:32, fontWeight:500, color:"var(--ink)", letterSpacing:"-0.02em", lineHeight:1 }}>{isoShort}</span>
          <div className="micro" style={{ color:"var(--accent)", marginTop:4 }}>{dayLabel}</div>
        </div>
        <div style={{ flex:1, height:1, background:"var(--ink)", alignSelf:"center" }}/>
        <span className="mono small" style={{ color:"var(--ink-40)" }}>{items.length} entr{items.length===1?"y":"ies"}</span>
      </div>
      {items.map(inc => <RowIncident key={inc.id||inc.title} inc={inc} />)}
    </div>
  );
}

function RowIncident({ inc }) {
  const catKey = inc.category || inc.cat || "unknown";
  const cat = CATS[catKey] || CATS.unknown;
  const el = inc.escalation_level || 1;
  const timeStr = inc.date ? new Date(inc.date).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"UTC"}) : "";

  return (
    <article style={{
      display:"grid",
      gridTemplateColumns:"64px 110px 1fr 90px",
      gap:16, padding:"14px 0",
      borderBottom:"1px solid var(--rule)",
      alignItems:"start",
    }}>
      <span className="mono small" style={{ color:"var(--ink-40)", paddingTop:2 }}>{timeStr}</span>
      <span style={{ display:"flex", alignItems:"center", gap:6, paddingTop:2 }}>
        <span style={{ width:6, height:6, borderRadius:"50%", background:cat.color, flexShrink:0 }}/>
        <span className="micro" style={{ color:cat.color, fontSize:9 }}>{cat.label}</span>
      </span>
      <div>
        <div style={{ fontSize:14, fontWeight:600, color:"var(--ink)", lineHeight:1.35, marginBottom:4 }}>{inc.title}</div>
        {inc.description && inc.description !== inc.title && (
          <div style={{ fontSize:12, color:"var(--ink-55)", lineHeight:1.5 }}>{inc.description}</div>
        )}
      </div>
      <div style={{ textAlign:"right", paddingTop:2 }}>
        <div className="mono" style={{ fontSize:11, color: el>=3?"var(--hi)":"var(--ink-40)" }}>EL{el}</div>
        {inc.source_name && <div style={{ fontSize:10, color:"var(--ink-40)", marginTop:2 }}>{inc.source_name}</div>}
      </div>
    </article>
  );
}
