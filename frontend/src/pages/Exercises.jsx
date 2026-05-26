import { useState, useEffect } from "react";
import Layout from "../components/Layout";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

const TYPE_META = {
  LIVEX:"Live Exercise — real troops, equipment, field operations",
  CPX:  "Command Post Exercise — HQ/staff, simulated forces",
  MAREX:"Maritime Exercise — naval-focused operations",
  ADEX: "Air Defence Exercise",
  FTX:  "Field Training Exercise",
  TTX:  "Tabletop Exercise",
};

function getBadgeStyle(ex) {
  const l = (ex.lead_nation||"").toLowerCase();
  if (l.includes("nato")||l.includes("shape")) return { bg:"rgba(139,32,48,0.08)", border:"rgba(139,32,48,0.2)", text:"#8B2030", label:"NATO" };
  if (l.includes("sweden")||l.includes("finland")) return { bg:"rgba(59,109,17,0.08)", border:"rgba(59,109,17,0.2)", text:"#3B6D11", label:"NATIONAL" };
  return { bg:"rgba(24,95,165,0.08)", border:"rgba(24,95,165,0.2)", text:"#185FA5", label:"MULTILATERAL" };
}

function getRhetColor(score) {
  if (score==null) return "var(--ink-muted)";
  if (score>=0.7) return "#8B2030";
  if (score>=0.5) return "#C0622B";
  return "var(--ink-muted)";
}

