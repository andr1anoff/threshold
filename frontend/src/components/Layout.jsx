import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Logo from "./Logo";

function UtcClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return (
    <span className="mono" style={{ fontSize:11, letterSpacing:"0.05em", color:"var(--ink-55)" }}>
      {hh}<span className="blink" style={{ opacity:0.5 }}>:</span>{mm}<span className="blink" style={{ opacity:0.5 }}>:</span>{ss}
      <span style={{ marginLeft:5, fontSize:"0.85em", color:"var(--ink-40)" }}>UTC</span>
    </span>
  );
}

const NAV = [
  { label:"Overview",  path:"/" },
  { label:"Incidents", path:"/incidents" },
  { label:"War Room",  path:"/warroom" },
  { label:"Briefs",    path:"/briefs" },
];

const SOURCES = ["ReliefWeb/OCHA","UCDP Uppsala","Wikipedia","UN News","GDELT","DeepState","CIT Leviev","SHAPE NATO"];

export default function Layout({ children }) {
  const loc = useLocation();
  const isWarRoom = loc.pathname === "/warroom";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100dvh", background:"var(--cream)", maxWidth:"100vw", overflowX:"hidden" }}>

      {/* HEADER */}
      <header role="banner" style={{
        position:"sticky", top:0, zIndex:100,
        background:"color-mix(in oklab, var(--cream) 92%, transparent)",
        backdropFilter:"blur(8px)",
        WebkitBackdropFilter:"blur(8px)",
        borderBottom:"1px solid var(--ink-faint)",
        display:"flex", alignItems:"center",
        padding:"0 16px", height:60, gap:12, flexShrink:0,
        maxWidth:"100vw",
      }}>
        <Link to="/" style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none", flexShrink:0 }} aria-label="Threshold home">
          <Logo size={20}/>
          <span style={{ fontSize:13, fontWeight:700, letterSpacing:"3px", color:"var(--ink)" }}>THRESHOLD<sup style={{ fontSize:8, fontWeight:500, letterSpacing:"0px", color:"var(--crimson)", marginLeft:3, verticalAlign:"super" }}>β</sup></span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" style={{ display:"flex", gap:2, flex:1 }}>
          {NAV.map(n => {
            const isActive = n.path==="/" ? loc.pathname==="/" : loc.pathname===n.path;
            return (
              <Link key={n.path} to={n.path}
                aria-current={isActive?"page":undefined}
                style={{
                  fontSize:12, fontWeight:isActive?600:400,
                  color: isActive ? "var(--ink)" : "var(--ink-muted)",
                  padding:"5px 10px", textDecoration:"none",
                  background:"transparent",
                  border:"none",
                  borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  whiteSpace:"nowrap", display:"none",
                  marginBottom:-1,
                }}
                className="desktop-nav-link"
              >{n.label}</Link>
            );
          })}
        </nav>

        {/* Live indicator + UTC clock — desktop only */}
        <div className="hide-mobile" style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <span className="pulse"/>
          <span className="micro" style={{ fontSize:10, color:"var(--ink-55)" }}>LIVE</span>
          <UtcClock />
        </div>

        {/* About link */}
        <Link to="/about" className="btn-ghost hide-mobile" style={{ flexShrink:0, fontSize:12, padding:"6px 12px" }}>About →</Link>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(o=>!o)}
          aria-expanded={menuOpen}
          aria-label={menuOpen?"Close menu":"Open menu"}
          style={{
            background:"none", border:"1px solid var(--ink-faint)", borderRadius:6,
            padding:"6px 8px", cursor:"pointer", display:"flex", flexDirection:"column",
            gap:4, alignItems:"center", justifyContent:"center", flexShrink:0,
          }}
          className="hamburger-btn"
        >
          {[0,1,2].map(i=>(
            <div key={i} style={{
              width:18, height:1.5, background:"var(--ink)", borderRadius:1, transition:"all .2s",
              transform: menuOpen ? (i===0?"rotate(45deg) translate(4px,4px)":i===2?"rotate(-45deg) translate(4px,-4px)":"scaleX(0)") : "none",
            }}/>
          ))}
        </button>
      </header>

      {/* Mobile drawer — above everything including map */}
      {menuOpen && (
        <div style={{
          position:"fixed", top:60, left:0, right:0, bottom:0,
          background:"var(--cream)", zIndex:200,
          padding:"8px 0", display:"flex", flexDirection:"column",
          borderTop:"1px solid var(--ink-faint)",
          overflowY:"auto",
        }}>
          {NAV.map(n => {
            const isActive = n.path==="/" ? loc.pathname==="/" : loc.pathname===n.path;
            return (
              <Link key={n.path} to={n.path} onClick={()=>setMenuOpen(false)}
                style={{
                  fontSize:16, fontWeight:isActive?700:400,
                  color:isActive?"var(--ink)":"var(--ink-muted)",
                  padding:"14px 24px", textDecoration:"none",
                  borderBottom:"1px solid var(--ink-faint)",
                  borderLeft:isActive?"3px solid var(--crimson)":"3px solid transparent",
                }}>
                {n.label}
              </Link>
            );
          })}
          <Link to="/about" onClick={()=>setMenuOpen(false)}
            style={{
              fontSize:16, fontWeight:400, color:"var(--ink-muted)",
              padding:"14px 24px", textDecoration:"none",
              borderBottom:"1px solid var(--ink-faint)",
              borderLeft:"3px solid transparent",
            }}>
            About
          </Link>
        </div>
      )}

      <main style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, overflowX:"hidden" }}>
        {children}
      </main>

      {!isWarRoom && (
        <footer role="contentinfo" style={{
          background:"var(--ink)", color:"rgba(245,240,232,0.5)",
          padding:"28px 20px 20px", flexShrink:0,
          paddingBottom:"calc(20px + env(safe-area-inset-bottom))",
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:20, marginBottom:20 }}>
            <div style={{ minWidth:220 }}>
              <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:8 }}>
                <Logo size={18} white/>
                <span style={{ fontSize:12, fontWeight:700, letterSpacing:"3px", color:"#fff" }}>THRESHOLD</span>
              </div>
              <p style={{ fontSize:12, lineHeight:1.7, maxWidth:300, color:"rgba(245,240,232,0.4)" }}>
                OSINT-based escalation monitoring. Sources include official releases, institutional datasets, open-source reporting, and secondary references.
              </p>
            </div>
            <div>
              <div style={{ fontSize:10, letterSpacing:"2px", fontWeight:600, color:"rgba(245,240,232,0.25)", marginBottom:8 }}>DATA SOURCES</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"5px 14px" }}>
                {SOURCES.map(s=>(
                  <span key={s} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"rgba(245,240,232,0.4)" }}>
                    <span style={{ width:4, height:4, borderRadius:"50%", background:"#2D7A4F", flexShrink:0 }}/>
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize:10, letterSpacing:"2px", fontWeight:600, color:"rgba(245,240,232,0.25)", marginBottom:8 }}>PROJECT</div>
              <div style={{ fontSize:11, lineHeight:2, color:"rgba(245,240,232,0.4)" }}>
                <div>JFKI · Freie Universität Berlin</div>
                <div>North American Studies MA</div>
                <div>Research project · Summer Term 2026</div>
              </div>
            </div>
          </div>
          <div style={{ borderTop:"1px solid rgba(245,240,232,0.08)", paddingTop:16, display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, fontSize:10, color:"rgba(245,240,232,0.2)" }}>
            <span>© 2026 Threshold · Research indicator — not an official intelligence assessment.</span>
            <span style={{ fontFamily:"var(--mono)" }}>v0.9 · threshold-lyart.vercel.app</span>
          </div>
        </footer>
      )}

      <style>{`
        @media (min-width: 700px) {
          .desktop-nav-link { display: block !important; }
          .hamburger-btn { display: none !important; }
        }
        @media (max-width: 699px) {
          .desktop-nav-link { display: none !important; }
          .hamburger-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
