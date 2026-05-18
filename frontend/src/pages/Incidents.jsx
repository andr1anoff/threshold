import { useState, useEffect, useMemo } from "react";
import Layout from "../components/Layout";
import { REGIONS } from "../data/seed";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";
const PAGE_SIZE = 40;

const CAT_META = {
  cyber:      { label:"Cyber",        color:"#8B2030" },
  airspace:   { label:"Airspace",     color:"#C0622B" },
  maritime:   { label:"Maritime",     color:"#185FA5" },
  disinfo:    { label:"Disinfo",      color:"#7C3AED" },
  proxy:      { label:"Proxy",        color:"#B07D1A" },
  economic:   { label:"Economic",     color:"#2D7A4F" },
  military:   { label:"Military",     color:"#8B2030" },
  diplomatic: { label:"Diplomatic",   color:"#185FA5" },
  civilian:   { label:"Civilian",     color:"#B07D1A" },
  none:       { label:"Unclassified", color:"rgba(26,16,8,0.35)" },
  unknown:    { label:"Pending",      color:"#B07D1A" },
};

const SOURCE_CONF = {
  "UN News":"Institutional", "OCHA":"Institutional", "ReliefWeb":"Institutional",
  "UCDP":"Academic", "Bellingcat":"OSINT", "DeepState":"OSINT", "CIT":"OSINT",
  "Wikipedia":"Discovery", "Guardian":"Media", "Middle East Eye":"Media",
  "Kyiv Independent":"Media", "SIPRI":"Academic", "Atlantic Council":"Analytical",
  "Carnegie":"Analytical", "CSIS":"Analytical", "Crisis Group":"Analytical",
};
const CONF_COLOR = { Institutional:"#2D7A4F", Academic:"#185FA5", OSINT:"#B07D1A", Media:"rgba(26,16,8,0.4)", Discovery:"rgba(26,16,8,0.3)", Analytical:"#185FA5" };

function getConf(source) {
  for (const [k,v] of Object.entries(SOURCE_CONF)) {
    if ((source||"").includes(k)) return v;
  }
  return "Media";
}

