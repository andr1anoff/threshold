import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import Logo from "./Logo";

/* Flip to false when Threshold leaves beta — removes the β from both the
   header wordmark and the footer version string. Nothing else to change. */
const IS_BETA = true;
const VERSION = "v1.8.1";

const STRANGELOVE_IMG = "/strangelove.png";
const CONTACT_EMAIL = "contact@threshold-osint.com";
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;

const CONTACT_BUTTON_STYLE = {
  display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
  flexShrink:0, fontSize:12, fontWeight:700, color:"#fff",
  padding:"6px 12px", textDecoration:"none", whiteSpace:"nowrap",
  border:"1px solid rgba(245,240,232,0.16)", borderRadius:"var(--r-md)",
  background:"linear-gradient(135deg, var(--crimson) 0%, #3D0A14 100%)",
  boxShadow:"0 8px 24px rgba(107,26,42,0.18)",
  transition:"filter 0.12s ease, box-shadow 0.2s ease, scale 0.1s ease",
};

// Module-level: persists across Layout remounts when navigating between pages
let _warRoomClicks = 0;
let _warRoomTimer = null;

function StrangeloveModal({ onClose }) {
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"rgba(0,0,0,0.92)",
      display:"flex", alignItems:"center", justifyContent:"center",
      cursor:"pointer",
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#080808",
        border:"1px solid rgba(107,26,42,0.55)",
        borderRadius:4,
        padding:"20px 24px",
        maxWidth:600,
        width:"calc(100vw - 48px)",
        position:"relative",
      }}>
        <button onClick={onClose} style={{
          position:"absolute", top:10, right:14,
          background:"none", border:"none",
          color:"rgba(245,240,232,0.35)",
          fontSize:17, cursor:"pointer", lineHeight:1,
          padding:0,
        }}>✕</button>
        <img src={STRANGELOVE_IMG} style={{
          width:"100%", display:"block", marginBottom:14,
        }} alt="Dr. Strangelove" />
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          borderTop:"1px solid rgba(107,26,42,0.25)", paddingTop:12,
        }}>
          <div style={{
            fontFamily:"'DM Mono', monospace", fontSize:9,
            letterSpacing:"0.14em", textTransform:"uppercase",
            color:"rgba(107,26,42,0.85)",
          }}>Threshold</div>
          <div style={{
            fontFamily:"'DM Mono', monospace", fontSize:10,
            color:"rgba(200,190,175,0.5)", fontStyle:"italic",
          }}>"Gentlemen, you can't fight in here. This is the War Room."</div>
        </div>
      </div>
    </div>
  );
}


function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    // Default is LIGHT. Dark only if user explicitly chose it.
    return localStorage.getItem("threshold-dark") === "1";
  });
  useEffect(() => {
    document.body.classList.toggle("dark-mode", dark);
    localStorage.setItem("threshold-dark", dark ? "1" : "0");
  }, [dark]);
  return [dark, setDark];
}

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
  { label:"Exercises", path:"/exercises" },
  { label:"War Room",  path:"/warroom" },
  { label:"Briefs",    path:"/briefs" },
];

