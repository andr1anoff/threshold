import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Layout from "../components/Layout";
import AnimatedNumber from "../components/AnimatedNumber";

const API = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

const TYPE_DESC = {
  LIVEX:"Live Exercise — real troops, equipment, field operations",
  CPX:  "Command Post Exercise — HQ/staff, simulated forces",
  MAREX:"Maritime Exercise — naval-focused operations",
  ADEX: "Air Defence Exercise", FTX:"Field Training Exercise", TTX:"Tabletop Exercise",
};

const VIEWPORTS = {
  "STEADFAST DETERRENCE":{ bounds:[[52,5],[72,35]] },
  "DYNAMIC MONGOOSE":    { bounds:[[52,-25],[75,20]] },
  "AURORA":              { bounds:[[54,10],[68,28]] },
  "NEPTUNE STRIKE":      { bounds:[[30,-6],[46,32]] },
  "IRON UNION":          { bounds:[[25,28],[40,48]] },
  "TALISMAN SABRE":      { bounds:[[-35,130],[-5,165]] },
  "RIMPAC":              { bounds:[[15,-175],[32,-140]] },
  "STEADFAST DEFENDER":  { bounds:[[48,5],[70,38]] },
  "CYBER COALITION":     { center:[59.5,24.7], zoom:5 },
  "STEADFAST DART":      { bounds:[[38,20],[52,32]] },
};

const MARKER_POS = {
  "STEADFAST DETERRENCE":[59,20], "DYNAMIC MONGOOSE":[63,-8],
  "AURORA":[60,18], "NEPTUNE STRIKE":[37,13], "IRON UNION":[32,35],
  "TALISMAN SABRE":[-22,148], "RIMPAC":[21,-157],
  "STEADFAST DEFENDER":[55,24], "CYBER COALITION":[59.5,24.7], "STEADFAST DART":[44,26],
};

const THEATRES = [
  { coords:[[54,10],[54,30],[65,30],[65,10]], color:"rgba(139,32,48,0.06)", border:"rgba(139,32,48,0.15)" },
  { coords:[[0,105],[0,122],[22,122],[22,105]], color:"rgba(24,95,165,0.06)", border:"rgba(24,95,165,0.15)" },
  { coords:[[75,-30],[75,60],[90,60],[90,-30]], color:"rgba(148,163,184,0.06)", border:"rgba(148,163,184,0.12)" },
  { coords:[[30,-5],[30,36],[46,36],[46,-5]], color:"rgba(24,95,165,0.04)", border:"rgba(24,95,165,0.10)" },
  { coords:[[20,28],[20,58],[37,58],[37,28]], color:"rgba(176,125,26,0.06)", border:"rgba(176,125,26,0.15)" },
];

// ±14 day window
const WINDOW_START = new Date(Date.now() - 14*86400000).toISOString().slice(0,10);
const WINDOW_END   = new Date(Date.now() + 14*86400000).toISOString().slice(0,10);

function inWindow(ex) {
  const s = ex.start_date || "";
  const e = ex.end_date || ex.start_date || "";
  return s <= WINDOW_END && e >= WINDOW_START;
}

function getPos(name) {
  const u = name.toUpperCase();
  for (const [k,v] of Object.entries(MARKER_POS)) { if (u.includes(k)) return v; }
  if (u.includes("PACIFIC")||u.includes("INDO")) return [-10,140];
  if (u.includes("ARCTIC")) return [70,15];
  if (u.includes("BALTIC")||u.includes("NORDIC")) return [58,20];
  if (u.includes("MED")) return [36,14];
  return [30,15];
}

function getViewport(name) {
  const u = name.toUpperCase();
  for (const [k,v] of Object.entries(VIEWPORTS)) { if (u.includes(k)) return v; }
  const [lat,lng] = getPos(name);
  return { center:[lat,lng], zoom:4 };
}

function getColor(ex) {
  const l = (ex.lead_nation||"").toLowerCase();
  if (l.includes("nato")||l.includes("shape")) return {bg:"rgba(139,32,48,0.10)",border:"rgba(139,32,48,0.25)",text:"#8B2030",marker:"#8B2030"};
  if (l.includes("russia")||l.includes("china")) return {bg:"rgba(61,18,25,0.10)",border:"rgba(61,18,25,0.25)",text:"#3D1219",marker:"#3D1219"};
  if (l.includes("sweden")||l.includes("finland")||l.includes("national")) return {bg:"rgba(59,109,17,0.10)",border:"rgba(59,109,17,0.25)",text:"#3B6D11",marker:"#3B6D11"};
  return {bg:"rgba(24,95,165,0.10)",border:"rgba(24,95,165,0.25)",text:"#185FA5",marker:"#185FA5"};
}