function ExerciseTimeline({ exercises }) {
  const dated = exercises.filter(e => e.start_date);
  if (!dated.length) return <div style={{ fontSize:13, color:"var(--ink-muted)", padding:"24px 0" }}>No date data for timeline.</div>;

  const starts = dated.map(e => e.start_date).sort();
  const ends = dated.map(e => e.end_date || e.start_date).sort();
  const minDate = new Date(starts[0]);
  const rawMax = new Date(ends[ends.length-1]);
  rawMax.setDate(rawMax.getDate()+14);
  const totalMs = rawMax - minDate || 1;

  const getX = (d) => Math.max(0, Math.min(98, (new Date(d) - minDate) / totalMs * 100));

  const months = [];
  const cur = new Date(minDate); cur.setDate(1);
  while (cur <= rawMax) { months.push(new Date(cur)); cur.setMonth(cur.getMonth()+1); }

  return (
    <div style={{ background:"var(--card)", border:"1px solid var(--card-border)", borderRadius:14, padding:"20px 24px", overflowX:"auto" }}>
      <div style={{ minWidth:600 }}>
        {/* Month axis */}
        <div style={{ position:"relative", height:20, marginBottom:10, marginLeft:160 }}>
          <div style={{ position:"absolute", inset:0, borderBottom:"1px solid var(--card-border)" }}/>
          {months.filter((_,i)=>i%2===0||months.length<=8).map((m,i) => (
            <div key={i} style={{ position:"absolute", left:`${getX(m.toISOString())}%`, transform:"translateX(-50%)", fontSize:9, color:"var(--ink-muted)", letterSpacing:"0.5px", whiteSpace:"nowrap" }}>
              {m.toLocaleDateString("en-GB",{month:"short",year:"2-digit"})}
            </div>
          ))}
        </div>
        {/* Rows */}
        {dated.map((ex,i) => {
          const badge = getBadgeStyle(ex);
          const sx = getX(ex.start_date);
          const fallbackEnd = ex.start_date ? new Date(new Date(ex.start_date).getTime()+14*86400000).toISOString().slice(0,10) : null;
          const ex2 = getX(ex.end_date || fallbackEnd || ex.start_date);
          const w = Math.max(ex2-sx, 1.5);
          return (
            <div key={ex.id||i} style={{ display:"flex", alignItems:"center", marginBottom:6, height:30 }}>
              <div style={{ width:160, flexShrink:0, paddingRight:12, textAlign:"right" }}>
                <span style={{ fontSize:10, fontWeight:600, color:"var(--ink)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", display:"block" }}>
                  {ex.name.length>22?ex.name.slice(0,22)+"…":ex.name}
                </span>
              </div>
              <div style={{ flex:1, position:"relative", height:"100%", background:"rgba(26,16,8,0.03)", borderRadius:4 }}>
                <div style={{
                  position:"absolute", top:5, bottom:5,
                  left:`${sx}%`, width:`${w}%`,
                  background:`${badge.text}20`, border:`1px solid ${badge.text}45`,
                  borderRadius:4, minWidth:8,
                  display:"flex", alignItems:"center", paddingLeft:6, overflow:"hidden",
                }}>
                  <span style={{ fontSize:8, color:badge.text, fontWeight:700, whiteSpace:"nowrap" }}>{ex.exercise_type||""}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ height:1, background:"rgba(26,16,8,0.06)", marginLeft:160, marginTop:4 }}/>
        <div style={{ fontSize:9, color:"rgba(26,16,8,0.3)", marginLeft:160, marginTop:6, letterSpacing:"0.5px" }}>
          {minDate.toLocaleDateString("en-GB",{month:"short",year:"numeric"})} → {rawMax.toLocaleDateString("en-GB",{month:"short",year:"numeric"})}
        </div>
      </div>
    </div>
  );
}


export default function ExercisesPage() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("all");
  const [sort, setSort]           = useState("latest");
  const [view, setView]           = useState("cards");

  useEffect(() => {
    fetch(`${API}/api/exercises/`)
      .then(r=>r.json())
      .then(d=>{ if (d.data?.length) setExercises(d.data); })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, []);

  const filtered = exercises.filter(ex => {
    if (filter==="all") return true;
    const l=(ex.lead_nation||"").toLowerCase();
    if (filter==="nato") return l.includes("nato")||l.includes("shape");
    if (filter==="multilateral") return !l.includes("nato")&&!l.includes("shape")&&!l.includes("sweden");
    if (filter==="national") return l.includes("sweden")||l.includes("finland");
    return true;
  });

  const sorted = [...filtered].sort((a,b) => {
    if (sort==="latest") return (b.start_date||"").localeCompare(a.start_date||"");
    if (sort==="oldest") return (a.start_date||"").localeCompare(b.start_date||"");
    if (sort==="troops") return (b.scale||0)-(a.scale||0);
    if (sort==="signal") return (b.rhetoric_score||0)-(a.rhetoric_score||0);
    return 0;
  });

  const nato  = exercises.filter(e=>{const l=(e.lead_nation||"").toLowerCase();return l.includes("nato")||l.includes("shape");}).length;
  const multi = exercises.filter(e=>{const l=(e.lead_nation||"").toLowerCase();return !l.includes("nato")&&!l.includes("shape")&&!l.includes("sweden");}).length;
  const nat   = exercises.filter(e=>{const l=(e.lead_nation||"").toLowerCase();return l.includes("sweden")||l.includes("finland");}).length;

  return (
    <Layout>
      <div style={{ padding:"24px 16px 56px", maxWidth:960, margin:"0 auto", width:"100%" }}>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"2px", color:"var(--crimson)", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ display:"inline-block", width:18, height:1.5, background:"var(--crimson)" }}/>
            EXERCISES
          </div>
          <h1 style={{ fontSize:30, fontWeight:800, letterSpacing:"-0.5px", marginBottom:6 }}>Military Exercises</h1>
          <p style={{ fontSize:14, color:"var(--ink-muted)" }}>Active and upcoming exercises · ±14 day scoring window · Last updated: May 2026</p>
        </div>

        {/* Stats */}
        {exercises.length > 0 && (
          <div style={{ display:"flex", gap:0, marginBottom:24, border:"1px solid var(--card-border)", borderRadius:10, overflow:"hidden", background:"var(--card)", overflowX:"auto" }}>
            {[["Total",exercises.length,"var(--ink)"],["NATO",nato,"#8B2030"],["Multilateral",multi,"#185FA5"],["National",nat,"#3B6D11"]].map(([l,v,c],i)=>(
              <div key={l} style={{ flex:1, minWidth:70, padding:"14px 12px", borderRight:i<3?"1px solid var(--card-border)":"none", textAlign:"center" }}>
                <div style={{ fontSize:26, fontWeight:800, color:c, letterSpacing:"-0.5px", fontVariantNumeric:"tabular-nums" }}>{v}</div>
                <div style={{ fontSize:10, letterSpacing:"1.5px", color:"var(--ink-muted)", marginTop:3, fontWeight:500 }}>{l.toUpperCase()}</div>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div style={{ display:"flex", gap:8, alignItems:"flex-start", flexWrap:"wrap", marginBottom:24 }}>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"1.5px", color:"var(--ink-muted)" }}>FILTER</span>
            {[["all","All"],["nato","NATO"],["multilateral","Multilateral"],["national","National"]].map(([k,l])=>(
              <button key={k} onClick={()=>setFilter(k)} style={{ fontSize:11, padding:"4px 11px", borderRadius:999, border:"1px solid", borderColor:filter===k?"var(--ink)":"rgba(26,16,8,0.15)", background:filter===k?"var(--ink)":"transparent", color:filter===k?"var(--cream)":"var(--ink-muted)", cursor:"pointer", fontWeight:filter===k?600:400 }}>{l}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:"1.5px", color:"var(--ink-muted)" }}>SORT</span>
            {[["latest","Latest"],["oldest","Oldest"],["troops","Troops"],["signal","Signal"]].map(([k,l])=>(
              <button key={k} onClick={()=>setSort(k)} style={{ fontSize:11, padding:"4px 11px", borderRadius:999, border:"1px solid", borderColor:sort===k?"var(--crimson)":"rgba(26,16,8,0.15)", background:sort===k?"rgba(107,26,42,0.08)":"transparent", color:sort===k?"var(--crimson)":"var(--ink-muted)", cursor:"pointer", fontWeight:sort===k?600:400 }}>{l}</button>
            ))}
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
            {[["cards","Cards"],["timeline","Timeline"]].map(([k,l])=>(
              <button key={k} onClick={()=>setView(k)} aria-pressed={view===k} style={{ fontSize:11, padding:"4px 11px", borderRadius:999, border:"1px solid", borderColor:view===k?"var(--ink)":"rgba(26,16,8,0.15)", background:view===k?"var(--ink)":"transparent", color:view===k?"var(--cream)":"var(--ink-muted)", cursor:"pointer", fontWeight:view===k?600:400 }}>{l}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ fontSize:13, color:"var(--ink-muted)", padding:40 }}>Loading…</div>
        ) : sorted.length === 0 ? (
          <div style={{ background:"var(--card)", border:"1px solid var(--ink-faint)", borderRadius:14, padding:"36px 28px" }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"2px", color:"var(--ink-muted)", marginBottom:14 }}>NO EXERCISES IN CURRENT DATASET</div>
            <p style={{ fontSize:14, color:"var(--ink-muted)", lineHeight:1.7, marginBottom:24, maxWidth:520 }}>
              No verified exercise records within the current dataset. Exercise data is scraped from SHAPE NATO, Wikipedia, and Defense.gov on each pipeline run.
            </p>
            <div style={{ border:"1px solid var(--ink-faint)", borderRadius:10, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr", padding:"9px 16px", borderBottom:"1px solid var(--ink-faint)", fontSize:9, fontWeight:700, letterSpacing:"1.5px", color:"var(--ink-muted)" }}>
                {["EXERCISE","REGION","START","TROOPS","SIGNAL","SOURCE"].map(h=><span key={h}>{h}</span>)}
              </div>
              {[1,2,3].map(i=>(
                <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr", padding:"12px 16px", borderBottom:"1px solid var(--ink-faint)", opacity:0.2 }}>
                  {[140,70,60,50,60,50].map((w,j)=>(
                    <div key={j} style={{ height:9, width:w, background:"var(--ink-faint)", borderRadius:3 }}/>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ marginTop:18 }}>
              <a href="/about" style={{ fontSize:12, color:"var(--crimson)", fontWeight:600, textDecoration:"none" }}>View Exercise Signal methodology →</a>
            </div>
          </div>
        ) : view === "timeline" ? (
          <ExerciseTimeline exercises={sorted}/>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {sorted.map((ex,i) => {
              const badge = getBadgeStyle(ex);
              const rhColor = getRhetColor(ex.rhetoric_score);
              return (
                <div key={ex.id||i} style={{ background:"var(--card)", border:"1px solid var(--card-border)", borderRadius:12, padding:"18px 20px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                        <span style={{ fontSize:9, fontWeight:700, letterSpacing:"1px", padding:"2px 7px", borderRadius:3, background:badge.bg, color:badge.text, border:`1px solid ${badge.border}` }}>{badge.label}</span>
                        <span style={{ fontSize:10, color:"var(--ink-muted)" }}>{ex.exercise_type}</span>
                        {ex.domain && <span style={{ fontSize:10, color:"rgba(26,16,8,0.35)" }}>· {ex.domain}</span>}
                      </div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--ink)", marginBottom:4, lineHeight:1.3 }}>{ex.name}</div>
                      <div style={{ fontSize:12, color:"var(--ink-muted)" }}>
                        {[ex.lead_nation, ex.region, ex.start_date?.slice(0,10)+" — "+ex.end_date?.slice(0,10)].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {ex.scale && (
                      <div style={{ textAlign:"right", marginLeft:16, flexShrink:0 }}>
                        <div style={{ fontSize:22, fontWeight:800, color:"var(--ink-muted)", fontVariantNumeric:"tabular-nums" }}>{Number(ex.scale).toLocaleString()}</div>
                        <div style={{ fontSize:9, letterSpacing:"1px", color:"rgba(26,16,8,0.3)", marginTop:2 }}>PERSONNEL</div>
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"center", paddingTop:10, borderTop:"1px solid rgba(26,16,8,0.06)", fontSize:12 }}>
                    {ex.signal_target && <span style={{ color:"var(--ink-muted)" }}>Signal: <strong style={{ color:"var(--ink)" }}>{ex.signal_target}</strong></span>}
                    {ex.rhetoric_score!=null && <span style={{ color:"var(--ink-muted)" }}>Rhetoric: <strong style={{ color:rhColor, fontVariantNumeric:"tabular-nums" }}>{ex.rhetoric_score>0?`+${ex.rhetoric_score}`:ex.rhetoric_score}</strong></span>}
                    {ex.source_url && <a href={ex.source_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft:"auto", color:"var(--crimson)", textDecoration:"none", fontSize:11, fontWeight:500 }}>View source trail →</a>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