export default function Layout({ children }) {
  const loc = useLocation();
  const isWarRoom = loc.pathname === "/warroom";
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useDarkMode();
  const [strangelove, setStrangelove] = useState(false);

  function handleWarRoomClick(e) {
    _warRoomClicks += 1;
    clearTimeout(_warRoomTimer);
    if (_warRoomClicks >= 3) {
      _warRoomClicks = 0;
      e.preventDefault();
      setStrangelove(true);
    } else {
      _warRoomTimer = setTimeout(() => { _warRoomClicks = 0; }, 6000);
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100dvh", background:"var(--cream)", maxWidth:"100vw", overflowX:"hidden" }}>

      {strangelove && createPortal(
        <StrangeloveModal onClose={() => setStrangelove(false)} />,
        document.body
      )}

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
          <span style={{ fontSize:13, fontWeight:700, letterSpacing:"3px", color:"var(--ink)" }}>
            THRESHOLD
            {IS_BETA && (
              <sup style={{
                fontSize:8, fontWeight:600, letterSpacing:"0",
                color:"var(--crimson)", marginLeft:"2px",
                verticalAlign:"super", lineHeight:0,
                fontFamily:"var(--sans)",
              }}>β</sup>
            )}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" style={{ display:"flex", gap:2, flex:1 }}>
          {NAV.map(n => {
            const isActive = n.path==="/" ? loc.pathname==="/" : loc.pathname===n.path;
            return (
              <Link key={n.path} to={n.path}
                aria-current={isActive?"page":undefined}
                onClick={n.path==="/warroom" ? handleWarRoomClick : undefined}
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

        {/* Contact + About links */}
        <a href={CONTACT_MAILTO} className="hide-mobile" style={CONTACT_BUTTON_STYLE}>Contact us</a>
        <Link to="/about" className="btn-ghost hide-mobile" style={{ flexShrink:0, fontSize:12, padding:"6px 12px" }}>About →</Link>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDark(d => !d)}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={dark ? "Light mode" : "Dark mode"}
          style={{
            background:"none", border:"1px solid var(--ink-faint)", borderRadius:6,
            padding:"6px 8px", cursor:"pointer", flexShrink:0,
            fontSize:13, lineHeight:1, color:"var(--ink-55)",
            transition:"all 0.15s",
          }}
          className="hide-mobile"
        >
          {dark ? "☀" : "◑"}
        </button>

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
              <Link key={n.path} to={n.path} onClick={()=>{ setMenuOpen(false); if(n.path==="/warroom") handleWarRoomClick(); }}
                style={{
                  fontSize:18, fontWeight:isActive?700:500,
                  color:isActive?"var(--ink)":"var(--ink-55)",
                  padding:"16px 24px", textDecoration:"none",
                  borderBottom:"1px solid var(--ink-faint)",
                  borderLeft:isActive?"3px solid var(--crimson)":"3px solid transparent",
                  display:"block",
                }}>
                {n.label}
              </Link>
            );
          })}
          <Link to="/about" onClick={()=>setMenuOpen(false)}
            style={{
              fontSize:18, fontWeight:500, color:"var(--ink-55)",
              padding:"16px 24px", textDecoration:"none",
              borderBottom:"1px solid var(--ink-faint)",
              borderLeft:"3px solid transparent",
              display:"block",
            }}>
            About
          </Link>
          <a href={CONTACT_MAILTO} onClick={()=>setMenuOpen(false)}
            style={{
              margin:"12px 24px", ...CONTACT_BUTTON_STYLE,
              fontSize:16, padding:"12px 18px",
            }}>
            Contact us
          </a>
          {/* Dark mode toggle in mobile menu */}
          <button onClick={()=>{ setDark(d=>!d); }}
            style={{
              fontSize:16, fontWeight:500, color:"var(--ink-55)",
              padding:"16px 24px", textDecoration:"none",
              borderBottom:"1px solid var(--ink-faint)",
              borderLeft:"3px solid transparent",
              background:"none", border:"none",
              borderBottom:"1px solid var(--ink-faint)",
              width:"100%", textAlign:"left", cursor:"pointer",
              display:"flex", alignItems:"center", gap:12,
            }}>
            <span style={{ fontSize:18 }}>{dark ? "☀" : "◑"}</span>
            {dark ? "Light mode" : "Dark mode"}
          </button>
        </div>
      )}

      <main style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, overflowX:"hidden" }}>
        {children}
      </main>

      {!isWarRoom && (
        <footer role="contentinfo" style={{
          background:"#0F0B07", color:"rgba(245,240,232,0.5)",
          padding:"32px 20px 20px", flexShrink:0,
          paddingBottom:"calc(20px + env(safe-area-inset-bottom))",
        }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:"24px 32px", alignItems:"start", marginBottom:24, maxWidth:1200, marginLeft:"auto", marginRight:"auto" }}>

            <div style={{ gridColumn:"span 1", minWidth:220 }}>
              <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:10 }}>
                <Logo size={18} white/>
                <span style={{ fontSize:12, fontWeight:700, letterSpacing:"3px", color:"#fff" }}>THRESHOLD</span>
              </div>
              <p style={{ fontSize:12, lineHeight:1.7, maxWidth:280, color:"rgba(245,240,232,0.42)", textWrap:"pretty" }}>
                OSINT-based escalation monitoring. Sources include official releases, institutional datasets, open-source reporting, and secondary references.
              </p>
            </div>

            <div>
              <div style={{ fontSize:10, letterSpacing:"2px", fontWeight:600, color:"rgba(245,240,232,0.28)", marginBottom:10 }}>NAVIGATE</div>
              <div style={{ display:"flex", flexDirection:"column" }}>
                {[...NAV, { label:"About & methodology", path:"/about" }].map(n => (
                  <Link key={n.path} to={n.path} className="ft-a" style={{ fontSize:12, padding:"5px 0", lineHeight:1.4, display:"inline-block", width:"fit-content" }}>{n.label}</Link>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize:10, letterSpacing:"2px", fontWeight:600, color:"rgba(245,240,232,0.28)", marginBottom:10 }}>PROJECT</div>
              <div style={{ display:"flex", flexDirection:"column", fontSize:12, color:"rgba(245,240,232,0.42)" }}>
                <span style={{ padding:"5px 0", lineHeight:1.4 }}>JFKI · Freie Universität Berlin</span>
                <span style={{ padding:"5px 0", lineHeight:1.4 }}>North American Studies MA</span>
                <span style={{ padding:"5px 0", lineHeight:1.4 }}>Research project · Summer Term 2026</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize:10, letterSpacing:"2px", fontWeight:600, color:"rgba(245,240,232,0.28)", marginBottom:10 }}>DATA</div>
              <p style={{ fontSize:12, lineHeight:1.7, color:"rgba(245,240,232,0.42)", margin:0, padding:"5px 0 8px", textWrap:"pretty", maxWidth:250 }}>
                38 curated feeds across 20 theatres, anchored by UCDP, ReliefWeb, and UN reporting.
              </p>
              <Link to="/about#sources" className="ft-a" style={{ fontSize:12, color:"rgba(245,240,232,0.65)", borderBottom:"1px solid rgba(139,32,48,0.9)", paddingBottom:2, display:"inline-block", lineHeight:1.4 }}>
                Full source list →
              </Link>
              <div style={{ display:"flex", gap:18, marginTop:10 }}>
                <a href="https://evandrianov.pro/" target="_blank" rel="noopener noreferrer" className="ft-a" style={{ fontSize:12, padding:"5px 0" }}>Founder ↗</a>
                <a href="https://evandrianov.substack.com" target="_blank" rel="noopener noreferrer" className="ft-a" style={{ fontSize:12, padding:"5px 0" }}>Substack ↗</a>
              </div>
            </div>
          </div>

          <div style={{ borderTop:"1px solid rgba(245,240,232,0.08)", paddingTop:14, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, fontSize:10, color:"rgba(245,240,232,0.22)", maxWidth:1200, margin:"0 auto" }}>
            <span style={{ display:"flex", alignItems:"center", flexWrap:"wrap", columnGap:4 }}>
              <span>© 2026 Threshold · Research indicator — not an official intelligence assessment.</span>
              <span style={{ display:"flex", alignItems:"center" }}>
                <span style={{ margin:"0 6px", color:"rgba(245,240,232,0.15)" }}>·</span>
                <Link to="/impressum" className="ft-a" style={{ padding:"8px 6px" }}>Impressum</Link>
                <span style={{ margin:"0 2px", color:"rgba(245,240,232,0.15)" }}>·</span>
                <Link to="/datenschutz" className="ft-a" style={{ padding:"8px 6px" }}>Datenschutz</Link>
              </span>
            </span>
            <span style={{ fontFamily:"var(--mono)" }}>{VERSION}{IS_BETA && "β"} · threshold-osint.com</span>
          </div>
        </footer>
      )}

      <style>{`
        .ft-a { color: rgba(245,240,232,0.55); text-decoration: none; transition: color .15s ease; }
        .ft-a:hover { color: #fff; }
        .ft-a:focus-visible { color: #fff; outline: 1px solid rgba(245,240,232,0.4); outline-offset: 2px; border-radius: 2px; }
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