function getBadge(ex) {
  const l = (ex.lead_nation||"").toLowerCase();
  if (l.includes("nato")||l.includes("shape")) return "NATO";
  if (l.includes("russia")||l.includes("china")) return "RUS/CHN";
  if (l.includes("sweden")||l.includes("finland")) return "NATIONAL";
  return "MULTILATERAL";
}

function getRhetColor(score, target) {
  if (!target||target==="General deterrence") return "rgba(26,16,8,0.45)";
  if (score>=0.7) return "#8B2030"; if (score>=0.5) return "#C0622B";
  return "rgba(26,16,8,0.45)";
}

// UI chrome reads from theme variables (so the page flips correctly in dark mode).
// Map geometry colours (markers/theatres) stay as concrete hex — Leaflet needs real colours.
const CREAM="var(--cream)", INK="var(--ink)", MUTED="var(--ink-muted)", FAINT="var(--ink-faint)", CRIMSON="var(--crimson)";

function ExerciseDetail({ ex, color, onClose }) {
  if (!ex) return null;
  const rows = [
    ["TYPE",    TYPE_DESC[ex.exercise_type] || ex.exercise_type],
    ["LEAD",    ex.lead_nation],
    ["DOMAIN",  ex.domain],
    ["THEATRE", ex.region],
    ["WINDOW",  `${ex.start_date} — ${ex.end_date}`],
    ["SCALE",   ex.scale ? `${ex.scale.toLocaleString()} personnel` : "Command post"],
    ["SIGNAL",  ex.signal_target],
    ["RHETORIC",ex.rhetoric_score != null ? ex.rhetoric_score.toFixed(2) : "—"],
  ];
  return (
    <div style={{ padding:"12px 20px 14px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
        <span className="micro" style={{ color }}>{getBadge({ lead_nation: ex.lead_nation })}</span>
        <span style={{ flex:1, height:1, background:color, opacity:0.4 }}/>
        {onClose && (
          <button onClick={onClose} style={{ background:"transparent", border:0, cursor:"pointer", color:"var(--ink-55)", padding:2, lineHeight:1, fontSize:14 }}>✕</button>
        )}
      </div>
      <div style={{ fontSize:15, fontWeight:700, marginBottom:10, lineHeight:1.25 }}>{ex.name}</div>
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:14, rowGap:0 }}>
        {rows.map(([k,v]) => (
          <React.Fragment key={k}>
            <div className="micro" style={{ fontSize:9, padding:"4px 0", borderBottom:"1px dotted var(--ink-10)", alignSelf:"baseline" }}>{k}</div>
            <div className="mono" style={{ fontSize:11, color:"var(--ink)", textAlign:"right", lineHeight:1.4, padding:"4px 0", borderBottom:"1px dotted var(--ink-10)" }}>{v}</div>
          </React.Fragment>
        ))}
      </div>
      {ex.statements?.raw_summary && (
        <p className="small" style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--rule)", color:"var(--ink-55)", fontSize:12, lineHeight:1.45 }}>
          {ex.statements.raw_summary}
        </p>
      )}
      {ex.source_url && (
        <a href={ex.source_url} target="_blank" rel="noopener noreferrer" className="micro micro-accent" style={{ display:"inline-block", marginTop:10, paddingBottom:2, borderBottom:"1px solid var(--accent)" }}>
          Primary source ↗
        </a>
      )}
    </div>
  );
}

function BigStat({ n, label, emphasis, format }) {
  return (
    <div style={{ textAlign:"right" }}>
      <div className="tab-num" style={{ fontSize:30, fontWeight:700, letterSpacing:"-0.03em", lineHeight:1, color:emphasis?"var(--accent)":"var(--ink)" }}>
        <AnimatedNumber value={n} duration={1300} format={format||(v=>v.toLocaleString())} />
      </div>
      <div className="micro" style={{ marginTop:6 }}>{label}</div>
    </div>
  );
}

