import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import Logo from "./Logo";
const STRANGELOVE_IMG = "/strangelove.png";

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

const SOURCES = ["ReliefWeb/OCHA","UCDP Uppsala","Wikipedia","UN News","GDELT","DeepState","CIT Leviev","SHAPE NATO"];

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
          <span style={{ fontSize:13, fontWeight:700, letterSpacing:"3px", color:"var(--ink)" }}>THRESHOLD<sup style={{ fontSize:8, fontWeight:500, letterSpacing:"0px", color:"var(--crimson)", marginLeft:3, verticalAlign:"super" }}>β</sup></span>
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

        {/* About link */}
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
              <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"flex-start", gap:6 }}>
                {SOURCES.map(s=>(
                  <span key={s} style={{
                    display:"inline-block",
                    borderRadius:999,
                    background:"rgba(245,240,232,0.07)",
                    border:"1px solid rgba(245,240,232,0.12)",
                    padding:"3px 10px",
                    fontSize:11,
                    color:"rgba(245,240,232,0.5)",
                    letterSpacing:"0.04em",
                  }}>
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
            <span style={{ display:"flex", gap:14 }}>
              <Link to="/impressum" style={{ color:"rgba(245,240,232,0.45)", textDecoration:"none" }}>Impressum</Link>
              <Link to="/datenschutz" style={{ color:"rgba(245,240,232,0.45)", textDecoration:"none" }}>Datenschutz</Link>
            </span>
            <span style={{ fontFamily:"var(--mono)" }}>v15.3β · threshold-osint.com</span>
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
