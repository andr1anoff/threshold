import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Layout from "../components/Layout";
import AnimatedNumber from "../components/AnimatedNumber";
import { EXERCISES } from "../data/seed";

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
  "FREEDOM SHIELD":      { bounds:[[34,124],[40,130]] },
  "AFRICAN LION":        { bounds:[[25,-10],[38,12]] },
  "VOSTOK":              { bounds:[[45,80],[70,145]] },
};

const MARKER_POS = {
  "STEADFAST DETERRENCE":[59,20], "DYNAMIC MONGOOSE":[63,-8],
  "AURORA":[60,18], "NEPTUNE STRIKE":[37,13], "IRON UNION":[32,35],
  "TALISMAN SABRE":[-22,148], "RIMPAC":[21,-157],
  "STEADFAST DEFENDER":[55,24], "CYBER COALITION":[59.5,24.7], "STEADFAST DART":[44,26],
  "FREEDOM SHIELD":[37,127], "AFRICAN LION":[31,2], "VOSTOK":[56,115],
};

const THEATRES = [
  { coords:[[54,10],[54,30],[65,30],[65,10]], color:"rgba(139,32,48,0.06)", border:"rgba(139,32,48,0.15)" },
  { coords:[[0,105],[0,122],[22,122],[22,105]], color:"rgba(24,95,165,0.06)", border:"rgba(24,95,165,0.15)" },
  { coords:[[75,-30],[75,60],[90,60],[90,-30]], color:"rgba(148,163,184,0.06)", border:"rgba(148,163,184,0.12)" },
  { coords:[[30,-5],[30,36],[46,36],[46,-5]], color:"rgba(24,95,165,0.04)", border:"rgba(24,95,165,0.10)" },
  { coords:[[20,28],[20,58],[37,58],[37,28]], color:"rgba(176,125,26,0.06)", border:"rgba(176,125,26,0.15)" },
];

const TODAY = new Date("2026-05-26");
const WINDOW_START = new Date(TODAY.getTime() - 14*86400000).toISOString().slice(0,10);
const WINDOW_END   = new Date(TODAY.getTime() + 14*86400000).toISOString().slice(0,10);

function inWindow(ex) {
  const start = ex.start_date || "";
  const end   = ex.end_date || ex.start_date || "";
  return start <= WINDOW_END && end >= WINDOW_START;
}

function isUpcoming(ex) {
  return (ex.start_date || "") > WINDOW_END;
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
  if (l.includes("russia")||l.includes("china")) return {bg:"rgba(61,18,25,0.10)",border:"rgba(61,18,25,0.25)",text:"#3D1219",marker:"#3D1219"};
  if (l.includes("nato")||l.includes("shape")) return {bg:"rgba(139,32,48,0.10)",border:"rgba(139,32,48,0.25)",text:"#8B2030",marker:"#8B2030"};
  if (l.includes("sweden")||l.includes("finland")||l.includes("national")) return {bg:"rgba(59,109,17,0.10)",border:"rgba(59,109,17,0.25)",text:"#3B6D11",marker:"#3B6D11"};
  return {bg:"rgba(24,95,165,0.10)",border:"rgba(24,95,165,0.25)",text:"#185FA5",marker:"#185FA5"};
}

function getBadge(ex) {
  const l = (ex.lead_nation||"").toLowerCase();
  if (l.includes("russia")||l.includes("china")) return "RUS/CHN";
  if (l.includes("nato")||l.includes("shape")) return "NATO";
  if (l.includes("sweden")||l.includes("finland")) return "NATIONAL";
  return "MULTILATERAL";
}

function getRhetColor(score, target) {
  if (!target||target==="General deterrence") return "rgba(26,16,8,0.45)";
  if (score>=0.7) return "#8B2030"; if (score>=0.5) return "#C0622B";
  return "rgba(26,16,8,0.45)";
}

const CREAM="#F5F0E8", INK="#1A1008", MUTED="rgba(26,16,8,0.45)", FAINT="rgba(26,16,8,0.10)", CRIMSON="#6B1A2A";

function BigStat({ label, value, format }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <div style={{ fontSize:40, fontWeight:700, lineHeight:1, letterSpacing:"-0.03em", color:INK }}>
        <AnimatedNumber value={value} format={format}/>
      </div>
      <div style={{ fontSize:10, letterSpacing:"2px", fontWeight:600, color:MUTED }}>{label}</div>
    </div>
  );
}

