import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { REGIONS, CATS, getConf, EI_COLOR } from "../data/seed";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

export default function IncidentsPage() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [lastSync, setLastSync]   = useState(null);
  const [region, setRegion]       = useState("all");
  const [cat, setCat]             = useState("all");
  const [search, setSearch]       = useState("");
  const [elMin, setElMin]         = useState(0);

  useEffect(() => {
    setLoading(true);
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [region]);

  const filtered = useMemo(() => incidents.filter(inc => {
    if (cat !== "all" && (inc.category || inc.cat) !== cat) return false;
    if (elMin > 0 && (inc.escalation_level || 1) < elMin) return false;
    if (search && !inc.title?.toLowerCase().includes(search.toLowerCase()) && !inc.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [incidents, cat, search, elMin]);

  const groups = useMemo(() => {
    const g = {};
    filtered.forEach(i => { const d = i.date?.slice(0,10)||"Unknown"; (g[d]||=[]).push(i); });
    return Object.entries(g).sort(([a],[b]) => b.localeCompare(a));
  }, [filtered]);

  const byCat = useMemo(() => {
    const c = {};
    filtered.forEach(i => { const k = i.category||i.cat||"unknown"; c[k]=(c[k]||0)+1; });
    return Object.entries(c).sort((a,b)=>b[1]-a[1]);
  }, [filtered]);

  const byRegion = useMemo(() => {
    const c = {};
    filtered.forEach(i => { if (i.region) c[i.region]=(c[i.region]||0)+1; });
    return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,6);
  }, [filtered]);

  const maxReg = Math.max(...byRegion.map(([,n])=>n), 1);

  const highEl    = filtered.filter(i => (i.escalation_level||1) >= 3).length;
  const cyberN    = filtered.filter(i => (i.category||i.cat) === "cyber").length;
  const militaryN = filtered.filter(i => (i.category||i.cat) === "military").length;
  const dipN      = filtered.filter(i => (i.category||i.cat) === "diplomatic").length;

  const regionLabels = [...new Set(incidents.map(i => i.region).filter(Boolean))].sort();

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
                  <span className="pulse" style={{ background:loading?"var(--mid)":"var(--lo)" }}/>
                  <span className="micro" style={{ color:"var(--ink-55)" }}>
                    {loading ? "SYNCING…" : lastSync ? `LAST DATA · ${lastSync}` : "LIVE"}
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
          <div style={{ borderTop:"1px solid var(--ink)", borderBottom:"1px solid var(--rule)", padding:"16px 0", display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:32 }} className="stack-mobile-x">
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
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
            <div style={{ display:"flex", justifyContent:"flex-end", gap:28, alignItems:"center" }}>
              <Mini label="High EL"   n={highEl} />
              <Mini label="Cyber"     n={cyberN} />
              <Mini label="Military"  n={militaryN} />
              <Mini label="Diplomatic" n={dipN} />
            </div>
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

        {/* ─── MAIN GRID ─────────────────────── */}
        <section className="container-wide" style={{ paddingTop:32, paddingBottom:80 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:56, alignItems:"flex-start" }} className="stack-mobile">

            {/* LEDGER */}
            <div>
              {loading ? (
                <div style={{ borderTop:"1px solid var(--ink)", padding:"80px 0", textAlign:"center" }}>
                  <div className="mono small" style={{ color:"var(--ink-40)" }}>Loading incident corpus…</div>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding:"80px 0", textAlign:"center" }}>
                  <div className="display-serif" style={{ fontSize:80, color:"var(--ink-15)", marginBottom:14 }}>—</div>
                  <div className="body" style={{ marginBottom:16 }}>No incidents match these filters.</div>
                  <button className="btn-ghost" onClick={()=>{ setRegion("all"); setCat("all"); setSearch(""); setElMin(0); }}>Clear filters</button>
                </div>
              ) : (
                groups.map(([date, items], gi) => (
                  <DateGroup key={date} date={date} items={items} groupIdx={gi} navigate={navigate} />
                ))
              )}
            </div>

            {/* SIDEBAR ANALYTICS */}
            <aside style={{ position:"sticky", top:110 }} className="hide-mobile">
              <div className="micro micro-strong" style={{ paddingBottom:12, borderBottom:"1px solid var(--ink)", marginBottom:16 }}>
                § ANALYTICS · CURRENT VIEW
              </div>

              {byCat.length > 0 && (
                <div style={{ marginBottom:32 }}>
                  <div className="micro" style={{ marginBottom:12 }}>BY CATEGORY</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {byCat.map(([k, n]) => {
                      const meta = CATS[k] || CATS.unknown;
                      const pct = Math.round((n / filtered.length) * 100);
                      return (
                        <div key={k} style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ color:meta.color, fontSize:13, width:14 }}>{meta.glyph}</span>
                          <span style={{ fontSize:13, color:"var(--ink-70)", minWidth:80 }}>{meta.label}</span>
                          <div style={{ flex:1, height:4, background:"var(--ink-06)" }}>
                            <div style={{ height:"100%", width:`${pct}%`, background:meta.color, opacity:0.6 }}/>
                          </div>
                          <span className="mono small tab-num" style={{ color:"var(--ink-55)", minWidth:24, textAlign:"right" }}>{n}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {byRegion.length > 0 && (
                <div style={{ marginBottom:32 }}>
                  <div className="micro" style={{ marginBottom:12 }}>TOP REGIONS</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {byRegion.map(([r, n]) => (
                      <div key={r} style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:13, color:"var(--ink-70)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r}</span>
                        <div style={{ width:80, height:4, background:"var(--ink-06)" }}>
                          <div style={{ height:"100%", width:`${(n/maxReg)*100}%`, background:"var(--ink)", opacity:0.6 }}/>
                        </div>
                        <span className="mono small tab-num" style={{ color:"var(--ink-55)", minWidth:24, textAlign:"right" }}>{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="micro" style={{ marginBottom:12 }}>SOURCE CONFIDENCE</div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <ConfBar label="Institutional" color="var(--lo)"   pct={32} />
                  <ConfBar label="Academic"      color="var(--info)" pct={18} />
                  <ConfBar label="OSINT"         color="var(--mid)"  pct={26} />
                  <ConfBar label="Analytical"    color="var(--info)" pct={14} />
                  <ConfBar label="Media"         color="var(--ink-40)" pct={10} />
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </Layout>
  );
}

function Mini({ label, n }) {
  return (
    <div style={{ textAlign:"right" }}>
      <div className="tab-num" style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.02em", lineHeight:1 }}>{n}</div>
      <div className="micro" style={{ marginTop:4, color:"var(--ink-40)" }}>{label}</div>
    </div>
  );
}

function ConfBar({ label, color, pct }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:12, color:"var(--ink-55)" }}>
      <span style={{ width:8, height:8, background:color, borderRadius:0, flexShrink:0 }}/>
      <span style={{ flex:1 }}>{label}</span>
      <span className="mono tab-num" style={{ color:"var(--ink-40)" }}>{pct}%</span>
    </div>
  );
}

function DateGroup({ date, items, groupIdx, navigate }) {
  const d = new Date(date + "T00:00:00");
  const dayLabel = d.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" }).toUpperCase();
  const isoShort = `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`;

  const lead = [...items].sort((a,b)=>(b.escalation_level||0)-(a.escalation_level||0))[0];
  const rest = items.filter(i => i.id !== lead.id);

  return (
    <div style={{ marginBottom:48 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:18, marginBottom:24 }}>
        <div>
          <span className="mono" style={{ fontSize:36, fontWeight:500, color:"var(--ink)", letterSpacing:"-0.02em", lineHeight:1 }}>{isoShort}</span>
          <div className="micro" style={{ color:"var(--accent)", marginTop:4 }}>{dayLabel}</div>
        </div>
        <div style={{ flex:1, height:1, background:"var(--ink)", alignSelf:"center" }}/>
        <span className="mono small" style={{ color:"var(--ink-40)" }}>{items.length} entr{items.length===1?"y":"ies"}</span>
      </div>

      <LeadIncident inc={lead} navigate={navigate} />
      {rest.length > 0 && (
        <div style={{ marginTop:16 }}>
          {rest.map(inc => <RowIncident key={inc.id||inc.title} inc={inc} navigate={navigate} />)}
        </div>
      )}
    </div>
  );
}

function LeadIncident({ inc, navigate }) {
  const catKey = inc.category || inc.cat || "unknown";
  const cat = CATS[catKey] || CATS.unknown;
  const el = inc.escalation_level || 1;
  const conf = getConf(inc.source_name || inc.src || "");
  const regionObj = REGIONS.find(r => r.label === inc.region || r.id === inc.region);

  return (
    <article style={{
      borderTop:"1px solid var(--ink)",
      paddingTop:18, paddingBottom:22,
      borderBottom:"1px solid var(--rule)",
      display:"grid",
      gridTemplateColumns:"120px 1fr 200px",
      gap:32,
    }}>
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <span style={{ fontSize:22, color:cat.color, lineHeight:1 }}>{cat.glyph}</span>
        </div>
        <div className="micro" style={{ color:cat.color, marginBottom:8 }}>{cat.label}</div>
        {el >= 3 && (
          <div style={{ display:"inline-block", padding:"3px 8px", background:"var(--hi)", color:"var(--cream)", fontFamily:"var(--mono)", fontSize:10, fontWeight:600, letterSpacing:"0.1em", marginBottom:8 }}>
            EL — {el}
          </div>
        )}
        <div className="mono small" style={{ color:"var(--ink-40)" }}>{inc.date?.slice(0,10)||""}</div>
      </div>

      <div>
        <h3 style={{ fontSize:24, fontWeight:600, lineHeight:1.2, letterSpacing:"-0.015em", marginBottom:10, color:"var(--ink)" }}>
          {inc.title}
        </h3>
        {inc.description && inc.description !== inc.title && (
          <p className="body" style={{ marginBottom:16, maxWidth:640 }}>
            {inc.description}
          </p>
        )}
        <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
          {regionObj && (
            <button
              onClick={() => navigate(`/region/${encodeURIComponent(regionObj.id)}`)}
              className="micro micro-accent"
              style={{ borderBottom:"1px solid var(--accent)", paddingBottom:2 }}
            >
              {inc.region} ↗
            </button>
          )}
          {(inc.source_url || inc.url) && (
            <a href={inc.source_url||inc.url} target="_blank" rel="noopener noreferrer" className="mono small" style={{ color:"var(--ink-55)", textDecoration:"underline", textUnderlineOffset:4 }}>
              {inc.source_name||inc.src||"Source"} ↗
            </a>
          )}
        </div>
      </div>

      <div style={{ borderLeft:"1px solid var(--rule)", paddingLeft:20, fontSize:12, color:"var(--ink-55)", lineHeight:1.9 }} className="hide-mobile">
        <MetaRow k="DATE"    v={inc.date?.slice(0,10)||"—"} />
        <MetaRow k="THEATRE" v={(inc.region||"—").slice(0,18)} />
        <MetaRow k="SOURCE"  v={inc.source_name||inc.src||"—"} />
        <MetaRow k="CONF."   v={conf} />
        <MetaRow k="EL"      v={el} />
      </div>
    </article>
  );
}

function MetaRow({ k, v }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", gap:12 }}>
      <span className="micro" style={{ color:"var(--ink-40)", fontSize:9 }}>{k}</span>
      <span className="mono" style={{ fontSize:11, color:"var(--ink)" }}>{v}</span>
    </div>
  );
}

function RowIncident({ inc, navigate }) {
  const catKey = inc.category || inc.cat || "unknown";
  const cat = CATS[catKey] || CATS.unknown;
  const el = inc.escalation_level || 1;
  const regionObj = REGIONS.find(r => r.label === inc.region || r.id === inc.region);

  return (
    <article
      onClick={() => regionObj && navigate(`/region/${encodeURIComponent(regionObj.id)}`)}
      style={{
        display:"grid",
        gridTemplateColumns:"90px 80px 1fr 130px 60px",
        gap:20, padding:"14px 0",
        borderBottom:"1px solid var(--rule)",
        alignItems:"center",
        cursor: regionObj ? "pointer" : "default",
        transition:"background 0.12s",
      }}
      onMouseEnter={e => e.currentTarget.style.background="var(--paper)"}
      onMouseLeave={e => e.currentTarget.style.background="transparent"}
    >
      <span className="mono small" style={{ color:"var(--ink-40)" }}>{inc.date?.slice(0,10)||""}</span>
      <span style={{ display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ color:cat.color, fontSize:12 }}>{cat.glyph}</span>
        <span className="micro" style={{ color:cat.color, fontSize:9 }}>{cat.label.slice(0,5)}</span>
      </span>
      <span style={{ fontSize:14, color:"var(--ink)", lineHeight:1.4 }}>{inc.title}</span>
      <span className="mono small" style={{ color:"var(--ink-55)" }}>{(inc.region||"").slice(0,20)}</span>
      <span className="mono small" style={{ color:"var(--ink-40)", textAlign:"right" }}>
        {el >= 3 ? <span style={{ color:"var(--hi)" }}>EL{el}</span> : `EL${el}`}
      </span>
    </article>
  );
}
