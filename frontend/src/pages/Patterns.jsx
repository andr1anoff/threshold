import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import AnimatedNumber from "../components/AnimatedNumber";
import { REGIONS, EI_COLOR, EI_LABEL } from "../data/seed";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

// BRIEF_SECTIONS removed (v14-fix)
// LOADING_STAGES removed (v15.1: replaced with simple spinner)

export default function BriefsPage() {
  const navigate = useNavigate();
  const [regionId, setRegionId]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [narrative, setNarrative] = useState("");
  const [error, setError]         = useState("");
  const [copied, setCopied]       = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  const [liveEi, setLiveEi] = useState(null);   // { ei, trend } from /api/di/overview
  const baseRegion = regionId ? REGIONS.find(r => r.id === regionId) : null;
  const currentRegion = baseRegion ? { ...baseRegion, ...(liveEi || {}) } : null;

  function copyBrief() {
    const text = narrative;   // only ever the real, backend-generated brief
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {});
  }

  async function generate(rid, force = false) {
    setRegionId(rid);
    setNarrative("");
    setError("");
    setLiveEi(null);
    setLoading(true);

    // Headline indicators come from the live index, not the static seed dict.
    fetch(`${API}/api/di/overview`)
      .then(r => r.json())
      .then(d => {
        const row = d?.data?.[REGIONS.find(x => x.id === rid)?.label] || d?.data?.[rid];
        if (row) setLiveEi({ ei: row.ei_score != null ? Math.round(row.ei_score) : null, trend: row.delta_7d ?? 0 });
      })
      .catch(() => {});

    try {
      const url = `${API}/api/admin/narrative/${encodeURIComponent(rid)}${force ? "?force=true" : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json().catch(()=>({}));
        const detail = d.detail || `HTTP ${res.status}`;
        // 404 = no incidents indexed for this region
        if (res.status === 404) {
          setError(`No recent open-source data for "${rid}". Run the scraper pipeline to index incidents for this region.`);
          setLoading(false);
          return;
        }
        throw new Error(detail);
      }
      const d = await res.json();
      if (d.narrative) {
        setNarrative(d.narrative);
        setGeneratedAt(new Date().toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}));
      } else {
        throw new Error("LLM returned empty response.");
      }
    } catch(e) {
      // NO FABRICATION. Previously this fell back to buildLocalBrief() — a
      // hardcoded six-section "brief", complete with a Rhetoric assessment
      // ("Official communications register moderate signalling intensity")
      // that was pure invention, identical for every region, rendered whenever
      // the backend failed. It contradicted the project's own README ("No
      // displayed value is ever synthetic") and it hid real outages from us:
      // a broken GROQ_API_KEY produced a plausible-looking brief instead of an
      // error, so we could not tell whether the provider fallback worked.
      //
      // An empty state is the honest output. Say what broke and stop.
      const msg = e.message || "";
      setError(
        msg.includes("503") || /unavailable|provider/i.test(msg)
          ? "Brief generation is temporarily unavailable — no LLM provider is responding. This is a Threshold-side fault, not a gap in the data."
          : msg.includes("429") || /rate limit/i.test(msg)
          ? "Provider rate limit reached. Try again in a minute."
          : `Brief could not be generated. ${msg || "The backend did not respond."} No brief is shown rather than a synthetic one.`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="route-in" style={{ display:"flex", flexDirection:"column", flex:"1 0 auto", minHeight:"calc(100vh - 60px)" }}>

        {/* ─── MASTHEAD ─────────────────────── */}
        <section className="container-wide" style={{ paddingTop:60, paddingBottom:36 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:64, alignItems:"end" }} className="stack-mobile">
            <div>
              <div className="micro micro-accent" style={{ marginBottom:18, display:"flex", alignItems:"center", gap:10 }}>
                <span className="tick"/>
                ANALYTICAL BRIEFS · GROQ · LLAMA 3.3-70B
              </div>
              <h1 className="h1" style={{ marginBottom:14, maxWidth:720 }}>
                Region-level briefs<br/>
                <span className="serif" style={{ fontStyle:"italic", fontWeight:400, color:"var(--ink-70)" }}>
                  synthesised from open-source corpus.
                </span>
              </h1>
              <p className="body-lg" style={{ maxWidth:540 }}>
                Structured narrative covering escalation dynamics, recent gray-zone incidents, exercise signals, rhetoric, and source confidence. Not an independent intelligence judgement.
              </p>
            </div>
            <div className="hide-mobile" />
          </div>
        </section>

        {/* ─── REGION PICKER ─────────────────────── */}
        <section className="container-wide" style={{ paddingTop:24, paddingBottom:48 }}>
          <div className="section-bar">
            <span className="tick"/>
            <span className="micro micro-strong">SELECT REGION</span>
            <span className="micro" style={{ color:"var(--ink-40)" }}>20 monitored</span>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {REGIONS.map(r => {
              const active = regionId === r.id;
              return (
                <button key={r.id}
                  onClick={() => generate(r.id)}
                  className={`chip is-accent ${active?"is-active":""}`}
                  style={{ fontSize:12, padding:"8px 14px", letterSpacing:"0.08em" }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── OUTPUT ─────────────────────── */}
        <section className="container-wide" style={{ paddingBottom:80, flex:"1 1 auto", display:"flex", flexDirection:"column" }}>
          {!regionId && <BriefEmpty />}
          {loading && <BriefLoading region={currentRegion} />}
          {!loading && error && <BriefError error={error} onClear={()=>setError("")} />}
          {!loading && !error && narrative && <BriefText narrative={narrative} region={currentRegion} generatedAt={generatedAt} onCopy={copyBrief} copied={copied} onRegenerate={()=>generate(regionId, true)} navigate={navigate} />}
        </section>
      </div>
    </Layout>
  );
}

function BriefEmpty() {
  return (
    <div style={{ flex:"1 1 auto", display:"flex", flexDirection:"column" }}>
      <div style={{ borderTop:"1px solid var(--ink)", flex:"1 1 auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 24px", textAlign:"center" }}>
        <div className="display-serif" style={{ fontSize:80, color:"var(--ink-15)", margin:"0 0 24px" }}>◎</div>
        <h2 className="h2" style={{ marginBottom:12 }}>Select a region above</h2>
        <p className="body" style={{ maxWidth:480, margin:"0 auto" }}>
          Briefs summarise escalation dynamics, recent incidents, signal patterns, and source confidence for the selected region.
        </p>
      </div>
    </div>
  );
}

function BriefLoading({ region }) {
  return (
    <div style={{ borderTop:"1px solid var(--ink)", padding:"80px 0", textAlign:"center" }}>
      <div className="display-serif" style={{ fontSize:80, color:"var(--ink-15)", marginBottom:24, animation:"spin 3s linear infinite", display:"inline-block" }}>◎</div>
      <div className="h2" style={{ marginBottom:10 }}>
        {region ? `Generating brief · ${region.label}` : "Generating brief…"}
      </div>
      <p className="body" style={{ color:"var(--ink-55)", maxWidth:400, margin:"0 auto" }}>
        Synthesising from open-source corpus via Groq · LLaMA 3.3-70B
      </p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function BriefError({ error, onClear }) {
  return (
    <div role="alert" style={{ borderTop:"1px solid var(--hi)", padding:"24px 0" }}>
      <div className="micro" style={{ color:"var(--hi)", marginBottom:10 }}>ERROR</div>
      <p className="body" style={{ marginBottom:16, color:"var(--ink)" }}>{error}</p>
      <button className="btn-ghost" onClick={onClear}>Dismiss</button>
    </div>
  );
}

function BriefText({ narrative, region, generatedAt, onCopy, copied, onRegenerate, navigate }) {
  const color = EI_COLOR(region?.ei);
  return (
    <article style={{ borderTop:"2px solid var(--ink)", paddingTop:32 }}>
      <BriefMasthead region={region} color={color} generatedAt={generatedAt} />
      <div style={{ padding:"32px 0", maxWidth:720 }}>
        {narrative.split("\n").filter(p=>p.trim()).map((p,i)=>(
          <p key={i} className="body-lg" style={{ fontSize:17, lineHeight:1.65, marginBottom:14 }}>{p}</p>
        ))}
      </div>
      <BriefFooter region={region} onCopy={onCopy} copied={copied} onRegenerate={onRegenerate} navigate={navigate} />
    </article>
  );
}

// BriefOutput() removed with buildLocalBrief() — it existed only to render the
// fabricated sections. Real briefs are prose from the LLM and render via BriefText().


function BriefMasthead({ region, color, generatedAt }) {
  if (!region) return null;
  // Stable ref derived from region id — no longer regenerates on every render.
  const ref = (region.id || "").split("").reduce((a,c)=>((a*33 + c.charCodeAt(0))>>>0), 5381)
    .toString(36).toUpperCase().slice(-6).padStart(6,"0");
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:64, paddingBottom:36, borderBottom:"1px solid var(--rule)" }} className="stack-mobile">
      <div>
        <div className="micro" style={{ marginBottom:18, color:"var(--accent)" }}>
          ANALYTICAL BRIEF · OPEN-SOURCE · REF #{ref}
        </div>
        <h2 className="display" style={{ fontSize:"clamp(40px,6vw,72px)", marginBottom:18 }}>{region.label}</h2>
        <div className="mono small" style={{ color:"var(--ink-40)" }}>generated {generatedAt}</div>
      </div>
      <div>
        <div className="micro" style={{ marginBottom:12 }}>HEADLINE INDICATORS</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
          <KV k="EI" v={region.ei ?? "—"} color={color} big />
          <KV k="LABEL" v={EI_LABEL(region.ei)} color={color} />
          <KV k="TREND" v={region.trend>0?`+${region.trend}`:region.trend<0?region.trend:"0"} />
          <KV k="CATEGORY" v={region.category==="conflict"?"Active conflict":"Strategic tension"} />
        </div>
      </div>
    </div>
  );
}

function BriefFooter({ region, onCopy, copied, onRegenerate, navigate, note }) {
  return (
    <div style={{ marginTop:24, paddingTop:24, borderTop:"1px solid var(--rule)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
      <span className="mono small" style={{ color:"var(--ink-40)" }}>
        {note || "Open-source corpus only · not an official intelligence assessment."}
      </span>
      <div style={{ display:"flex", gap:10 }}>
        {region && <button className="btn-ghost" onClick={()=>navigate(`/region/${encodeURIComponent(region.id)}`)}>Open dossier →</button>}
        <button className="btn-ghost" onClick={onCopy}>{copied?"Copied ✓":"Copy brief"}</button>
        <button className="btn-primary" onClick={onRegenerate}>Regenerate</button>
      </div>
    </div>
  );
}

function KV({ k, v, color, big }) {
  return (
    <div>
      <div className="micro" style={{ marginBottom:4 }}>{k}</div>
      <div className="tab-num" style={{ fontSize:big?44:18, fontWeight:big?800:600, letterSpacing:big?"-0.03em":"-0.005em", color:color||"var(--ink)", lineHeight:1 }}>{v}</div>
    </div>
  );
}

// buildLocalBrief() was removed on 2026-07-12.
//
// It fabricated a full six-section analytical brief in JavaScript whenever the
// backend was unreachable — including a "Rhetoric assessment" reading
// "Official communications in the window register moderate signalling
// intensity", hardcoded and identical for Ukraine, Sudan, Taiwan, every region,
// with zero incidents behind it. Users could hit "Copy brief" and walk away
// with invented analysis carrying the Threshold name.
//
// Two reasons it is gone and must stay gone:
//   1. The README promises "No displayed value is ever synthetic." This broke
//      that promise in the one place where it mattered most.
//   2. It masked outages from US. An expired GROQ_API_KEY rendered a
//      plausible brief instead of an error, so a provider failure was
//      indistinguishable from a working system.
//
// If the backend cannot be reached, show the error. Empty stays empty.