function ExerciseDetail({ ex, onClose }) {
  if (!ex) return null;
  const rhColor = getRhetColor(ex.rhetoric_score, ex.signal_target);
  return (
    <div style={{ padding:"14px 22px" }}>
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", columnGap:14, alignItems:"center", marginBottom:12, paddingBottom:12, borderBottom:`1px dotted ${FAINT}` }}>
        <div style={{ fontSize:13, color:INK, fontWeight:700, lineHeight:1.3 }}>{ex.name}</div>
        <button onClick={onClose} style={{ justifySelf:"end", background:"none", border:`1px solid ${FAINT}`, borderRadius:4, padding:"3px 8px", cursor:"pointer", fontSize:11, color:MUTED }}>✕</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 24px" }}>
        {[
          ["TYPE",    TYPE_DESC[ex.exercise_type]||ex.exercise_type||"—"],
          ["LEAD",    ex.lead_nation||"—"],
          ["DOMAIN",  ex.domain||"—"],
          ["THEATRE", ex.region||"—"],
          ["WINDOW",  `${ex.start_date?.slice(0,10)} – ${ex.end_date?.slice(0,10)}`],
          ["SCALE",   ex.scale?`${Number(ex.scale).toLocaleString()} pers.`:"Command post"],
          ["SIGNAL",  ex.signal_target||"—"],
          ["RHETORIC",ex.rhetoric_score!=null?(ex.rhetoric_score>0?`+${ex.rhetoric_score}`:`${ex.rhetoric_score}`):"—"],
        ].map(([k,v]) => (
          <React.Fragment key={k}>
            <div style={{ borderBottom:`1px dotted ${FAINT}`, paddingBottom:5 }}>
              <div style={{ fontSize:9, letterSpacing:"1.5px", color:MUTED, marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:11, color:(k==="SIGNAL"||k==="RHETORIC")?rhColor:INK, lineHeight:1.4 }}>{v}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
      {ex.statements?.raw_summary && (
        <p style={{ fontSize:11, color:MUTED, marginTop:10, lineHeight:1.6, paddingTop:10, borderTop:`1px dotted ${FAINT}` }}>{ex.statements.raw_summary}</p>
      )}
    </div>
  );
}

export default function WarRoom() {
  const mapDiv   = useRef(null);
  const mapRef   = useRef(null);
  const [sel, setSel]             = useState(null);
  const [hovered, setHovered]     = useState(null);
  const [exercises, setExercises] = useState(EXERCISES);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapMoved, setMapMoved]   = useState(false);
  const [filter, setFilter]       = useState("active");
  const [domain, setDomain]       = useState("all");
  const [mobileTab, setMobileTab] = useState("map");
  const [showSheet, setShowSheet] = useState(false);
  const [isMobile, setIsMobile]   = useState(() => typeof window !== "undefined" && window.innerWidth < 700);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    fetch(`${API}/api/exercises/`)
      .then(r=>r.json()).then(d=>{if(d.data?.length)setExercises(d.data);})
      .catch(()=>{});
  }, []);

  const filteredEx = useMemo(() => exercises.filter(ex => {
    if (filter==="active" && !inWindow(ex)) return false;
    if (filter==="upcoming" && !isUpcoming(ex)) return false;
    if (domain!=="all" && !(ex.domain||"").toLowerCase().includes(domain)) return false;
    return true;
  }), [exercises, filter, domain]);

  const activeCount     = useMemo(() => exercises.filter(inWindow).length, [exercises]);
  const upcomingCount   = useMemo(() => exercises.filter(isUpcoming).length, [exercises]);
  const totalPersonnel  = useMemo(() => exercises.filter(inWindow).reduce((s,e)=>s+(e.scale||0),0), [exercises]);

  useEffect(() => {
    if (window.L) { initMap(); return; }
    const css = document.createElement("link");
    css.rel="stylesheet"; css.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = initMap;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (mapRef.current && mapLoaded) addMarkers();
  }, [exercises, mapLoaded, sel, hovered]);

  useEffect(() => {
    if (mobileTab==="map" && mapRef.current) {
      setTimeout(()=>mapRef.current?.invalidateSize(), 200);
    }
  }, [mobileTab]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState==="visible" && mapRef.current) {
        setTimeout(()=>mapRef.current?.invalidateSize(), 150);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  function initMap() {
    if (!mapDiv.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(mapDiv.current, {
      center:[30,15], zoom:2, minZoom:2, maxZoom:7,
      zoomControl:false, scrollWheelZoom:false,
      doubleClickZoom:false, touchZoom:true,
      dragging:true, tap:true, attributionControl:false,
    });
    L.control.zoom({position:"bottomright"}).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",{maxZoom:7,subdomains:"abcd"}).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",{maxZoom:7,subdomains:"abcd",opacity:0.35}).addTo(map);
    for (let i=-90;i<=90;i+=15) L.polyline([[-85,i],[85,i]],{color:"rgba(107,26,42,0.05)",weight:0.4}).addTo(map);
    for (let i=-180;i<=180;i+=30) L.polyline([[-85,i],[85,i]],{color:"rgba(107,26,42,0.05)",weight:0.4}).addTo(map);
    L.polyline([[-85,0],[85,0]],{color:"rgba(107,26,42,0.10)",weight:0.7,dashArray:"5,5"}).addTo(map);
    THEATRES.forEach(t=>L.polygon(t.coords,{fillColor:t.color,fillOpacity:1,color:t.border,weight:1,dashArray:"4,4",interactive:false}).addTo(map));
    map.on("dragstart",()=>setMapMoved(true));
    mapRef.current = map;
    setMapLoaded(true);
  }

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
      if (!isMobile) { flyTo(next); }
      else if (fromMap) { flyTo(next); setShowSheet(true); }
      else { setShowSheet(true); }
    } else {
      setShowSheet(false);
    }
  }, [sel, flyTo, isMobile]);

  function addMarkers() {
    const L = window.L; const map = mapRef.current;
    if (!L||!map) return;
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
        className:"",
        html:`<div style="width:${size}px;height:${size}px;border-radius:50%;border:${isSel?2:1.5}px solid ${c.marker};background:${c.marker}${isSel?"28":isHov?"20":"12"};display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:${opacity};box-shadow:0 0 ${isSel?16:isHov?8:0}px ${c.marker}44"><div style="width:${inner}px;height:${inner}px;border-radius:50%;background:${c.marker}"></div></div>`,
        iconSize:[size,size], iconAnchor:[size/2,size/2],
      });
      const m = L.marker([lat,lng],{icon,zIndexOffset:isSel?1000:isHov?500:0})
        .addTo(map)
        .on("click",()=>selectEx(ex, true))
        .on("mouseover",()=>setHovered(ex))
        .on("mouseout",()=>setHovered(null));
      m._em=true;
      const lbl = L.divIcon({
        className:"",
        html:`<div style="font-family:'DM Sans',sans-serif;font-size:9px;letter-spacing:0.8px;color:${c.marker};white-space:nowrap;pointer-events:none;text-shadow:0 0 6px ${CREAM},0 0 3px ${CREAM};font-weight:${isSel?700:isHov?600:400};opacity:${opacity}">${ex.name}</div>`,
        iconSize:[220,14], iconAnchor:[-(size/2+4),7],
      });
      const lm = L.marker([lat,lng],{icon:lbl,interactive:false}).addTo(map); lm._em=true;
    });
  }

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
    </div>
  );

  return (
    <Layout>
      <div style={{ display:"flex", flexDirection:"column", flex:"1 0 auto", minHeight:"calc(100vh - 60px)", background:CREAM }}>

        {/* ─── MASTHEAD ─────────────────────── */}
        <section style={{ padding:"40px 24px 28px", borderBottom:`1px solid ${FAINT}`, flexShrink:0 }}>
          <div className="container-wide" style={{ padding:0 }}>
            <div className="micro" style={{ color:CRIMSON, letterSpacing:"2px", marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
              <span className="tick"/>
              WAR ROOM · JOINT MILITARY EXERCISES
            </div>
            <h1 style={{ fontSize:"clamp(32px,4vw,52px)", fontWeight:700, letterSpacing:"-0.025em", lineHeight:1.05, marginBottom:12, color:INK }}>War room.</h1>
            <p style={{ fontSize:14, color:MUTED, maxWidth:560, lineHeight:1.6, marginBottom:28 }}>
              Active and upcoming military exercises within the ±14-day observation window. Markers indicate exercise theatres; signals and rhetoric scored against deterrence targets.
            </p>

            {/* BigStats */}
            <div style={{ display:"flex", gap:40, flexWrap:"wrap", marginBottom:24 }}>
              <BigStat label="ACTIVE NOW" value={activeCount} />
              <BigStat label="UPCOMING" value={upcomingCount} />
              <BigStat label="PERSONNEL IN FIELD" value={totalPersonnel} format={n=>n>=1000?`${Math.round(n/1000)}k`:String(n)} />
            </div>

            {/* Filter strip */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              <span className="micro" style={{ marginRight:4 }}>WINDOW</span>
              {[["active","Active (±14d)"],["upcoming","Upcoming"],["all","All"]].map(([v,l])=>(
                <button key={v} className={`chip ${filter===v?"is-active":""}`} onClick={()=>setFilter(v)}>{l}</button>
              ))}
              <span style={{ width:1, height:18, background:FAINT, margin:"0 4px" }}/>
              <span className="micro" style={{ marginRight:4 }}>DOMAIN</span>
              {[["all","All"],["land","Land"],["maritime","Maritime"],["cyber","Cyber"],["air","Air"]].map(([v,l])=>(
                <button key={v} className={`chip ${domain===v?"is-active":""}`} onClick={()=>setDomain(v)}>{l}</button>
              ))}
            </div>
          </div>
        </section>

        {isMobile ? (
          /* ── MOBILE ── */
          <>
            <div style={{ display:"flex", borderBottom:`1px solid ${FAINT}`, flexShrink:0 }}>
              {[["map","Map"],["exercises","Exercises"]].map(([tab,label])=>(
                <button key={tab} onClick={()=>setMobileTab(tab)}
                  style={{ flex:1, padding:"10px 0", fontSize:13, fontWeight:mobileTab===tab?700:400, color:mobileTab===tab?CRIMSON:MUTED, background:"none", border:"none", cursor:"pointer", borderBottom:mobileTab===tab?`2px solid ${CRIMSON}`:"2px solid transparent" }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ flex:1, position:"relative", overflow:"hidden", minHeight:0, minHeight:320 }}>
              {mapContainer}
              {mobileTab==="exercises" && (
                <div style={{ position:"absolute", inset:0, background:CREAM, overflowY:"auto", zIndex:2 }}>
                  {filteredEx.map((e,i)=>{
                    const c=getColor(e); const isSel=sel?.id===e.id;
                    return (
                      <div key={e.id||i} onClick={()=>selectEx(e)}
                        style={{ padding:"12px 16px", borderBottom:`1px solid ${FAINT}`, borderLeft:`2.5px solid ${isSel?c.marker:"transparent"}`, background:isSel?c.bg:"transparent", cursor:"pointer" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                          <span style={{ fontSize:9, letterSpacing:"1.5px", padding:"2px 7px", borderRadius:3, fontWeight:700, background:c.bg, color:c.text, border:`1px solid ${c.border}` }}>{getBadge(e)}</span>
                          <span style={{ fontSize:10, color:MUTED }}>{e.exercise_type}</span>
                        </div>
                        <div style={{ fontSize:14, color:INK, fontWeight:600, marginBottom:3 }}>{e.name}</div>
                        <div style={{ fontSize:11, color:MUTED }}>{e.region} · {e.start_date?.slice(0,7)}{e.scale?` · ${Number(e.scale).toLocaleString()}`:""}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {showSheet && sel && (
              <>
                <div onClick={()=>{ setShowSheet(false); setSel(null); }} style={{ position:"fixed", inset:0, background:"rgba(26,16,8,0.3)", zIndex:50 }}/>
                <div style={{ position:"fixed", left:0, right:0, bottom:0, zIndex:51, background:CREAM, borderRadius:"16px 16px 0 0", boxShadow:"0 -4px 24px rgba(26,16,8,0.15)", maxHeight:"65vh", overflowY:"auto", paddingBottom:"env(safe-area-inset-bottom)" }}>
                  <div style={{ width:36, height:4, background:FAINT, borderRadius:2, margin:"12px auto 4px" }}/>
                  <ExerciseDetail ex={sel} onClose={()=>{ setShowSheet(false); setSel(null); }}/>
                </div>
              </>
            )}
            <div style={{ padding:"6px 16px", borderTop:`1px solid ${FAINT}`, display:"flex", gap:12, flexShrink:0, paddingBottom:"calc(6px + env(safe-area-inset-bottom))" }}>
              {[["#8B2030","NATO"],["#185FA5","Multilateral"],["#3B6D11","National"],["#3D1219","RUS/CHN"]].map(([c,l])=>(
                <span key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color:MUTED }}><span style={{ width:6, height:6, borderRadius:"50%", background:c }}/>{l}</span>
              ))}
            </div>
          </>
        ) : (
          /* ── DESKTOP ── */
          <>
            <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 380px", minHeight:0, overflow:"hidden", height:"calc(100vh - 60px - 180px)", minHeight:560 }}>
              {/* Map */}
              <div style={{ position:"relative", overflow:"hidden" }}>
                {mapContainer}
              </div>

              {/* Sidebar */}
              <div style={{ borderLeft:`1px solid ${FAINT}`, display:"flex", flexDirection:"column", background:CREAM, flexShrink:0 }}>
                <div style={{ padding:"10px 22px 8px", borderBottom:`1px solid ${FAINT}`, flexShrink:0, position:"sticky", top:0, background:CREAM, zIndex:2 }}>
                  <span style={{ fontSize:10, letterSpacing:"2px", color:MUTED, fontWeight:600 }}>{filteredEx.length} EXERCISE{filteredEx.length!==1?"S":""}</span>
                </div>
                <div style={{ flex:"1 1 0", minHeight:0, overflowY:"auto" }}>
                  {filteredEx.map((e,i)=>{
                    const c=getColor(e); const isSel=sel?.id===e.id; const isHov=hovered?.id===e.id;
                    const active=inWindow(e);
                    return (
                      <div key={e.id||i}
                        onClick={()=>selectEx(e)}
                        onMouseEnter={()=>setHovered(e)} onMouseLeave={()=>setHovered(null)}
                        style={{ padding:"14px 22px", borderBottom:`1px solid ${FAINT}`, borderLeft:`2.5px solid ${(isSel||isHov)?c.marker:"transparent"}`, background:isSel?c.bg:isHov?"rgba(26,16,8,0.02)":"transparent", cursor:"pointer", opacity:active?1:0.5 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                          <span style={{ fontSize:9, letterSpacing:"1.5px", padding:"2px 7px", borderRadius:3, fontWeight:700, background:c.bg, color:c.text, border:`1px solid ${c.border}` }}>{getBadge(e)}</span>
                          <span style={{ fontSize:10, color:MUTED }}>{e.exercise_type||"EX"}</span>
                          {active && <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:4 }}><span className="pulse" style={{ width:5, height:5 }}/><span style={{ fontSize:9, color:"var(--lo)", fontWeight:600, letterSpacing:"1px" }}>ACTIVE</span></span>}
                        </div>
                        <div style={{ fontSize:13, color:isSel?INK:"rgba(26,16,8,0.78)", fontWeight:600, marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{e.name}</div>
                        <div style={{ fontSize:11, color:MUTED }}>{e.region} · {e.start_date?.slice(0,7)}{e.scale?` · ${Number(e.scale).toLocaleString()}`:""}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Detail dock */}
            {sel && (
              <div style={{ flexShrink:0, borderTop:`1px solid var(--ink)`, background:"var(--paper)", maxHeight:260, overflowY:"auto", animation:"slide-up 0.18s ease-out" }}>
                <ExerciseDetail ex={sel} onClose={()=>setSel(null)}/>
              </div>
            )}

            <div style={{ padding:"7px 24px", borderTop:`1px solid ${FAINT}`, display:"flex", gap:18, alignItems:"center", flexShrink:0 }}>
              {[["#8B2030","NATO"],["#185FA5","US-led / Multilateral"],["#3B6D11","National"],["#3D1219","RUS/CHN"]].map(([c,l])=>(
                <span key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:MUTED }}><span style={{ width:7, height:7, borderRadius:"50%", background:c }}/>{l}</span>
              ))}
              <span style={{ marginLeft:"auto", fontSize:10, color:"rgba(26,16,8,0.25)", letterSpacing:"1px" }}>SHAPE NATO · CENTCOM · INDOPACOM</span>
            </div>
          </>
        )}
      </div>

      <style>{`
        .leaflet-control-zoom{border:1px solid rgba(26,16,8,0.15)!important;border-radius:6px!important;overflow:hidden;box-shadow:none!important}
        .leaflet-control-zoom a{background:${CREAM}!important;color:${CRIMSON}!important;border-color:rgba(26,16,8,0.12)!important;font-weight:700!important;width:28px!important;height:28px!important;line-height:28px!important;font-size:16px!important;box-shadow:none!important}
        .leaflet-control-zoom a:hover{background:rgba(107,26,42,0.08)!important}
      `}</style>
    </Layout>
  );
}