function groupByDate(incidents) {
  const groups = {};
  incidents.forEach(inc => {
    const d = inc.date?.slice(0,10) || "Unknown";
    if (!groups[d]) groups[d] = [];
    groups[d].push(inc);
  });
  return Object.entries(groups).sort(([a],[b]) => b.localeCompare(a));
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [region, setRegion]       = useState("all");
  const [category, setCategory]   = useState("all");
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [elMin, setElMin]          = useState(0);

  useEffect(() => {
    setLoading(true);
    const url = region==="all" ? `${API}/api/incidents/` : `${API}/api/incidents/?region=${encodeURIComponent(region)}`;
    fetch(url)
      .then(r=>r.json())
      .then(d => {
        if (d.data?.length) {
          setIncidents(d.data);
          // Find most recent date
          const dates = d.data.map(i=>i.date).filter(Boolean).sort().reverse();
          if (dates[0]) setLastUpdated(dates[0].slice(0,10));
        }
      })
      .catch(()=>{})
      .finally(()=>setLoading(false));
    setPage(1);
  }, [region]);

  useEffect(() => { setPage(1); }, [category, search, elMin, region]);

  const filtered = useMemo(() => incidents.filter(inc => {
    if (category!=="all" && inc.category!==category) return false;
    if (search && !inc.title?.toLowerCase().includes(search.toLowerCase()) && !inc.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (elMin > 0 && (parseInt(inc.escalation_level) || 1) < elMin) return false;
    return true;
  }), [incidents, category, search]);

  const grouped    = useMemo(() => groupByDate(filtered), [filtered]);
  const allItems   = useMemo(() => grouped.flatMap(([d,items]) => items.map(i=>({...i,_date:d}))), [grouped]);
  const paged      = useMemo(() => groupByDate(allItems.slice(0, page*PAGE_SIZE)), [allItems, page]);
  const hasMore    = allItems.length > page*PAGE_SIZE;

  return (
    <Layout>
      <div style={{ padding:"24px 16px 56px", maxWidth:880, margin:"0 auto", width:"100%" }}>
        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"2px", color:"var(--crimson)", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ display:"inline-block", width:18, height:1.5, background:"var(--crimson)" }} aria-hidden="true"/>
            INCIDENTS
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
            <div>
              <h1 style={{ fontSize:30, fontWeight:800, letterSpacing:"-0.5px", marginBottom:6 }}>Event Timeline</h1>
              <p style={{ fontSize:14, color:"var(--ink-muted)", lineHeight:1.5 }}>
                Gray zone incidents across monitored regions · Classified by LLM, verified by source cross-check.
              </p>
            </div>
            {lastUpdated && (
              <div style={{ fontSize:11, color:"var(--ink-muted)", textAlign:"right", flexShrink:0 }}>
                <span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%", background:"#2D7A4F", marginRight:5, verticalAlign:"middle" }} aria-hidden="true"/>
                Last updated: {new Date(lastUpdated+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom:14 }}>
          <label htmlFor="incident-search" style={{ position:"absolute", left:-9999 }}>Search incidents</label>
          <input id="incident-search"
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search incidents…"
            aria-label="Search incidents"
            style={{ width:"100%", padding:"9px 14px", border:"1px solid rgba(26,16,8,0.15)", borderRadius:8, fontSize:13, background:"#fff", color:"var(--ink)", outline:"none", fontFamily:"var(--font)" }}
          />
        </div>

        {/* Region filter */}
        <div role="group" aria-label="Filter by region" style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
          {["all", ...REGIONS.map(r=>r.id)].map(r=>(
            <button key={r} onClick={()=>setRegion(r)} aria-pressed={region===r} style={{ fontSize:11, fontWeight:region===r?600:400, padding:"3px 11px", borderRadius:999, border:"1px solid", borderColor:region===r?"var(--ink)":"rgba(26,16,8,0.15)", background:region===r?"var(--ink)":"transparent", color:region===r?"var(--cream)":"var(--ink-muted)", cursor:"pointer" }}>
              {r==="all"?"All regions":r}
            </button>
          ))}
        </div>

        {/* Escalation level filter */}
        <div role="group" aria-label="Filter by escalation level" style={{ display:"flex", gap:6, alignItems:"center", marginBottom:12 }}>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:"1.5px", color:"var(--ink-muted)" }}>EL</span>
          {[[0,"All"],[1,"1+"],[2,"2+"],[3,"3+"],[4,"4+"]].map(([v,l]) => (
            <button key={v} onClick={()=>setElMin(v)} aria-pressed={elMin===v} style={{ fontSize:10, padding:"3px 9px", borderRadius:999, border:"1px solid", borderColor:elMin===v?"var(--crimson)":"rgba(26,16,8,0.12)", background:elMin===v?"rgba(107,26,42,0.08)":"transparent", color:elMin===v?"var(--crimson)":"var(--ink-muted)", cursor:"pointer", fontWeight:elMin===v?700:400 }}>{l}</button>
          ))}
        </div>

        {/* Category filter */}
        <div role="group" aria-label="Filter by category" style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:24 }}>
          {["all",...Object.keys(CAT_META)].map(c=>{
            const meta=CAT_META[c];
            const active=category===c;
            return (
              <button key={c} onClick={()=>setCategory(c)} aria-pressed={active} style={{ fontSize:10, fontWeight:active?700:400, padding:"3px 10px", borderRadius:999, border:"1px solid", borderColor:active?(meta?.color||"var(--ink)"):"rgba(26,16,8,0.12)", background:active?`${meta?.color||"#1a1008"}12`:"transparent", color:active?(meta?.color||"var(--ink)"):"var(--ink-muted)", cursor:"pointer", letterSpacing:"0.5px" }}>
                {c==="all"?"All types":(meta?.label||c)}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ fontSize:13, color:"var(--ink-muted)", padding:40 }} aria-live="polite">Loading incidents…</div>
        ) : filtered.length===0 ? (
          <div style={{ padding:"48px 0", textAlign:"center" }} role="status">
            <div style={{ fontSize:14, color:"var(--ink-muted)", marginBottom:8 }}>No incidents match the current filters.</div>
            <button onClick={()=>{setRegion("all");setCategory("all");setSearch("");}} style={{ fontSize:12, color:"var(--crimson)", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div>
            {paged.map(([date,items])=>(
              <div key={date} style={{ marginBottom:28 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--crimson)", flexShrink:0 }} aria-hidden="true"/>
                  <span style={{ fontSize:11, fontWeight:700, letterSpacing:"1.5px", color:"var(--ink-muted)" }}>
                    <time dateTime={date}>{new Date(date+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</time>
                  </span>
                  <div style={{ flex:1, height:1, background:"rgba(26,16,8,0.07)" }} aria-hidden="true"/>
                  <span style={{ fontSize:10, color:"rgba(26,16,8,0.3)" }}>{items.length} event{items.length>1?"s":""}</span>
                </div>
                <div style={{ paddingLeft:18, borderLeft:"1px solid rgba(26,16,8,0.08)" }}>
                  {items.map((inc,i)=>{
                    const cat=CAT_META[inc.category]||CAT_META.unknown;
                    const conf=getConf(inc.source_name);
                    const confColor=CONF_COLOR[conf]||CONF_COLOR.Media;
                    return (
                      <article key={inc.id||i} style={{ padding:"12px 14px", marginBottom:8, background:"#fff", border:"1px solid rgba(26,16,8,0.07)", borderRadius:10 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                          <span style={{ fontSize:9, fontWeight:700, letterSpacing:"1px", padding:"2px 8px", borderRadius:999, background:`${cat.color}12`, color:cat.color, border:`1px solid ${cat.color}25` }}>
                            {cat.label.toUpperCase()}
                          </span>
                          <span style={{ fontSize:11, color:"rgba(26,16,8,0.4)" }}>{inc.region}</span>
                          {inc.escalation_level>2 && (
                            <span style={{ fontSize:9, padding:"1px 6px", borderRadius:999, background:"rgba(139,32,48,0.08)", color:"#8B2030", border:"1px solid rgba(139,32,48,0.15)", fontWeight:600 }}>
                              EL{inc.escalation_level}
                            </span>
                          )}
                          {inc.source_name && (
                            <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4 }}>
                              <span style={{ fontSize:8, padding:"1px 5px", borderRadius:3, background:`${confColor}12`, color:confColor, border:`1px solid ${confColor}22`, fontWeight:600 }}>
                                {conf}
                              </span>
                              {inc.source_url ? (
                                <a href={inc.source_url} target="_blank" rel="noopener noreferrer" style={{ color:"var(--crimson)", opacity:0.75, fontSize:11 }}>
                                  {inc.source_name.split(" ")[0]} ↗
                                </a>
                              ) : (
                                <span style={{ color:"rgba(26,16,8,0.35)", fontSize:11 }}>{inc.source_name.split(" ")[0]}</span>
                              )}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize:13, fontWeight:500, color:"var(--ink)", lineHeight:1.45, marginBottom:inc.description?5:0 }}>{inc.title}</div>
                        {inc.description && inc.description!==inc.title && (
                          <div style={{ fontSize:11, color:"var(--ink-muted)", lineHeight:1.55 }}>{inc.description}</div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}

            <div style={{ textAlign:"center", padding:"8px 0 16px" }}>
              <p style={{ fontSize:11, color:"rgba(26,16,8,0.3)", marginBottom:12 }}>
                Showing {Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length} incidents · 60-day window
              </p>
              {hasMore && (
                <button onClick={()=>setPage(p=>p+1)} style={{ fontSize:12, color:"var(--crimson)", background:"none", border:"1px solid rgba(107,26,42,0.2)", borderRadius:6, padding:"8px 20px", cursor:"pointer", fontWeight:500 }}>
                  Load older incidents →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