export default function WarRoom() {
  const mapDiv   = useRef(null);
  const mapRef   = useRef(null);
  const [sel, setSel]           = useState(null);
  const [hovered, setHovered]   = useState(null);
  const [exercises, setExercises] = useState([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);
  const [mobileTab, setMobileTab] = useState("map");
  const [showSheet, setShowSheet] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700);
  const [filter, setFilter] = useState("active");
  const [domain, setDomain] = useState("all");

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    fetch(`${API}/api/exercises/`)
      .then(r=>r.json())
      .then(d=>{ if(d.data?.length) setExercises(d.data); })
      .catch(()=>{});
  }, []);

  // Load Leaflet once
  useEffect(() => {
    if (window.L) { initMap(); return; }
    const css = document.createElement('link');
    css.rel='stylesheet'; css.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = initMap;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (mapRef.current && mapLoaded) addMarkers();
  }, [exercises, mapLoaded, sel, hovered]);

  function initMap() {
    if (!mapDiv.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(mapDiv.current, {
      center:[30,15], zoom:2, minZoom:2, maxZoom:7,
      zoomControl:false,
      scrollWheelZoom:false,
      doubleClickZoom:false,
      touchZoom:true,
      dragging:true,
      tap:true,
      attributionControl:false,
    });
    L.control.zoom({position:'bottomright'}).addTo(map);
    const isDark = document.body.classList.contains('dark-mode');
    if (isDark) {
      // Dark/night map tile
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',{maxZoom:7,subdomains:'abcd'}).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',{maxZoom:7,subdomains:'abcd',opacity:0.5}).addTo(map);
    } else {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{maxZoom:7,subdomains:'abcd'}).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',{maxZoom:7,subdomains:'abcd',opacity:0.35}).addTo(map);
    }
    for (let i=-90;i<=90;i+=15) L.polyline([[-85,i],[85,i]],{color:'rgba(107,26,42,0.05)',weight:0.4}).addTo(map);
    for (let i=-180;i<=180;i+=30) L.polyline([[-85,i],[85,i]],{color:'rgba(107,26,42,0.05)',weight:0.4}).addTo(map);
    L.polyline([[-85,0],[85,0]],{color:'rgba(107,26,42,0.10)',weight:0.7,dashArray:'5,5'}).addTo(map);
    THEATRES.forEach(t=>L.polygon(t.coords,{fillColor:t.color,fillOpacity:1,color:t.border,weight:1,dashArray:'4,4',interactive:false}).addTo(map));
    map.on('dragstart',()=>setMapMoved(true));
    mapRef.current = map;
    setMapLoaded(true);
  }

  useEffect(() => {
    if (mobileTab==="map" && mapRef.current) {
      setTimeout(()=>mapRef.current?.invalidateSize(), 200);
    }
  }, [mobileTab]);

  // When viewport crosses the mobile breakpoint, the map div swaps between
  // desktop and mobile layouts. Destroy the old Leaflet instance so initMap()
  // can re-attach to whichever div is now mounted.
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      setMapLoaded(false);
    }
    const t = setTimeout(() => { if (window.L) initMap(); }, 100);
    return () => clearTimeout(t);
  }, [isMobile]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && mapRef.current) {
        setTimeout(() => mapRef.current?.invalidateSize(), 150);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const flyTo = useCallback((ex) => {
    const map = mapRef.current; const L = window.L;
    if (!map||!L) return;
    const vp = getViewport(ex.name);
    if (vp.bounds) map.flyToBounds(vp.bounds,{padding:[60,60],duration:0.9,animate:true});
    else map.flyTo([vp.center[0],vp.center[1]],vp.zoom||4.5,{duration:0.9,animate:true});
    setMapMoved(false);
  }, []);

  const selectEx = useCallback((ex, fromMap=false) => {
    const next = sel?.id===ex.id ? null : ex;
    setSel(next);
    if (next) {
      if (!isMobile) {
        flyTo(next);
      } else if (fromMap) {
        flyTo(next);
        setShowSheet(true);
      } else {
        setShowSheet(true);
      }
    } else {
      setShowSheet(false);
    }
  }, [sel, flyTo, isMobile]);

  function addMarkers() {
    const L = window.L; const map = mapRef.current;
    if (!L||!map) return;
    const isDark = document.body.classList.contains('dark-mode');
    const labelColor = isDark ? '#ffffff' : null;
    const labelShadow = isDark ? 'none' : `0 0 6px ${CREAM},0 0 3px ${CREAM}`;
    map.eachLayer(l=>{ if(l._em) map.removeLayer(l); });
    exercises.forEach(ex=>{
      const [lat,lng] = getPos(ex.name);
      const c = getColor(ex);
      const isSel = sel?.id===ex.id;
      const isHov = hovered?.id===ex.id;
      const active = inWindow(ex);
      const size = isSel?26:isHov?22:18;
      const inner = isSel?10:isHov?8:6;
      const opacity = active ? 1 : 0.35;
      const icon = L.divIcon({
        className:'',
        html:`<div style="width:${size}px;height:${size}px;border-radius:50%;border:${isSel?2:1.5}px solid ${c.marker};background:${c.marker}${isSel?'28':isHov?'20':'12'};display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:${opacity};box-shadow:0 0 ${isSel?16:isHov?8:0}px ${c.marker}44"><div style="width:${inner}px;height:${inner}px;border-radius:50%;background:${c.marker}"></div></div>`,
        iconSize:[size,size], iconAnchor:[size/2,size/2],
      });
      const m = L.marker([lat,lng],{icon,zIndexOffset:isSel?1000:isHov?500:0})
        .addTo(map)
        .on('click',()=>selectEx(ex, true))
        .on('mouseover',()=>setHovered(ex))
        .on('mouseout',()=>setHovered(null));
      m._em=true;
      const lbl = L.divIcon({
        className:'',
        html:`<div style="font-family:'DM Sans',sans-serif;font-size:9px;letter-spacing:0.8px;color:${labelColor||c.marker};white-space:nowrap;pointer-events:none;text-shadow:${labelShadow};font-weight:${isSel?700:isHov?600:400};opacity:${opacity}">${ex.name}</div>`,
        iconSize:[220,14], iconAnchor:[-(size/2+4),7],
      });
      const lm = L.marker([lat,lng],{icon:lbl,interactive:false}).addTo(map); lm._em=true;
    });
  }

  const filteredEx = useMemo(() => exercises.filter(ex => {
    if (filter === "active" && !inWindow(ex)) return false;
    if (filter === "upcoming" && (inWindow(ex) || (ex.start_date||"") < WINDOW_END)) return false;
    if (domain !== "all" && !(ex.domain||"").toLowerCase().includes(domain.toLowerCase())) return false;
    return true;
  }), [exercises, filter, domain]);

  // Domain-scoped base: masthead stats reflect the active domain (but not the window chip,
  // since active/upcoming ARE the window categories).
  const domainScoped = useMemo(() => exercises.filter(ex =>
    domain === "all" || (ex.domain||"").toLowerCase().includes(domain.toLowerCase())
  ), [exercises, domain]);

  const activeCount = useMemo(() => domainScoped.filter(inWindow).length, [domainScoped]);
  const upcomingCount = useMemo(() => domainScoped.filter(e => !inWindow(e) && (e.start_date||"") > WINDOW_END).length, [domainScoped]);
  const totalPersonnel = useMemo(() => filteredEx.reduce((s,e) => s + (e.scale||0), 0), [filteredEx]);

  const activeExercises = exercises.filter(inWindow);
  const allExercises = exercises;

  // Mobile exercise list — render helper (NOT a component) so it doesn't remount each render
  const renderMobileList = () => (
    <div style={{flex:1,overflowY:"auto",background:CREAM}}>
      {activeExercises.length > 0 && (
        <div style={{padding:"8px 16px 4px",fontSize:9,letterSpacing:"2px",color:MUTED,fontWeight:700}}>ACTIVE (±14 DAYS)</div>
      )}
      {activeExercises.map((e,i)=>{
        const c=getColor(e); const isSel=sel?.id===e.id;
        return (
          <div key={e.id||i} className="wr-row" onClick={()=>selectEx(e)}
            style={{padding:"12px 16px",borderBottom:`1px solid ${FAINT}`,borderLeft:`2.5px solid ${isSel?c.marker:'transparent'}`,background:isSel?c.bg:"transparent",cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
              <span style={{fontSize:9,letterSpacing:"1.5px",padding:"2px 7px",borderRadius:3,fontWeight:700,background:c.bg,color:c.text,border:`1px solid ${c.border}`}}>{getBadge(e)}</span>
              <span style={{fontSize:10,color:MUTED}}>{e.exercise_type}</span>
            </div>
            <div style={{fontSize:14,color:INK,fontWeight:600,marginBottom:3}}>{e.name}</div>
            <div style={{fontSize:11,color:MUTED}}>{e.region} · {e.start_date?.slice(0,7)}{e.scale?` · ${Number(e.scale).toLocaleString()}`:""}</div>
          </div>
        );
      })}
      {allExercises.filter(e=>!inWindow(e)).length > 0 && <>
        <div style={{padding:"12px 16px 4px",fontSize:9,letterSpacing:"2px",color:MUTED,fontWeight:700,borderTop:`1px solid ${FAINT}`,marginTop:4}}>ALL EXERCISES</div>
        {allExercises.filter(e=>!inWindow(e)).map((e,i)=>{
          const c=getColor(e);
          return (
            <div key={e.id||i} className="wr-row" onClick={()=>selectEx(e)}
              style={{padding:"12px 16px",borderBottom:`1px solid ${FAINT}`,cursor:"pointer",opacity:0.5}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <span style={{fontSize:9,letterSpacing:"1.5px",padding:"2px 7px",borderRadius:3,fontWeight:700,background:c.bg,color:c.text,border:`1px solid ${c.border}`}}>{getBadge(e)}</span>
              </div>
              <div style={{fontSize:13,color:INK,fontWeight:600}}>{e.name}</div>
              <div style={{fontSize:11,color:MUTED}}>{e.region} · {e.start_date?.slice(0,7)}</div>
            </div>
          );
        })}
      </>}
    </div>
  );

  const mapContainer = (
    <div style={{
      position:"absolute", inset:0,
      visibility: isMobile && mobileTab!=="map" ? "hidden" : "visible",
      pointerEvents: isMobile && mobileTab!=="map" ? "none" : "auto",
    }}>
      <div ref={mapDiv} style={{width:"100%",height:"100%"}}/>
      {sel && mapMoved && !isMobile && (
        <button onClick={()=>flyTo(sel)} style={{position:"absolute",top:12,left:12,zIndex:1000,background:CREAM,border:`1px solid ${FAINT}`,borderRadius:6,padding:"6px 12px",fontSize:11,color:CRIMSON,cursor:"pointer",fontWeight:600}}>
          ◎ Focus {sel.name.split(" ")[0]}
        </button>
      )}
      <div style={{position:"absolute",bottom:isMobile?12:20,left:isMobile?12:20,zIndex:1000,fontSize:9,color:MUTED,letterSpacing:"1px",pointerEvents:"none"}}>
        {isMobile ? "DRAG TO PAN · PINCH TO ZOOM" : "DRAG TO PAN · USE +/− TO ZOOM"}
      </div>
      {exercises.length===0 && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,pointerEvents:"none"}}>
          <div style={{fontSize:12,letterSpacing:"2px",color:MUTED,textAlign:"center",lineHeight:2}}>NO EXERCISE DATA</div>
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="route-in" style={{ display:"flex", flexDirection:"column", height:"calc(100dvh - 60px)", minHeight:0 }}>
        {/* MASTHEAD */}
        <section style={{ borderBottom:"1px solid var(--rule)", flexShrink:0 }}>
          <div className="container-wide" style={{ paddingTop:20, paddingBottom:14 }}>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:32, flexWrap:"wrap" }}>
              <div>
                <div className="micro micro-accent" style={{ marginBottom:10 }}>JOINT MILITARY EXERCISES · ±14 DAY WINDOW</div>
                <h1 className="h1" style={{ fontSize:"clamp(26px,2.6vw,38px)", marginBottom:6 }}>War Room.</h1>
                <p className="body hide-mobile" style={{ maxWidth:540, color:"var(--ink-55)", fontSize:13 }}>
                  Live and upcoming exercise activity across NATO, US-led, multilateral, and national theatres.
                </p>
              </div>
              <div style={{ display:"flex", gap:36, alignItems:"flex-end" }}>
                <BigStat n={activeCount} label="active" emphasis />
                <BigStat n={upcomingCount} label="upcoming" />
                <BigStat n={totalPersonnel} label="personnel" format={v=>v>=1000?`${Math.round(v/1000)}k`:String(v)} />
              </div>
            </div>
            {/* Filter strip */}
            <div style={{ display:"flex", gap:8, marginTop:14, alignItems:"center", flexWrap:"wrap" }}>
              <span className="micro" style={{ marginRight:4 }}>WINDOW</span>
              {[["active","Active"],["upcoming","Upcoming"],["all","All"]].map(([k,l])=>(
                <button key={k} className={`chip ${filter===k?"is-active":""}`} onClick={()=>setFilter(k)}>{l}</button>
              ))}
              <span style={{ width:1, height:18, background:"var(--rule)", margin:"0 12px" }}/>
              <span className="micro" style={{ marginRight:4 }}>DOMAIN</span>
              {["all","Multi-domain","Maritime","Cyber","Joint"].map(d=>(
                <button key={d} className={`chip is-accent ${domain===d?"is-active":""}`} onClick={()=>setDomain(d)}>{d==="all"?"All":d}</button>
              ))}
            </div>
          </div>
        </section>

        {/* MAP + SIDEBAR — desktop only; mobile uses the fixed overlay below */}
        {!isMobile && <section style={{ flex:"1 1 0", minHeight:0, display:"flex" }}>
          <div className="warroom-grid" style={{ display:"grid", gridTemplateColumns:"1fr minmax(360px,420px)", minHeight:0, flex:"1 1 0", height:"100%" }}>
            {/* Map */}
            <div style={{ position:"relative", background:"var(--paper)", borderRight:"1px solid var(--rule)" }}>
              <div ref={mapDiv} style={{ position:"absolute", inset:0 }}/>
              {/* overlays */}
              <div style={{ position:"absolute", left:20, top:18, zIndex:500, pointerEvents:"none" }}>
                <div className="micro" style={{ color:"var(--ink)" }}>EXERCISE THEATRE OVERVIEW</div>
              </div>
              <div style={{ position:"absolute", left:20, bottom:20, zIndex:500, display:"flex", gap:14, alignItems:"center", padding:"8px 14px", background:"color-mix(in oklab, var(--cream) 92%, transparent)", backdropFilter:"blur(4px)", border:"1px solid var(--rule)", fontFamily:"var(--mono)", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase" }}>
                {[["#8B2030","NATO"],["#185FA5","US-led"],["#3D1219","RUS/CHN"],["#3B6D11","National"]].map(([c,l])=>(
                  <span key={l} style={{ display:"flex", alignItems:"center", gap:6, color:"var(--ink-70)" }}>
                    <span style={{ width:7, height:7, background:c, borderRadius:"50%" }}/>
                    {l}
                  </span>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ display:"flex", flexDirection:"column", background:"var(--cream)", minHeight:0, position:"relative" }}>
              <div style={{ overflowY:"auto", flex:"1 1 0", minHeight:0 }}>
                <div className="micro micro-strong" style={{ padding:"14px 22px 10px", borderBottom:"1px solid var(--rule)", letterSpacing:"0.2em", position:"sticky", top:0, background:"var(--cream)", zIndex:1 }}>
                  Exercises · {filteredEx.length}
                </div>
                {filteredEx.length === 0 ? (
                  <div className="body" style={{ padding:"40px 24px", color:"var(--ink-40)", textAlign:"center" }}>
                    No exercises match the current filters.
                  </div>
                ) : filteredEx.map(ex => {
                  const c = getColor(ex);
                  const isSel = sel?.id === ex.id;
                  const active = inWindow(ex);
                  return (
                    <div key={ex.id} className="wr-row"
                      onClick={()=>setSel(prev=>prev?.id===ex.id?null:ex)}
                      onMouseEnter={()=>setHovered(ex)}
                      onMouseLeave={()=>setHovered(null)}
                      style={{
                        padding:"14px 22px", borderBottom:"1px solid var(--rule)",
                        borderLeft: isSel ? `3px solid ${c.marker}` : "3px solid transparent",
                        background: isSel ? "var(--paper)" : "transparent",
                        cursor:"pointer", opacity:active?1:0.55,
                      }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                        <span className="mono" style={{ fontSize:9, padding:"2px 7px", background:c.marker, color:"#fff", letterSpacing:"0.12em" }}>
                          {getBadge(ex)}
                        </span>
                        <span className="micro" style={{ color:c.marker }}>{ex.exercise_type}</span>
                        {active && (
                          <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4 }}>
                            <span className="pulse" style={{ background:c.marker, width:5, height:5 }}/>
                            <span className="mono" style={{ fontSize:9, color:c.marker, letterSpacing:"0.1em" }}>ACTIVE</span>
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>{ex.name}</div>
                      <div className="mono small" style={{ color:"var(--ink-55)" }}>
                        {ex.region} · {(ex.start_date||"").slice(2).replaceAll("-",".")} → {(ex.end_date||"").slice(2).replaceAll("-",".")}
                      </div>
                      {ex.scale > 0 && (
                        <div className="mono small" style={{ color:"var(--ink-40)", marginTop:4 }}>
                          {ex.scale.toLocaleString()} personnel · rhetoric {ex.rhetoric_score?.toFixed(2)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {sel && (
                <div style={{ position:"absolute", inset:0, background:"var(--paper)", overflowY:"auto", zIndex:3, borderLeft:`3px solid ${getColor(sel).marker}`, animation:"wr-detail-in 0.2s cubic-bezier(0.2,0.7,0.2,1)" }}>
                  <ExerciseDetail ex={sel} color={getColor(sel).marker} onClose={()=>setSel(null)} />
                </div>
              )}
            </div>
          </div>
        </section>}

        {/* Mobile layout */}
        {isMobile && (
          <div style={{position:"fixed",inset:0,top:60,background:CREAM,zIndex:50,display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",borderBottom:`1px solid ${FAINT}`,flexShrink:0}}>
              {[["map","Map"],["exercises","Exercises"]].map(([tab,label])=>(
                <button key={tab} onClick={()=>setMobileTab(tab)}
                  style={{flex:1,padding:"10px 0",fontSize:13,fontWeight:mobileTab===tab?700:400,color:mobileTab===tab?CRIMSON:MUTED,background:"none",border:"none",cursor:"pointer",borderBottom:mobileTab===tab?`2px solid ${CRIMSON}`:"2px solid transparent"}}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{flex:1,position:"relative",overflow:"hidden",minHeight:0}}>
              {mapContainer}
              {mobileTab==="exercises" && (
                <div style={{position:"absolute",inset:0,background:CREAM,overflowY:"auto",zIndex:2}}>
                  {renderMobileList()}
                </div>
              )}
            </div>
            {showSheet && sel && (
              <>
                <div onClick={()=>{ setShowSheet(false); setSel(null); }} style={{position:"fixed",inset:0,background:"rgba(26,16,8,0.3)",zIndex:50}}/>
                <div style={{position:"fixed",left:0,right:0,bottom:0,zIndex:51,background:CREAM,borderRadius:"16px 16px 0 0",boxShadow:"0 -4px 24px rgba(26,16,8,0.15)",maxHeight:"65vh",overflowY:"auto",paddingBottom:"env(safe-area-inset-bottom)"}}>
                  <div style={{width:36,height:4,background:FAINT,borderRadius:2,margin:"12px auto 4px"}}/>
                  <ExerciseDetail ex={sel} color={getColor(sel).marker} onClose={()=>{ setShowSheet(false); setSel(null); }} />
                </div>
              </>
            )}
            <div style={{padding:"6px 16px",borderTop:`1px solid ${FAINT}`,display:"flex",gap:12,flexShrink:0,paddingBottom:"calc(6px + env(safe-area-inset-bottom))"}}>
              {[["#8B2030","NATO"],["#185FA5","Multilateral"],["#3B6D11","National"]].map(([c,l])=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:MUTED}}><span style={{width:6,height:6,borderRadius:"50%",background:c}}/>{l}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .leaflet-control-zoom{border:1px solid rgba(26,16,8,0.15)!important;border-radius:6px!important;overflow:hidden;box-shadow:none!important}
        .leaflet-control-zoom a{background:${CREAM}!important;color:${CRIMSON}!important;border-color:rgba(26,16,8,0.12)!important;font-weight:700!important;width:28px!important;height:28px!important;line-height:28px!important;font-size:16px!important;box-shadow:none!important}
        .leaflet-control-zoom a:hover{background:rgba(107,26,42,0.08)!important}
        @keyframes wr-detail-in { from { transform: translateY(10px); opacity:0; } to { transform: translateY(0); opacity:1; } }
      `}</style>
    </Layout>
  );
}
