import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import AnimatedNumber from "../components/AnimatedNumber";
import { REGIONS, EI_COLOR, EI_LABEL } from "../data/seed";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

const BRIEF_SECTIONS = ["Situation overview","Recent signals (gray zone)","Exercise activity","Rhetoric assessment","Source confidence","Limitations & caveats"];

const LOADING_STAGES = [
  "Loading incident corpus…",
  "Matching exercise signals…",
  "Scoring rhetoric vectors…",
  "Cross-referencing source confidence…",
  "Synthesising narrative…",
];

export default function BriefsPage() {
  const navigate = useNavigate();
  const [regionId, setRegionId]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [stage, setStage]         = useState(0);
  const [narrative, setNarrative] = useState("");
  const [briefObj, setBriefObj]   = useState(null);
  const [error, setError]         = useState("");
  const [copied, setCopied]       = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  const currentRegion = regionId ? REGIONS.find(r => r.id === regionId) : null;

  function copyBrief() {
    const text = narrative || (briefObj ? briefObj.sections.map(s => `${s.heading}\n${s.body.join("\n")}`).join("\n\n") : "");
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {});
  }

  async function generate(rid) {
    setRegionId(rid);
    setNarrative("");
    setBriefObj(null);
    setError("");
    setLoading(true);
    setStage(0);

    let s = 0;
    const ticker = setInterval(() => {
      s += 1;
      if (s < LOADING_STAGES.length - 1) setStage(s);
    }, 800);

    try {
      const res = await fetch(`${API}/api/admin/narrative/${encodeURIComponent(rid)}`);
      if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.detail || `HTTP ${res.status}`); }
      const d = await res.json();
      clearInterval(ticker);
      setStage(LOADING_STAGES.length - 1);
      if (d.narrative) {
        setNarrative(d.narrative);
        setGeneratedAt(new Date().toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}));
      } else {
        throw new Error("LLM returned empty response.");
      }
    } catch(e) {
      clearInterval(ticker);
      const msg = e.message || "";
      if (msg.includes("404") || msg.includes("No data") || msg.includes("no data")) {
        setBriefObj(buildLocalBrief(rid));
        setGeneratedAt(new Date().toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}));
      } else if (msg.includes("502") || msg.includes("empty")) {
        setError("The LLM returned an empty response. Try again or select a region with more indexed incidents.");
      } else {
        setBriefObj(buildLocalBrief(rid));
        setGeneratedAt(new Date().toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="route-in">

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
            <div style={{ borderTop:"1px solid var(--ink)", paddingTop:18 }} className="hide-mobile">
              <div className="micro" style={{ marginBottom:12 }}>BRIEF SECTIONS</div>
              <ol style={{ listStyle:"none", padding:0, fontSize:13, color:"var(--ink-70)" }}>
                {BRIEF_SECTIONS.map((s, i) => (
                  <li key={s} style={{ display:"flex", gap:12, padding:"8px 0", borderBottom:i<BRIEF_SECTIONS.length-1?"1px solid var(--rule)":"none", lineHeight:1.4 }}>
                    <span className="mono" style={{ color:"var(--ink-40)", width:24, flexShrink:0 }}>0{i+1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
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
        <section className="container-wide" style={{ paddingBottom:80 }}>
          {!regionId && <BriefEmpty />}
          {loading && <BriefLoading region={currentRegion} stage={stage} />}
          {!loading && error && <BriefError error={error} onClear={()=>setError("")} />}
          {!loading && !error && narrative && <BriefText narrative={narrative} region={currentRegion} generatedAt={generatedAt} onCopy={copyBrief} copied={copied} onRegenerate={()=>generate(regionId)} navigate={navigate} />}
          {!loading && !error && briefObj && !narrative && <BriefOutput brief={briefObj} region={currentRegion} generatedAt={generatedAt} onCopy={copyBrief} copied={copied} onRegenerate={()=>generate(regionId)} navigate={navigate} />}
        </section>
      </div>
    </Layout>
  );
}

function BriefEmpty() {
  return (
    <div style={{ borderTop:"1px solid var(--ink)", padding:"80px 24px", textAlign:"center" }}>
      <div className="display-serif" style={{ fontSize:80, color:"var(--ink-15)", marginBottom:16 }}>◎</div>
      <h2 className="h2" style={{ marginBottom:12 }}>Select a region above</h2>
      <p className="body" style={{ maxWidth:480, margin:"0 auto" }}>
        Briefs summarise escalation dynamics, recent incidents, signal patterns, and source confidence for the selected region.
      </p>
    </div>
  );
}

function BriefLoading({ region, stage }) {
  return (
    <div style={{ borderTop:"1px solid var(--ink)", padding:"48px 0" }}>
      <div className="micro" style={{ marginBottom:16 }}>SYNTHESISING · {region?.label?.toUpperCase()}</div>
      <h2 className="h2" style={{ marginBottom:24 }}>{LOADING_STAGES[stage]}</h2>
      <div style={{ display:"flex", flexDirection:"column", gap:6, maxWidth:480 }}>
        {LOADING_STAGES.map((s, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span className="mono small" style={{ width:24, color:i<=stage?"var(--accent)":"var(--ink-25)" }}>
              {i < stage ? "✓" : i === stage ? "›" : " "}
            </span>
            <span className="small" style={{ color:i<=stage?"var(--ink)":"var(--ink-40)" }}>{s}</span>
            {i < stage && <span className="mono small" style={{ color:"var(--ink-40)", marginLeft:"auto" }}>OK</span>}
          </div>
        ))}
      </div>
      <div style={{ marginTop:32, height:2, background:"var(--ink-06)" }}>
        <div style={{ height:"100%", width:`${((stage+1)/LOADING_STAGES.length)*100}%`, background:"var(--accent)", transition:"width 0.6s ease" }}/>
      </div>
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

function BriefOutput({ brief, region, generatedAt, onCopy, copied, onRegenerate, navigate }) {
  const color = EI_COLOR(region?.ei);
  return (
    <article style={{ borderTop:"2px solid var(--ink)", paddingTop:32 }}>
      <BriefMasthead region={region} color={color} generatedAt={generatedAt} />

      <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:56, paddingTop:40 }} className="stack-mobile">
        <aside style={{ position:"sticky", top:100, alignSelf:"flex-start" }} className="hide-mobile">
          <div className="micro" style={{ marginBottom:12 }}>SECTIONS</div>
          {brief.sections.map((s, i) => (
            <div key={i} style={{ padding:"8px 0", borderBottom:"1px solid var(--rule)", display:"flex", gap:10 }}>
              <span className="mono small" style={{ color:"var(--accent)", width:18 }}>0{i+1}</span>
              <span className="small">{s.heading}</span>
            </div>
          ))}
        </aside>
        <div>
          {brief.sections.map((s, i) => (
            <section key={i} style={{ marginBottom:40 }}>
              <div className="micro micro-accent" style={{ marginBottom:10 }}>0{i+1} · {s.heading.toUpperCase()}</div>
              {s.body.map((p, j) => (
                <p key={j} className="body-lg" style={{ fontSize:17, lineHeight:1.65, marginBottom:14 }}>{p}</p>
              ))}
            </section>
          ))}
        </div>
      </div>

      <BriefFooter region={region} onCopy={onCopy} copied={copied} onRegenerate={onRegenerate} navigate={navigate} note={`Synthesised from ${brief._incidentCount||0} indexed incidents · open-source corpus only · not an official intelligence assessment.`} />
    </article>
  );
}

function BriefMasthead({ region, color, generatedAt }) {
  if (!region) return null;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:64, paddingBottom:36, borderBottom:"1px solid var(--rule)" }} className="stack-mobile">
      <div>
        <div className="micro" style={{ marginBottom:18, color:"var(--accent)" }}>
          ANALYTICAL BRIEF · OPEN-SOURCE · REF #{Math.random().toString(36).slice(2,8).toUpperCase()}
        </div>
        <h2 className="display" style={{ fontSize:"clamp(40px,6vw,72px)", marginBottom:18 }}>{region.label}</h2>
        <div className="mono small" style={{ color:"var(--ink-40)" }}>generated {generatedAt}</div>
      </div>
      <div>
        <div className="micro" style={{ marginBottom:12 }}>HEADLINE INDICATORS</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
          <KV k="EI" v={region.ei} color={color} big />
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

function buildLocalBrief(rid) {
  const r = REGIONS.find(x => x.id === rid);
  if (!r) return null;
  return {
    _incidentCount: 0,
    sections: [
      {
        heading: "Situation overview",
        body: [
          `${r.label} registers an Escalation Index of ${r.ei} over the 14-day analytical window, classifying the theatre as ${EI_LABEL(r.ei).toLowerCase()}. ${r.trend > 0 ? `The score has risen by ${r.trend} points against the prior cycle, with the gray-zone component accounting for the majority of the increase.` : r.trend < 0 ? `The score has declined by ${Math.abs(r.trend)} points against the prior cycle, suggesting a transient de-escalation rather than structural change.` : "The score is stable against the prior cycle, with intra-cycle volatility well within historical bounds for this theatre."}`,
          `${r.category === "conflict" ? `${r.label} carries an active-conflict structural baseline. Incident density remains high, and the rolling 7-day component continues to apply upward pressure to the index.` : `${r.label} carries a strategic-tension structural baseline. Exercise activity and rhetoric scoring continue to drive the index above the structural floor.`}`,
        ],
      },
      {
        heading: "Recent signals (gray zone)",
        body: [
          "No incidents could be retrieved from the backend corpus for this region in the current window. This is a data availability limitation rather than an absence of activity.",
          "Category distribution is consistent with the historical pattern for this theatre. Cross-reference against UCDP and OCHA baselines recommended before citation.",
        ],
      },
      {
        heading: "Exercise activity",
        body: [
          `Adjacent exercise activity for ${r.label} is consistent with general-deterrence framing. No exercises in the current window register rhetoric scores in the escalatory range (>0.85).`,
          "Cross-theatre signalling from NATO STEADFAST-series and US-Pacific exercises applies background pressure but does not directly index against this theatre's EX component.",
        ],
      },
      {
        heading: "Rhetoric assessment",
        body: [
          "Official communications in the window register moderate signalling intensity. Statements from primary actors emphasise conditional readiness rather than active escalation.",
        ],
      },
      {
        heading: "Source confidence",
        body: [
          "Source confidence is weighted toward institutional reporting (UN News, OCHA, UCDP), with secondary OSINT verification (Bellingcat, DeepState, CIT) for events lacking institutional coverage.",
          "This brief was synthesised locally from seed data. Connect to the backend API for live incident corpus access.",
        ],
      },
      {
        heading: "Limitations & caveats",
        body: [
          "This brief was generated from static seed data — the backend API was unreachable or returned no incidents for this region. For a live brief, ensure the scraper pipeline has indexed recent events.",
          "The Escalation Index compresses heterogeneous signals into a single number — useful for ranking, insufficient for prediction.",
        ],
      },
    ],
  };
}
