import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import { REGIONS } from "../data/seed";
import { api } from "../api/client";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

const EI_COLOR = s => s==null?"#94a3b8":s>=65?"#8B2030":s>=45?"#C0622B":s>=25?"#B07D1A":"#2D7A4F";
const EI_LABEL = s => s==null?"NO DATA":s>=65?"HIGH":s>=45?"MODERATE":s>=25?"ELEVATED":"LOW";

const CAT_META = {
  cyber:      { label:"Cyber",       color:"#8B2030" },
  airspace:   { label:"Airspace",    color:"#C0622B" },
  maritime:   { label:"Maritime",    color:"#185FA5" },
  disinfo:    { label:"Disinfo",     color:"#7C3AED" },
  military:   { label:"Military",    color:"#8B2030" },
  diplomatic: { label:"Diplomatic",  color:"#185FA5" },
  civilian:   { label:"Civilian",    color:"#B07D1A" },
  economic:   { label:"Economic",    color:"#2D7A4F" },
  proxy:      { label:"Proxy",       color:"#B07D1A" },
  none:       { label:"Unclassified",color:"rgba(26,16,8,0.4)" },
  unknown:    { label:"Pending",     color:"rgba(26,16,8,0.4)" },
};

export default function RegionPage() {
  const { id } = useParams();
  const region = REGIONS.find(r => r.id === decodeURIComponent(id));

  const [incidents, setIncidents] = useState([]);
  const [ei, setEi]               = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!id) return;
    const regionId = decodeURIComponent(id);

    Promise.all([
      fetch(`${API}/api/incidents/?region=${encodeURIComponent(regionId)}`).then(r=>r.json()).catch(()=>({data:[]})),
      fetch(`${API}/api/di/region/${encodeURIComponent(regionId)}`).then(r=>r.json()).catch(()=>({})),
    ]).then(([inc, eiData]) => {
      setIncidents(inc.data || []);
      setEi(eiData.ei_score ?? eiData.di_score ?? null);
    }).finally(() => setLoading(false));
  }, [id]);

  const color = EI_COLOR(ei ?? region?.ei);
  const label = EI_LABEL(ei ?? region?.ei);
  const score = ei ?? region?.ei;

  if (!region) return (
    <Layout>
      <div style={{ padding:"48px 28px", textAlign:"center" }}>
        <div style={{ fontSize:14, color:"var(--ink-muted)", marginBottom:16 }}>Region not found.</div>
        <Link to="/" style={{ fontSize:13, color:"var(--crimson)", fontWeight:600 }}>← Back to Overview</Link>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div style={{ maxWidth:800, margin:"0 auto", padding:"32px 20px 64px", width:"100%" }}>

        {/* Breadcrumb */}
        <div style={{ fontSize:12, color:"var(--ink-muted)", marginBottom:20 }}>
          <Link to="/" style={{ color:"var(--ink-muted)", textDecoration:"none" }}>Overview</Link>
          <span style={{ margin:"0 8px" }}>→</span>
          <span style={{ color:"var(--ink)", fontWeight:500 }}>{region.label}</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"2px", color:"var(--crimson)", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ display:"inline-block", width:18, height:1.5, background:"var(--crimson)" }}/>
            {region.category === "conflict" ? "ACTIVE CONFLICT" : "STRATEGIC TENSION"}
          </div>
          <h1 style={{ fontSize:32, fontWeight:800, letterSpacing:"-0.5px", marginBottom:8 }}>{region.label}</h1>
        </div>

        {/* EI card */}
        <div style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.08)", borderRadius:14, padding:"20px 24px", marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:10, letterSpacing:"1.5px", color:"rgba(26,16,8,0.4)", marginBottom:6 }}>ESCALATION INDEX</div>
              <div style={{ fontSize:56, fontWeight:800, color, lineHeight:1, fontVariantNumeric:"tabular-nums" }}>
                {loading ? "…" : (score ?? "—")}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <span style={{ fontSize:11, fontWeight:700, padding:"4px 12px", borderRadius:999, background:`${color}12`, color, border:`1px solid ${color}25` }}>
                {loading ? "…" : label}
              </span>
              <div style={{ fontSize:11, color:"var(--ink-muted)", marginTop:8 }}>30-day window · Heuristic indicator</div>
            </div>
          </div>
          <div style={{ height:3, background:"rgba(26,16,8,0.06)", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${score||0}%`, background:color, opacity:0.6, borderRadius:2 }}/>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10, marginBottom:24 }}>
          {[
            ["Total incidents", loading ? "…" : incidents.length, "var(--ink)"],
            ["Last 7 days", loading ? "…" : incidents.filter(i => i.date >= new Date(Date.now()-7*86400000).toISOString().slice(0,10)).length, "#8B2030"],
            ["Avg severity", loading || !incidents.length ? "…" : (incidents.reduce((s,i)=>s+(i.escalation_level||1),0)/incidents.length).toFixed(1), "#C0622B"],
          ].map(([l,v,c])=>(
            <div key={l} style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.08)", borderRadius:10, padding:"14px 16px" }}>
              <div style={{ fontSize:22, fontWeight:800, color:c, fontVariantNumeric:"tabular-nums" }}>{v}</div>
              <div style={{ fontSize:10, color:"var(--ink-muted)", letterSpacing:"1px", marginTop:4 }}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Recent incidents */}
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"2px", color:"var(--crimson)", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ display:"inline-block", width:18, height:1.5, background:"var(--crimson)" }}/>
            RECENT INCIDENTS
          </div>

          {loading ? (
            <div style={{ fontSize:13, color:"var(--ink-muted)" }}>Loading…</div>
          ) : incidents.length === 0 ? (
            <div style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.08)", borderRadius:12, padding:"28px 20px", textAlign:"center" }}>
              <div style={{ fontSize:13, color:"var(--ink-muted)" }}>No incidents indexed for this region yet.</div>
              <div style={{ fontSize:12, color:"rgba(26,16,8,0.3)", marginTop:6 }}>Run the scraper pipeline to populate data.</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {incidents.slice(0,20).map((inc,i) => {
                const cat = CAT_META[inc.category] || CAT_META.unknown;
                return (
                  <article key={inc.id||i} style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.07)", borderRadius:10, padding:"12px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:9, fontWeight:700, letterSpacing:"1px", padding:"2px 8px", borderRadius:999, background:`${cat.color}12`, color:cat.color, border:`1px solid ${cat.color}25` }}>
                        {cat.label.toUpperCase()}
                      </span>
                      <span style={{ fontSize:10, color:"rgba(26,16,8,0.4)", fontVariantNumeric:"tabular-nums" }}>{inc.date?.slice(0,10)}</span>
                      {inc.escalation_level > 2 && (
                        <span style={{ fontSize:9, padding:"1px 6px", borderRadius:999, background:"rgba(139,32,48,0.08)", color:"#8B2030", border:"1px solid rgba(139,32,48,0.15)", fontWeight:600 }}>
                          EL{inc.escalation_level}
                        </span>
                      )}
                      {inc.source_url && (
                        <a href={inc.source_url} target="_blank" rel="noopener noreferrer"
                          style={{ marginLeft:"auto", fontSize:11, color:"var(--crimson)", opacity:0.75 }}>
                          {inc.source_name?.split(" ")[0]} ↗
                        </a>
                      )}
                    </div>
                    <div style={{ fontSize:13, fontWeight:500, color:"var(--ink)", lineHeight:1.45 }}>{inc.title}</div>
                    {inc.description && inc.description !== inc.title && (
                      <div style={{ fontSize:11, color:"var(--ink-muted)", marginTop:4, lineHeight:1.5 }}>{inc.description}</div>
                    )}
                  </article>
                );
              })}
              {incidents.length > 20 && (
                <div style={{ textAlign:"center", padding:"8px 0" }}>
                  <Link to={`/incidents`} style={{ fontSize:12, color:"var(--crimson)", fontWeight:500 }}>
                    View all {incidents.length} incidents →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:10, marginTop:28, flexWrap:"wrap" }}>
          <Link to="/incidents" style={{ fontSize:13, color:"var(--ink)", background:"#fff", border:"1px solid rgba(26,16,8,0.15)", borderRadius:8, padding:"10px 18px", fontWeight:500, textDecoration:"none" }}>
            All incidents
          </Link>
          <Link to="/briefs" style={{ fontSize:13, color:"#fff", background:"var(--crimson)", border:"none", borderRadius:8, padding:"10px 18px", fontWeight:600, textDecoration:"none" }}>
            Generate brief →
          </Link>
          <Link to="/" style={{ fontSize:13, color:"var(--ink-muted)", background:"none", border:"1px solid transparent", borderRadius:8, padding:"10px 18px", fontWeight:400, textDecoration:"none" }}>
            ← Overview
          </Link>
        </div>

        {/* Trust note */}
        <p style={{ marginTop:32, fontSize:11, color:"rgba(26,16,8,0.28)", lineHeight:1.6 }}>
          Escalation Index is a heuristic research indicator based on open-source data. Not a predictive model. Not an official intelligence assessment.
        </p>

      </div>
    </Layout>
  );
}
