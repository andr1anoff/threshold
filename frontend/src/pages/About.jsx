import { useState } from "react";
import Layout from "../components/Layout";
import Logo from "../components/Logo";

const SOURCES = [
  { name:"OCHA / ReliefWeb", cat:"Institutional", desc:"UN humanitarian and conflict reports by country.", url:"https://reliefweb.int", conf:"High" },
  { name:"UCDP Uppsala",     cat:"Academic",       desc:"Verified armed conflict events, geocoded.", url:"https://ucdp.uu.se", conf:"High" },
  { name:"UN News",          cat:"Institutional", desc:"Official UN press releases: peace & security, regional.", url:"https://news.un.org", conf:"High" },
  { name:"ICRC",             cat:"Institutional", desc:"International Committee of the Red Cross field reporting.", url:"https://icrc.org", conf:"High" },
  { name:"SHAPE NATO",       cat:"Official",       desc:"Supreme HQ Allied Powers Europe: exercise announcements.", url:"https://shape.nato.int", conf:"High" },
  { name:"DeepState",        cat:"OSINT",          desc:"Ukrainian frontline tracker. Used for tactical context.", url:"https://deepstatemap.live", conf:"Medium" },
  { name:"CIT / Leviev",     cat:"OSINT",          desc:"Conflict Intelligence Team. Arms tracking, verified imagery.", url:"https://citeam.org", conf:"Medium" },
  { name:"Bellingcat",       cat:"OSINT",          desc:"Open-source investigation. OSINT verification.", url:"https://bellingcat.com", conf:"Medium" },
  { name:"Guardian API",     cat:"Media",          desc:"International news coverage. Used as secondary reference.", url:"https://open-platform.theguardian.com", conf:"Medium" },
  { name:"Wikipedia Current Events", cat:"Secondary", desc:"Discovery layer only. Not used as primary verification.", url:"https://en.wikipedia.org/wiki/Portal:Current_events", conf:"Low" },
];

const CAT_COLOR = { Institutional:"#2D7A4F", Academic:"#185FA5", Official:"#185FA5", OSINT:"#B07D1A", Media:"#888", Secondary:"rgba(26,16,8,0.35)" };
const CONF_COLOR = { High:"#2D7A4F", Medium:"#B07D1A", Low:"rgba(26,16,8,0.4)" };

const BASELINE_SCALE = [
  { val:"0.03", label:"Low latent tension", ex:"Arctic, Kosovo" },
  { val:"0.05–0.08", label:"Monitored tension", ex:"Baltic, Taiwan Strait" },
  { val:"0.12–0.16", label:"Recurring instability", ex:"Libya, South Caucasus" },
  { val:"0.18–0.22", label:"Active conflict", ex:"Somalia, Ethiopia, Haiti" },
  { val:"0.26–0.30", label:"Acute escalation environment", ex:"Gaza, Ukraine, Sudan" },
];

