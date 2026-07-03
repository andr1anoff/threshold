import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Layout from "../components/Layout";
import Sparkline from "../components/Sparkline";
import AnimatedNumber from "../components/AnimatedNumber";
import { REGIONS, CATS, EI_COLOR, EI_LABEL, getConf, RECALIBRATING } from "../data/seed";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

export default function RegionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const region = REGIONS.find(r => r.id === decodeURIComponent(id));

  const [incidents, setIncidents] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [ei, setEi]               = useState(null);
  const [comp, setComp]           = useState(null);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("incidents");

  useEffect(() => {
    if (!id) return;
    const rid = decodeURIComponent(id);
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/incidents/?region=${encodeURIComponent(rid)}`).then(r=>r.json()).catch(()=>({data:[]})),
      fetch(`${API}/api/di/region/${encodeURIComponent(rid)}`).then(r=>r.json()).catch(()=>({})),
      fetch(`${API}/api/exercises/`).then(r=>r.json()).catch(()=>({data:[]})),
      fetch(`${API}/api/di/history/${encodeURIComponent(rid)}`).then(r=>r.json()).catch(()=>({data:[]})),
    ]).then(([inc, eiData, exData, hist]) => {
      setIncidents(inc.data || []);
      setEi(eiData.ei_score ?? eiData.di_score ?? null);
      setComp({
        gz:   Math.round(eiData.gz_score ?? 0),
        ex:   Math.round(eiData.ex_score ?? 0),
        base: Math.round(eiData.base_score ?? 0),
      });
      setHistory((hist.data || []).map(h => ({ date: h.date?.slice(5), ei: Math.round(h.ei_score ?? 0) })));
      const all = exData.data || exData.exercises || [];
      setExercises(all.filter(e => {
        const name = (e.name||e.exercise_name||"").toLowerCase();
        const reg  = (e.region||"").toLowerCase();
        const rl   = rid.toLowerCase().split(" ")[0];
        return name.includes(rl) || reg.includes(rl) || reg.includes((region?.theatre||"").toLowerCase());
      }));
    }).finally(() => setLoading(false));
  }, [id]);

  if (!region) return (
    <Layout>
      <div style={{ padding:"80px 32px", textAlign:"center" }}>
        <div className="display-serif" style={{ fontSize:80, color:"var(--ink-15)", marginBottom:16 }}>—</div>
        <div className="body" style={{ marginBottom:20 }}>Region not found.</div>
        <Link to="/" className="btn-ghost">← Back to Overview</Link>
      </div>
    </Layout>
  );

  const score = ei;
  const color = EI_COLOR(score);

  // Real component scores from the API (deterrence_index gz_score/ex_score +
  // baseline exposed by /api/di/region). No more reverse-engineering from EI.
  const components = comp ?? { gz: 0, ex: 0, base: 0 };

  const spark = history.length >= 2 ? history.map(h => h.ei) : null;

  return (
    <Layout>
      <div className="route-in" style={{ background:"var(--cream)" }}>

        {RECALIBRATING[region.id] && (
          <section className="container-wide" style={{ paddingTop:20 }}>
            <div style={{ display:"flex", gap:12, alignItems:"flex-start", background:"rgba(176,125,26,0.07)", border:"1px solid rgba(176,125,26,0.3)", borderRadius:10, padding:"12px 16px" }}>
              <span className="micro" style={{ color:"#B07D1A", border:"1px solid rgba(176,125,26,0.4)", borderRadius:4, padding:"2px 6px", flexShrink:0, marginTop:1 }}>RECALIBRATING</span>
              <span style={{ fontSize:12.5, color:"var(--ink-muted)", lineHeight:1.6 }}>{RECALIBRATING[region.id]} See the Limitations section on the About page for details.</span>
            </div>
          </section>
        )}

        {/* ─── BREADCRUMB ─────────────────────── */}
        <section className="container-wide" style={{ paddingTop:24, paddingBottom:12 }}>
          <div className="micro" style={{ display:"flex", alignItems:"center", gap:10, color:"var(--ink-55)" }}>
            <Link to="/" style={{ textDecoration:"underline", textUnderlineOffset:3 }}>Overview</Link>
            <span>›</span>
            <span className="micro-strong">{region.label}</span>
          </div>
        </section>

        {/* ─── MASTHEAD ─────────────────────── */}
        <section className="container-wide" style={{ paddingTop:36, paddingBottom:48 }}>
          <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1.4fr) minmax(0,1fr)", gap:64, alignItems:"end" }} className="stack-mobile">
            <div>
              <div className="micro micro-accent" style={{ marginBottom:22, display:"flex", alignItems:"center", gap:10 }}>
                <span className="tick"/>
                REGION DOSSIER · {region.short||region.id.slice(0,3).toUpperCase()} · {region.category==="conflict"?"ACTIVE CONFLICT":"STRATEGIC TENSION"}
              </div>
              <h1 className="display" style={{ marginBottom:18 }}>
                {region.label.split(" ")[0]}<br/>
                <span className="serif" style={{ fontWeight:300, fontStyle:"italic", color:"var(--ink-70)" }}>
                  {region.label.split(" ").slice(1).join(" ")||"—"}
                </span>
              </h1>
              <Coord lat={region.lat} lng={region.lng} />
              <p className="body-lg" style={{ maxWidth:520, marginTop:24 }}>
                Live escalation index, indexed incidents and concurrent exercise activity for the {region.label} theatre. Calculated against a logarithmic deterrence function over a 30-day window.
              </p>
            </div>

            {/* EI block */}
            <div style={{ borderTop:"1px solid var(--ink)", borderBottom:"1px solid var(--ink)", padding:"32px 0", position:"relative" }}>
              <div className="micro" style={{ marginBottom:8 }}>ESCALATION INDEX · 14D</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:24 }}>
                <span className="tab-num" style={{ fontSize:clamp(80,160), fontWeight:800, lineHeight:0.85, letterSpacing:"-0.05em", color }}>
                  {loading ? "…" : <AnimatedNumber value={score} duration={1500} />}
                </span>
                <div style={{ paddingBottom:12 }}>
                  <div className="micro" style={{ color, marginBottom:8 }}>{EI_LABEL(score)}</div>
                  <div className="mono small tab-num" style={{ color: region.trend > 0 ? "var(--hi)" : region.trend < 0 ? "var(--lo)" : "var(--ink-40)" }}>
                    {region.trend > 0 ? `↑ +${region.trend}` : region.trend < 0 ? `↓ ${region.trend}` : "→ stable"} vs prev.
                  </div>
                  
                </div>
              </div>
              {spark && (
                <div style={{ marginTop:18 }}>
                  <Sparkline data={spark} color={color} width={460} height={56} showArea showDot strokeWidth={1.5} />
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                    <span className="mono small" style={{ color:"var(--ink-40)" }}>30d ago</span>
                    <span className="mono small" style={{ color:"var(--ink-40)" }}>today</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── INDEX COMPONENTS ─────────────────────── */}
        <section className="container-wide" style={{ paddingBottom:56 }}>
          <div className="section-bar">
            <span className="tick"/>
            <span className="micro micro-strong">§ 01 · INDEX COMPONENTS</span>
            <span className="micro" style={{ color:"var(--ink-40)" }}>weights · GZ 45% · EX 35% · BASE 20%</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14, marginTop:16 }} className="stack-mobile">
            <Component kicker="GZ · GRAY-ZONE INCIDENTS" value={components.gz} weight={0.45} contrib={Math.round(components.gz*0.45)} note="Event-based severity, deduplicated. Recent events weighted higher; saturating." />
            <Component kicker="EX · EXERCISE SIGNAL" value={components.ex} weight={0.35} contrib={Math.round(components.ex*0.35)} note="Exercise scale + rhetoric score. ±14 day window." />
            <Component kicker="BASE · STRUCTURAL" value={components.base} weight={0.20} contrib={Math.round(components.base*0.20)} note={region.category==="conflict"?"Active conflict baseline.":"Strategic-tension baseline."} />
          </div>
        </section>

        {/* ─── ESCALATION CHART ─────────────────────── */}
        {history.length > 0 && (
          <section className="container-wide" style={{ paddingBottom:56 }}>
            <div className="section-bar">
              <span className="tick"/>
              <span className="micro micro-strong">§ 01b · ESCALATION INDEX HISTORY</span>
              <span className="micro tab-num" style={{ color:"var(--ink-40)" }}>{history.length} data point{history.length !== 1 ? "s" : ""}</span>
            </div>
            <div style={{ borderTop:"1px solid var(--ink)", paddingTop:24, paddingBottom:8 }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={history} margin={{ top:8, right:16, left:0, bottom:8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize:10, fontFamily:"var(--mono)", fill:"var(--ink-40)" }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value:"Date", position:"insideBottom", offset:-4, fontSize:9, fill:"var(--ink-40)", fontFamily:"var(--mono)" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize:10, fontFamily:"var(--mono)", fill:"var(--ink-40)" }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                    label={{ value:"Escalation Index", angle:-90, position:"insideLeft", offset:10, fontSize:9, fill:"var(--ink-40)", fontFamily:"var(--mono)" }}
                  />
                  <Tooltip
                    contentStyle={{ fontFamily:"var(--mono)", fontSize:11, border:"1px solid var(--rule)", background:"var(--cream)", borderRadius:4 }}
                    labelStyle={{ color:"var(--ink-55)", marginBottom:4 }}
                    itemStyle={{ color }}
                    formatter={(v) => [v, "EI"]}
                  />
                  <Line type="monotone" dataKey="ei" stroke={color} strokeWidth={1.5} dot={false} activeDot={{ r:3, fill:color }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ─── ACTIVITY TABS ─────────────────────── */}
        <section className="container-wide" style={{ paddingBottom:72 }}>
          <div className="section-bar">
            <span className="tick"/>
            <span className="micro micro-strong">§ 02 · ACTIVITY</span>
            <div style={{ display:"flex", gap:20, marginLeft:24 }}>
              <TabBtn active={tab==="incidents"} onClick={()=>setTab("incidents")} label={`Signals · ${loading?"…":incidents.length}`} />
              <TabBtn active={tab==="exercises"} onClick={()=>setTab("exercises")} label={`Exercises · ${loading?"…":exercises.length}`} />
              <TabBtn active={tab==="narrative"} onClick={()=>setTab("narrative")} label="AI Narrative" />
            </div>
            <span className="meta mono small" style={{ color:"var(--ink-40)" }}>{loading?"syncing…":"updated"}</span>
          </div>

          {tab === "incidents" && <IncidentColumn items={incidents} loading={loading} />}
          {tab === "exercises" && <ExerciseList items={exercises} loading={loading} />}
          {tab === "narrative" && <NarrativePreview region={region} score={score} incidents={incidents} navigate={navigate} />}
        </section>

        {/* ─── METHODOLOGY PULL-QUOTE ─────────────────────── */}
        <section className="container-wide" style={{ paddingBottom:64 }}>
          <div style={{ borderTop:"1px solid var(--ink)", paddingTop:36, paddingBottom:36 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:56 }} className="stack-mobile">
              <div className="micro micro-accent">
                <span className="tick"/>
                METHOD NOTE
              </div>
              <div>
                <p className="display-serif" style={{ fontSize:36, lineHeight:1.2, marginBottom:18, color:"var(--ink)" }}>
                  "The Deterrence Index is a research indicator. It compresses heterogeneous open-source signals into a single number — useful for ranking, insufficient for prediction."
                </p>
                <div className="micro" style={{ color:"var(--ink-55)" }}>
                  Project memo · JFKI · FU Berlin · Summer Term 2026
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}

function clamp(min, max) {
  return `clamp(${min}px, 10vw, ${max}px)`;
}

function Component({ kicker, value, weight, contrib, note }) {
  return (
    <div className="panel" style={{ padding:"24px 28px" }}>
      <div className="micro" style={{ marginBottom:14 }}>{kicker}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:8 }}>
        <span className="tab-num" style={{ fontSize:56, fontWeight:700, letterSpacing:"-0.03em", lineHeight:1 }}>
          <AnimatedNumber value={value} />
        </span>
        <span className="mono small" style={{ color:"var(--ink-40)" }}>× {weight.toFixed(2)} → +{contrib}</span>
      </div>
      <div style={{ height:3, background:"var(--ink-06)", marginBottom:14 }}>
        <div style={{ height:"100%", width:`${Math.min(100,value)}%`, background:"var(--accent)", opacity:0.55 }}/>
      </div>
      <p className="small" style={{ color:"var(--ink-55)" }}>{note}</p>
    </div>
  );
}

function TabBtn({ active, onClick, label }) {
  return (
    <button onClick={onClick} className="micro" style={{
      paddingBottom:6,
      borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
      color: active ? "var(--ink)" : "var(--ink-55)",
      fontWeight: active ? 700 : 500,
      cursor:"pointer",
    }}>
      {label}
    </button>
  );
}

function IncidentColumn({ items, loading }) {
  if (loading) return <Empty msg="Loading…" />;
  if (items.length === 0) return <Empty msg="No indexed incidents in current window." />;
  return (
    <div style={{ borderTop:"1px solid var(--ink)" }}>
      {items.slice(0,20).map((inc, i) => {
        const catKey = inc.category || inc.cat || "unknown";
        const cat = CATS[catKey] || CATS.unknown;
        const el = inc.escalation_level || 1;
        return (
          <article key={inc.id||i} style={{ display:"grid", gridTemplateColumns:"100px 1fr 80px 150px", gap:24, padding:"20px 0", borderBottom:"1px solid var(--rule)", alignItems:"flex-start" }}>
            <div>
              <div className="mono" style={{ fontSize:14, color:"var(--ink)" }}>{inc.date?.slice(5,10)||"—"}</div>
              <div className="mono small" style={{ color:"var(--ink-40)" }}>{inc.date?.slice(0,10)||""}</div>
            </div>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                <span style={{ color:cat.color, fontSize:13 }}>{cat.glyph}</span>
                <span className="micro" style={{ color:cat.color }}>{cat.label}</span>
                {el >= 3 && <span className="mono" style={{ fontSize:9, padding:"2px 6px", background:"var(--hi)", color:"#fff", letterSpacing:"0.1em" }}>EL{el}</span>}
              </div>
              <div style={{ fontSize:16, fontWeight:500, lineHeight:1.4, marginBottom:4 }}>{inc.title}</div>
              {inc.description && inc.description !== inc.title && (
                <p className="small" style={{ marginTop:6 }}>{inc.description}</p>
              )}
            </div>
            <span className="mono small" style={{ color:"var(--ink-55)" }}>{getConf(inc.source_name||"")}</span>
            {inc.source_url ? (
              <a href={inc.source_url} target="_blank" rel="noopener noreferrer" className="mono small" style={{ color:"var(--ink-55)", textDecoration:"underline", textUnderlineOffset:4 }}>
                {(inc.source_name||"").split(" ")[0]} ↗
              </a>
            ) : (
              <span className="mono small" style={{ color:"var(--ink-40)" }}>{inc.source_name||"—"}</span>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ExerciseList({ items, loading }) {
  if (loading) return <Empty msg="Loading…" />;
  if (items.length === 0) return <Empty msg="No concurrent exercises in current window." />;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:16 }} className="stack-mobile">
      {items.map((ex, i) => {
        const name = ex.name || ex.exercise_name || "—";
        const type = ex.exercise_type || ex.type || "LIVEX";
        const lead = ex.lead_nation || ex.lead || "";
        const start = ex.start_date || ex.start || "";
        const end   = ex.end_date   || ex.end   || "";
        const scale = ex.scale || ex.personnel_count || 0;
        return (
          <div key={ex.id||i} className="panel" style={{ padding:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <span className="mono" style={{ fontSize:10, padding:"2px 7px", background:"var(--ink)", color:"var(--cream)", letterSpacing:"0.12em", borderRadius:"var(--r-sm)" }}>{type}</span>
              {lead && <span className="micro micro-accent">{lead}</span>}
            </div>
            <div style={{ fontSize:20, fontWeight:600, marginBottom:6 }}>{name}</div>
            <div className="mono small" style={{ color:"var(--ink-55)", marginBottom:8 }}>
              {start} → {end}
            </div>
            {scale > 0 && (
              <div className="small">
                <span className="mono">{Number(scale).toLocaleString()}</span> personnel
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NarrativePreview({ region, score, incidents, navigate }) {
  return (
    <div style={{ borderTop:"1px solid var(--ink)", padding:"32px 0", maxWidth:720 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
        <span className="mono" style={{ fontSize:9, padding:"2px 7px", background:"var(--lo)", color:"#fff", letterSpacing:"0.12em" }}>AI-GENERATED</span>
        <span className="micro" style={{ color:"var(--ink-55)" }}>Groq · Llama 3.3-70B · open-source corpus</span>
      </div>
      <p className="body-lg" style={{ marginBottom:16 }}>
        The {region.label} theatre registers an Escalation Index of{" "}
        <span className="mono" style={{ color:EI_COLOR(score), fontWeight:600 }}>{score}</span>{" "}
        over the past 14 days — {region.trend > 0 ? `a ${region.trend}-point rise from the prior cycle` : region.trend < 0 ? `a ${Math.abs(region.trend)}-point fall from the prior cycle` : "stable against the prior cycle"}.
      </p>
      <p className="body" style={{ marginBottom:16 }}>
        Gray-zone activity is dominated by {region.category==="conflict"?"military and civilian incidents":"diplomatic signalling and limited maritime engagements"}. Source confidence remains weighted toward institutional reporting (UN News, OCHA, UCDP), with secondary OSINT verification through Bellingcat-class outlets.
      </p>
      {incidents.length > 0 && (
        <p className="body" style={{ marginBottom:20 }}>
          {incidents.length} signals indexed for this region in the current window. The most recent entry: "{incidents[0]?.title?.slice(0,90)}…"
        </p>
      )}
      <button className="btn-primary" onClick={() => navigate(`/briefs`)}>
        Generate full brief →
      </button>
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div style={{ borderTop:"1px solid var(--ink)", padding:"80px 0", textAlign:"center" }}>
      <div className="display-serif" style={{ fontSize:80, color:"var(--ink-15)", marginBottom:14 }}>—</div>
      <div className="body" style={{ color:"var(--ink-55)" }}>{msg}</div>
    </div>
  );
}

function Coord({ lat, lng }) {
  if (lat == null || lng == null) return null;
  return (
    <span className="mono" style={{ fontSize:11, color:"var(--ink-40)", letterSpacing:"0.05em" }}>
      {Math.abs(lat).toFixed(1)}°{lat>=0?"N":"S"} {Math.abs(lng).toFixed(1)}°{lng>=0?"E":"W"}
    </span>
  );
}
