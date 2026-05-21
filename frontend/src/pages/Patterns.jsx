import { useState } from "react";
import Layout from "../components/Layout";
import { useNavigate } from "react-router-dom";
import { REGIONS } from "../data/seed";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

const BRIEF_SECTIONS = ["Situation overview","Recent signals","Exercise activity","Rhetoric assessment","Source confidence","Limitations"];
const LOADING_STAGES = ["Loading incident data…","Matching exercise signals…","Assessing rhetoric patterns…","Synthesising brief…"];

export default function PatternsPage() {
  const navigate = useNavigate();
  const [region, setRegion]     = useState(null);
  const [narrative, setNarrative] = useState("");
  const [loading, setLoading]   = useState(false);
  const [stage, setStage]       = useState(0);
  const [error, setError]       = useState("");
  const [copied, setCopied]     = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  function copyBrief() {
    navigator.clipboard.writeText(narrative)
      .then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); })
      .catch(()=>{});
  }

  async function generate(r) {
    setRegion(r); setNarrative(""); setError(""); setLoading(true); setStage(0);
    const timer = setInterval(()=>setStage(s=>Math.min(s+1,LOADING_STAGES.length-1)),1400);
    try {
      const res = await fetch(`${API}/api/admin/narrative/${encodeURIComponent(r)}`);
      if (!res.ok) { const d=await res.json().catch(()=>({})); throw new Error(d.detail||`HTTP ${res.status}`); }
      const d = await res.json();
      if (!d.narrative) throw new Error("LLM returned empty response.");
      setNarrative(d.narrative);
      setGeneratedAt(new Date().toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}));
    } catch(e) {
      const msg = e.message || "";
      if (msg.includes("404") || msg.includes("No data") || msg.includes("no data")) {
        setError("No sufficient data indexed for this region yet. Run the scraper pipeline first.");
      } else if (msg.includes("502") || msg.includes("empty")) {
        setError("The LLM returned an empty response. Try again or select a region with more indexed incidents.");
      } else {
        setError("Failed to connect to API. Check that Railway is running.");
      }
    } finally {
      clearInterval(timer); setLoading(false);
    }
  }

  return (
    <Layout>
      <div style={{ padding:"24px 16px 56px", maxWidth:760, margin:"0 auto", width:"100%" }}>
        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"2px", color:"var(--crimson)", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ display:"inline-block", width:18, height:1.5, background:"var(--crimson)" }} aria-hidden="true"/>
            ANALYTICAL BRIEFS
          </div>
          <h1 style={{ fontSize:30, fontWeight:800, letterSpacing:"-0.5px", marginBottom:8 }}>Analytical Briefs</h1>
          <p style={{ fontSize:14, color:"var(--ink-muted)", lineHeight:1.65, maxWidth:520 }}>
            Generate a structured analytical brief for a selected region based on recent incidents, exercise signals, rhetoric, and source activity.
          </p>
          <div style={{ marginTop:12, padding:"10px 14px", background:"rgba(26,16,8,0.03)", border:"1px solid rgba(26,16,8,0.08)", borderRadius:8, fontSize:12, color:"var(--ink-muted)", lineHeight:1.6 }}>
            <strong style={{ color:"var(--ink)", fontWeight:600 }}>AI-generated content.</strong> Briefs summarise open-source structured inputs using Groq / Llama 3.3-70B. Not independent intelligence judgements.
          </div>
        </div>

        {/* Region chips */}
        <fieldset style={{ border:"none", padding:0, marginBottom:32 }}>
          <legend style={{ fontSize:10, fontWeight:700, letterSpacing:"1.5px", color:"var(--ink-muted)", marginBottom:10 }}>SELECT REGION</legend>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }} role="group" aria-label="Region selection">
            {REGIONS.map(r => {
              const active = region===r.id;
              return (
                <button key={r.id} onClick={()=>generate(r.id)} aria-pressed={active}
                  style={{ fontSize:12, fontWeight:active?600:400, padding:"6px 14px", borderRadius:999, border:"1px solid", borderColor:active?"var(--crimson)":"rgba(26,16,8,0.15)", background:active?"var(--crimson)":"#fff", color:active?"#fff":"var(--ink-muted)", cursor:"pointer", transition:"all .12s" }}>
                  {r.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Loading */}
        {loading && (
          <div style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.08)", borderRadius:14, padding:28 }} role="status" aria-live="polite">
            <div style={{ fontSize:12, color:"var(--ink-muted)", marginBottom:16 }}>
              <span style={{ fontWeight:600, color:"var(--ink)" }}>{region}</span> — {LOADING_STAGES[stage]}
            </div>
            <div style={{ height:2, background:"rgba(26,16,8,0.06)", borderRadius:1, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${((stage+1)/LOADING_STAGES.length)*100}%`, background:"var(--crimson)", borderRadius:1, transition:"width 1.2s ease" }}/>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div role="alert" style={{ background:"rgba(139,32,48,0.05)", border:"1px solid rgba(139,32,48,0.2)", borderRadius:12, padding:"16px 20px", fontSize:13, color:"#8B2030" }}>
            <strong>Error:</strong> {error}
            <div style={{ marginTop:8, fontSize:12, color:"var(--ink-muted)" }}>Ensure the API is reachable and the region has indexed incidents.</div>
          </div>
        )}

        {/* Result */}
        {narrative && !loading && (
          <div style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.08)", borderRadius:14, overflow:"hidden" }}>
            <div style={{ padding:"18px 24px", borderBottom:"1px solid rgba(26,16,8,0.08)", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:"2px", color:"var(--crimson)", marginBottom:6 }}>ANALYTICAL BRIEF</div>
                <div style={{ fontSize:18, fontWeight:700, color:"var(--ink)" }}>{region}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:9, padding:"3px 9px", borderRadius:999, background:"rgba(45,122,79,0.08)", color:"#2D7A4F", border:"1px solid rgba(45,122,79,0.2)", fontWeight:700, letterSpacing:"1px", marginBottom:6 }}>
                  AI-GENERATED
                </div>
                <div style={{ fontSize:10, color:"var(--ink-muted)" }}>Groq / Llama 3.3-70B</div>
              </div>
            </div>

            <div style={{ padding:"20px 28px" }} aria-live="polite">
              {narrative.split("\n").filter(p=>p.trim()).map((p,i)=>(
                <p key={i} style={{ fontSize:14, lineHeight:1.75, color:"var(--ink)", marginBottom:14 }}>{p}</p>
              ))}
            </div>

            <div style={{ padding:"12px 24px", borderTop:"1px solid rgba(26,16,8,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
              <div style={{ fontSize:11, color:"rgba(26,16,8,0.35)", lineHeight:1.5 }}>
                {generatedAt && <span>Generated {generatedAt} · </span>}
                Based on open-source data · Not an official intelligence assessment.
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={copyBrief} aria-label="Copy brief to clipboard" style={{ fontSize:11, color:copied?"#2D7A4F":"var(--ink-muted)", background:"none", border:"1px solid rgba(26,16,8,0.15)", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontWeight:500, transition:"color .15s" }}>
                  {copied?"Copied ✓":"Copy brief"}
                </button>
                <button onClick={()=>navigate("/incidents")} style={{ fontSize:11, color:"var(--ink-muted)", background:"none", border:"1px solid rgba(26,16,8,0.15)", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontWeight:500 }}>
                  Related incidents →
                </button>
                <button onClick={()=>generate(region)} style={{ fontSize:11, color:"var(--crimson)", background:"none", border:"1px solid rgba(107,26,42,0.2)", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontWeight:500 }}>
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!narrative && !loading && !error && (
          <div style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.08)", borderRadius:14, padding:"40px 28px", textAlign:"center" }}>
            <div style={{ fontSize:28, marginBottom:14, opacity:0.2 }} aria-hidden="true">◎</div>
            <div style={{ fontSize:15, fontWeight:600, color:"var(--ink)", marginBottom:8 }}>Select a region to generate a brief</div>
            <div style={{ fontSize:13, color:"var(--ink-muted)", marginBottom:24, maxWidth:380, margin:"0 auto 24px" }}>
              Briefs summarise escalation dynamics, recent incidents, signal patterns, and source confidence for the selected region.
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
              {BRIEF_SECTIONS.map(s=>(
                <span key={s} style={{ fontSize:11, padding:"4px 12px", borderRadius:999, background:"rgba(26,16,8,0.04)", color:"var(--ink-muted)", border:"1px solid rgba(26,16,8,0.08)" }}>{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