function Accordion({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border:"1px solid rgba(26,16,8,0.08)", borderRadius:10, overflow:"hidden", marginBottom:8 }}>
      <button onClick={() => setOpen(!open)} style={{
        width:"100%", textAlign:"left", padding:"13px 18px",
        background: open ? "rgba(26,16,8,0.02)" : "#fff",
        border:"none", cursor:"pointer",
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <span style={{ fontSize:13, fontWeight:600, color:"var(--ink)" }}>{title}</span>
        <span style={{ fontSize:16, color:"var(--ink-muted)", transform: open?"rotate(45deg)":"none", transition:"transform .15s" }}>+</span>
      </button>
      {open && (
        <div style={{ padding:"0 18px 16px", fontSize:13, color:"var(--ink-muted)", lineHeight:1.75 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"2px", color:"var(--crimson)", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ display:"inline-block", width:18, height:1.5, background:"var(--crimson)" }}/>
      {children}
    </div>
  );
}

const SIDENAV_STYLE = `
  @media (max-width: 699px) { .about-sidenav { display: none !important; } }
  @media (min-width: 700px) { .about-sidenav { display: block !important; } }
`;

export default function AboutPage() {
  return (
    <Layout>
      <style>{SIDENAV_STYLE}</style>
      <div style={{ display:"flex", gap:0, maxWidth:960, margin:"0 auto", width:"100%" }}>

        {/* Sticky mini-nav — desktop only */}
        <div className="about-sidenav" style={{ width:180, flexShrink:0, paddingTop:36 }}>
          <div style={{ position:"sticky", top:72 }}>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:"2px", color:"var(--ink-muted)", marginBottom:12 }}>ON THIS PAGE</div>
            {[["project","Project Context"],["limitations","Limitations"],["methodology","Methodology"],["sources","Data Sources"],["validation","Validation"],["references","References"],["contact","Contact"]].map(([id,label]) => (
              <a key={id} href={"#"+id} onClick={e=>{ e.preventDefault(); document.getElementById(id)?.scrollIntoView({behavior:"smooth"}); }} style={{ display:"block", fontSize:12, color:"var(--ink-muted)", padding:"5px 0", textDecoration:"none", borderLeft:"2px solid transparent", paddingLeft:8, marginBottom:2, transition:"all .15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.color="var(--crimson)"; e.currentTarget.style.borderLeftColor="var(--crimson)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.color="var(--ink-muted)"; e.currentTarget.style.borderLeftColor="transparent"; }}
              >{label}</a>
            ))}
          </div>
        </div>

      <div style={{ flex:1, padding:"36px 28px 64px", maxWidth:720 }}>

        {/* Hero */}
        <div style={{ marginBottom:48 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
            <Logo size={34}/>
            <div>
              <div style={{ fontSize:20, fontWeight:800, letterSpacing:"2px" }}>THRESHOLD<sup style={{ fontSize:10, fontWeight:500, letterSpacing:"0px", color:"var(--crimson)", marginLeft:3, verticalAlign:"super" }}>β</sup></div>
              <div style={{ fontSize:11, color:"var(--ink-muted)", letterSpacing:"1.5px" }}>GEOPOLITICAL ESCALATION MONITOR</div>
            </div>
          </div>
          <p style={{ fontSize:16, lineHeight:1.75, color:"var(--ink)", maxWidth:580 }}>
            Threshold is an OSINT-based escalation monitoring platform that turns open-source incidents and military exercise signals into structured situational awareness across 20 conflict and strategic tension areas.
          </p>
        </div>

        {/* Project Context */}
        <section id="project" style={{ marginBottom:44 }}>
          <SectionLabel>PROJECT CONTEXT</SectionLabel>
          <div style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.08)", borderRadius:14, padding:24 }}>
            <p style={{ fontSize:14, lineHeight:1.75, color:"var(--ink)", marginBottom:12 }}>
              Developed as part of the MA North American Studies programme at the John F. Kennedy Institute, Freie Universität Berlin. Research project · Summer Term 2026.
            </p>
            <p style={{ fontSize:14, lineHeight:1.75, color:"var(--ink-muted)" }}>
              The platform demonstrates how open-source intelligence (aggregated, LLM-classified, and cross-verified) can produce structured escalation signals without access to classified data.
            </p>
          </div>
        </section>

        {/* Limitations — prominent */}
        <section id="limitations" style={{ marginBottom:44 }}>
          <SectionLabel>LIMITATIONS</SectionLabel>
          <div style={{ background:"rgba(26,16,8,0.02)", border:"1px solid rgba(26,16,8,0.1)", borderRadius:14, padding:24 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--ink)", marginBottom:12 }}>Threshold is not a prediction engine.</div>
            <p style={{ fontSize:13, color:"var(--ink-muted)", lineHeight:1.7, marginBottom:14 }}>
              The Escalation Index is a transparent heuristic indicator designed to compare observable escalation signals across regions. Scores should be interpreted as structured situational awareness, not as forecasts or official risk assessments.
            </p>
            <ul style={{ paddingLeft:18, fontSize:13, color:"var(--ink-muted)", lineHeight:2.1 }}>
              <li>Not classified intelligence. Not statistical forecasting.</li>
              <li>Weights are theory-driven, not statistically estimated from historical data.</li>
              <li>Source availability and update frequency vary significantly across regions.</li>
              <li>Sparse reporting in some regions can depress short-term scores below actual escalation levels.</li>
              <li>AI-generated briefs are analytical summaries, not independent intelligence judgements.</li>
            </ul>
          </div>
        </section>

        {/* Methodology */}
        <section id="methodology" style={{ marginBottom:44 }}>
          <SectionLabel>METHODOLOGY</SectionLabel>
          <div style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.08)", borderRadius:14, padding:24, marginBottom:10 }}>
            <p style={{ fontSize:13, color:"var(--ink-muted)", marginBottom:16, lineHeight:1.7 }}>
              The Escalation Index (EI) is a <strong style={{ color:"var(--ink)" }}>theory-driven composite indicator</strong>, not a statistical factor analysis. Components and weights are selected based on escalation theory and interpretability.
            </p>
            {/* Formula */}
            <div style={{ padding:"14px 18px", background:"rgba(107,26,42,0.04)", border:"1px solid rgba(107,26,42,0.1)", borderRadius:10, fontFamily:"var(--mono)", fontSize:13, color:"var(--ink)", marginBottom:16 }}>
              EI = log(1 + GZ) × 0.45 + EX × 0.35 + BASELINE × 0.20
            </div>
            {/* Weight bars */}
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
              {[["Gray Zone Score","0.45","#8B2030"],["Exercise Signal","0.35","#185FA5"],["Conflict Baseline","0.20","#B07D1A"]].map(([l,w,c])=>(
                <div key={l} style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:12, color:"var(--ink)", width:140, flexShrink:0 }}>{l}</span>
                  <div style={{ flex:1, height:5, background:"rgba(26,16,8,0.06)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${parseFloat(w)*100}%`, background:c, opacity:0.7 }}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:c, width:32, textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{Math.round(parseFloat(w)*100)}%</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize:13, color:"var(--ink-muted)", lineHeight:1.7 }}>
              Gray-zone activity receives the largest weight as the most observable short-term signal. Exercise signaling (0.35) captures military posture given the project's focus on deterrence communication. The baseline (0.20) functions as a structural prior for chronic instability.
            </p>
          </div>

          <Accordion title="Gray Zone Score (45%)">
            Logarithmic normalization of incident frequency and severity over 30 days. Incidents from the last 7 days are double-weighted for recency. Normalized against a 60-point reference scale using <code>log(1+x)</code> — standard for sparse event data, avoids undefined log(0).
            <ul style={{ marginTop:8, paddingLeft:18, lineHeight:2 }}>
              <li>1 — rhetoric, threats, diplomatic escalation</li>
              <li>2 — troop movements, military buildup</li>
              <li>3 — airspace violations, cyberattacks, naval incidents</li>
              <li>4 — attacks with casualties, airstrikes</li>
              <li>5 — full-scale combat, mass casualties, major offensive</li>
            </ul>
          </Accordion>

          <Accordion title="Exercise Signal (35%)">
            Composite of exercise scale (troop count / 80,000) and rhetorical intensity of accompanying statements. Only exercises within ±14 days of the calculation date are included. Rhetoric score ranges from −1.0 (de-escalatory) to +1.0 (highly escalatory).
          </Accordion>

          <Accordion title="Conflict Baseline (20%)">
            A structural prior reflecting chronic conflict intensity. Prevents chronically unstable regions from collapsing to artificially low scores during periods of low reported incident density. Not intended to predict escalation by itself — only anchors the index in the region's structural environment.
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"1.5px", color:"var(--ink-muted)", marginBottom:8 }}>BASELINE SCALE</div>
              <div style={{ display:"grid", gridTemplateColumns:"80px 1fr", gap:"4px 12px" }}>
                {BASELINE_SCALE.map(b => (
                  <>
                    <span key={b.val+"v"} style={{ fontFamily:"var(--mono)", color:"var(--crimson)", fontSize:12, paddingTop:2 }}>{b.val}</span>
                    <span key={b.val+"l"} style={{ fontSize:12, color:"var(--ink)", lineHeight:1.5 }}>
                      <strong style={{ fontWeight:500 }}>{b.label}</strong>
                      <span style={{ color:"var(--ink-muted)", display:"block", fontSize:11 }}>{b.ex}</span>
                    </span>
                  </>
                ))}
              </div>
            </div>
          </Accordion>
        </section>

        {/* Data Sources */}
        <section id="sources" style={{ marginBottom:44 }}>
          <SectionLabel>DATA SOURCES</SectionLabel>
          <p style={{ fontSize:13, color:"var(--ink-muted)", marginBottom:16, lineHeight:1.6 }}>
            Sources are categorised by confidence level. UN, OCHA, and UCDP sources are treated as high-confidence institutional or academic references. OSINT sources are used for tactical context and cross-verification. Wikipedia Current Events is a discovery layer only.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {SOURCES.map(s => (
              <div key={s.name} style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.08)", borderRadius:12, padding:"13px 18px", display:"flex", gap:14, alignItems:"flex-start" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
                  <span style={{ fontSize:8, fontWeight:700, letterSpacing:"1px", padding:"2px 6px", borderRadius:3, background:`${CAT_COLOR[s.cat]}10`, color:CAT_COLOR[s.cat], border:`1px solid ${CAT_COLOR[s.cat]}25` }}>
                    {s.cat.toUpperCase()}
                  </span>
                  <span style={{ fontSize:8, fontWeight:700, letterSpacing:"1px", padding:"2px 6px", borderRadius:3, color:CONF_COLOR[s.conf] }}>
                    {s.conf} confidence
                  </span>
                </div>
                <div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:13, fontWeight:600, color:"var(--ink)", textDecoration:"none" }}>
                    {s.name} ↗
                  </a>
                  <div style={{ fontSize:12, color:"var(--ink-muted)", marginTop:2, lineHeight:1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Validation Roadmap */}
        <section id="validation" style={{ marginBottom:44 }}>
          <SectionLabel>VALIDATION ROADMAP</SectionLabel>
          <div style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.08)", borderRadius:14, padding:24 }}>
            <p style={{ fontSize:13, color:"var(--ink-muted)", lineHeight:1.75 }}>
              Future iterations should include backtesting against known escalation episodes, sensitivity analysis of component weights, and case comparisons across regions such as Ukraine, Taiwan, the Red Sea, and Israel/Iran. Additional steps may include expert review of baseline values and calibration of the exercise rhetoric scoring rubric.
            </p>
          </div>
        </section>

        {/* References */}
        <section id="references" style={{ marginBottom:44 }}>
          <SectionLabel>REFERENCES</SectionLabel>
          <div style={{ background:"#fff", border:"1px solid rgba(26,16,8,0.08)", borderRadius:14, padding:24 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[
                { authors:"Fearon, J. D.", year:"1995", title:"Rationalist Explanations for War", journal:"International Organization, 49(3), 379–414" },
                { authors:"Schelling, T. C.", year:"1960", title:"The Strategy of Conflict", journal:"Harvard University Press" },
                { authors:"Powell, R.", year:"2003", title:"Nuclear Deterrence Theory, Nuclear Proliferation, and National Missile Defense", journal:"International Security, 27(4), 86–118" },
                { authors:"Ritter, J. M. & Wolford, S.", year:"2012", title:"Bargaining and the Inefficiency of Conflict", journal:"Journal of Theoretical Politics, 24(4), 496–514" },
                { authors:"UCDP", year:"2024", title:"Uppsala Conflict Data Program Codebook, v24.1", journal:"Uppsala University, Department of Peace and Conflict Research" },
                { authors:"OCHA", year:"2024", title:"ReliefWeb Crisis Data Methodology", journal:"United Nations Office for the Coordination of Humanitarian Affairs" },
              ].map((ref, i) => (
                <div key={i} style={{ paddingBottom:10, borderBottom:"1px solid rgba(26,16,8,0.06)", display:"flex", gap:16 }}>
                  <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--crimson)", flexShrink:0, paddingTop:2 }}>[{String(i+1).padStart(2,"0")}]</span>
                  <div>
                    <span style={{ fontSize:13, color:"var(--ink)", fontWeight:500 }}>{ref.authors} ({ref.year}). </span>
                    <span style={{ fontSize:13, color:"var(--ink)", fontStyle:"italic" }}>{ref.title}. </span>
                    <span style={{ fontSize:12, color:"var(--ink-55)" }}>{ref.journal}.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact">
          <SectionLabel>CONTACT</SectionLabel>
          <div style={{ background:"linear-gradient(135deg, var(--crimson) 0%, #3D0A14 100%)", borderRadius:14, padding:"28px 24px" }}>
            <div style={{ fontSize:20, fontWeight:800, color:"#fff", marginBottom:8 }}>Questions or collaboration?</div>
            <p style={{ fontSize:13, color:"rgba(245,240,232,0.6)", marginBottom:18, lineHeight:1.6 }}>
              For methodological inquiries, data access, or academic collaboration:
            </p>
            <a href="mailto:ivaa03@zedat.fu-berlin.de" style={{ display:"inline-block", background:"#fff", color:"var(--crimson)", fontSize:13, fontWeight:700, padding:"10px 22px", borderRadius:999, textDecoration:"none" }}>
              Email us
            </a>
          </div>
        </section>

      </div>
      </div>
    </Layout>
  );
}
