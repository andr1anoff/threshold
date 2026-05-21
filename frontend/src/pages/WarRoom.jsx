import { useEffect, useRef, useState, useCallback } from "react";
import Layout from "../components/Layout";

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
  const start = ex.start_date || "";
  const end   = ex.end_date || ex.start_date || "";
  return start <= WINDOW_END && end >= WINDOW_START;
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
  if (l.includes("sweden")||l.includes("finland")||l.includes("national")) return {bg:"rgba(59,109,17,0.10)",border:"rgba(59,109,17,0.25)",text:"#3B6D11",marker:"#3B6D11"};
  return {bg:"rgba(24,95,165,0.10)",border:"rgba(24,95,165,0.25)",text:"#185FA5",marker:"#185FA5"};
}

function getBadge(ex) {
  const l = (ex.lead_nation||"").toLowerCase();
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

function ExerciseDetail({ ex, onClose, isMobile }) {
  if (!ex) return (
    <div style={{padding:"14px 16px"}}>
      <div style={{fontSize:10,letterSpacing:"2px",color:"rgba(26,16,8,0.2)",marginBottom:14,fontWeight:600}}>SELECT EXERCISE</div>
      {["TYPE","THEATRE","DOMAIN","LEAD NATION","TROOPS","DATES","SIGNAL","RHETORIC"].map(k=>(
        <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontSize:10,color:"rgba(26,16,8,0.2)",letterSpacing:"1px"}}>{k}</span>
          <span style={{width:55,height:6,background:FAINT,borderRadius:2,display:"inline-block"}}/>
        </div>
      ))}
    </div>
  );
  const rhColor = getRhetColor(ex.rhetoric_score, ex.signal_target);
  return (
    <div style={{padding:"13px 16px"}}>
      {isMobile && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,paddingBottom:10,borderBottom:`1px solid ${FAINT}`}}>
          <div style={{fontSize:13,color:INK,fontWeight:700,lineHeight:1.3,flex:1,paddingRight:12}}>{ex.name}</div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${FAINT}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:14,color:MUTED,flexShrink:0}}>✕</button>
        </div>
      )}
      {!isMobile && <div style={{fontSize:13,color:INK,fontWeight:700,marginBottom:10,paddingBottom:9,borderBottom:`1px solid ${FAINT}`,lineHeight:1.4}}>{ex.name}</div>}
      {[
        ["TYPE",   TYPE_DESC[ex.exercise_type]||ex.exercise_type||"—"],
        ["THEATRE",ex.region||"—"],
        ["DOMAIN", ex.domain||"—"],
        ["LEAD",   ex.lead_nation||"—"],
        ["TROOPS", ex.scale?`${Number(ex.scale).toLocaleString()} personnel`:"N/A (command post)"],
        ["DATES",  `${ex.start_date?.slice(0,10)} — ${ex.end_date?.slice(0,10)}`],
        ["SIGNAL", ex.signal_target||"—"],
        ["RHETORIC",ex.rhetoric_score!=null?(ex.rhetoric_score>0?`+${ex.rhetoric_score}`:`${ex.rhetoric_score}`):"—"],
      ].map(([k,v])=>(
        <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:6,gap:10,alignItems:"flex-start"}}>
          <span style={{fontSize:10,color:MUTED,letterSpacing:"1px",flexShrink:0}}>{k}</span>
          <span style={{fontSize:11,color:(k==="SIGNAL"||k==="RHETORIC")?rhColor:"rgba(26,16,8,0.78)",textAlign:"right",lineHeight:1.4}}>{v}</span>
        </div>
      ))}
      {ex.statements?.raw_summary && <p style={{fontSize:11,color:MUTED,marginTop:8,lineHeight:1.6,paddingTop:8,borderTop:`1px solid ${FAINT}`}}>{ex.statements.raw_summary}</p>}
      {ex.source_url && <a href={ex.source_url} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",marginTop:10,fontSize:11,color:CRIMSON,textDecoration:"none",fontWeight:500}}>Primary source ↗</a>}
    </div>
  );
}

export default function WarRoom() {
  const mapDiv   = useRef(null);
  const mapRef   = useRef(null);
  const [sel, setSel]           = useState(null);
  const [hovered, setHovered]   = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);
  const [mobileTab, setMobileTab] = useState("map");
  const [showSheet, setShowSheet] = useState(false); // mobile bottom sheet
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 700);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    fetch(`${API}/api/exercises/`)
      .then(r=>r.json()).then(d=>{if(d.data?.length)setExercises(d.data);})
      .catch(()=>{}).finally(()=>setLoading(false));
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
      touchZoom:true,        // allow pinch zoom
      dragging:true,         // allow touch drag
      tap:true,              // iOS tap support
      attributionControl:false,
    });
    L.control.zoom({position:'bottomright'}).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{maxZoom:7,subdomains:'abcd'}).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',{maxZoom:7,subdomains:'abcd',opacity:0.35}).addTo(map);
    for (let i=-90;i<=90;i+=15) L.polyline([[-85,i],[85,i]],{color:'rgba(107,26,42,0.05)',weight:0.4}).addTo(map);
    for (let i=-180;i<=180;i+=30) L.polyline([[-85,i],[85,i]],{color:'rgba(107,26,42,0.05)',weight:0.4}).addTo(map);
    L.polyline([[-85,0],[85,0]],{color:'rgba(107,26,42,0.10)',weight:0.7,dashArray:'5,5'}).addTo(map);
    THEATRES.forEach(t=>L.polygon(t.coords,{fillColor:t.color,fillOpacity:1,color:t.border,weight:1,dashArray:'4,4',interactive:false}).addTo(map));
    map.on('dragstart',()=>setMapMoved(true));
    mapRef.current = map;
    setMapLoaded(true);
  }

  // Invalidate map size when switching to map tab (map was always mounted but might need resize)
  useEffect(() => {
    if (mobileTab==="map" && mapRef.current) {
      setTimeout(()=>mapRef.current?.invalidateSize(), 200);
    }
  }, [mobileTab]);


  // Fix tile loss after tab becomes visible again (idle/background)
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
        // Desktop: always fly to location
        flyTo(next);
      } else if (fromMap) {
        // Mobile + clicked on map marker: fly and show sheet
        flyTo(next);
        setShowSheet(true);
      } else {
        // Mobile + clicked in list: just show sheet, stay on current tab
        setShowSheet(true);
      }
    } else {
      setShowSheet(false);
    }
  }, [sel, flyTo, isMobile]);

  function addMarkers() {
    const L = window.L; const map = mapRef.current;
    if (!L||!map) return;
    map.eachLayer(l=>{ if(l._em) map.removeLayer(l); });
    // Show all exercises on map but highlight active window ones
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
        html:`<div style="font-family:'DM Sans',sans-serif;font-size:9px;letter-spacing:0.8px;color:${c.marker};white-space:nowrap;pointer-events:none;text-shadow:0 0 6px ${CREAM},0 0 3px ${CREAM};font-weight:${isSel?700:isHov?600:400};opacity:${opacity}">${ex.name}</div>`,
        iconSize:[220,14], iconAnchor:[-(size/2+4),7],
      });
      const lm = L.marker([lat,lng],{icon:lbl,interactive:false}).addTo(map); lm._em=true;
    });
  }

  const activeExercises = exercises.filter(inWindow);
  const allExercises = exercises;

  // Desktop exercise list
  const ExListDesktop = () => (
    <div>
      <div style={{padding:"8px 16px 6px",fontSize:10,letterSpacing:"2px",color:MUTED,borderBottom:`1px solid ${FAINT}`,fontWeight:600}}>
        ACTIVE WINDOW
      </div>
      {loading ? [1,2,3].map(i=>(
        <div key={i} style={{padding:"12px 16px",borderBottom:`1px solid ${FAINT}`,opacity:0.25}}>
          <div style={{height:8,width:55,background:FAINT,borderRadius:2,marginBottom:8}}/><div style={{height:13,width:160,background:FAINT,borderRadius:2,marginBottom:5}}/><div style={{height:9,width:100,background:FAINT,borderRadius:2}}/>
        </div>
      )) : allExercises.map((e,i)=>{
        const c=getColor(e); const isSel=sel?.id===e.id; const isHov=hovered?.id===e.id;
        const active=inWindow(e);
        return (
          <div key={e.id||i}
            onClick={()=>selectEx(e)}
            onMouseEnter={()=>setHovered(e)} onMouseLeave={()=>setHovered(null)}
            style={{padding:"11px 16px",borderBottom:`1px solid ${FAINT}`,borderLeft:`2.5px solid ${(isSel||isHov)?c.marker:'transparent'}`,background:isSel?c.bg:isHov?"rgba(26,16,8,0.02)":"transparent",cursor:"pointer",opacity:active?1:0.45}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
              <span style={{fontSize:9,letterSpacing:"1.5px",padding:"2px 7px",borderRadius:3,fontWeight:700,background:c.bg,color:c.text,border:`1px solid ${c.border}`}}>{getBadge(e)}</span>
              <span style={{fontSize:10,color:MUTED}}>{e.exercise_type||"EX"}</span>
              {!active && <span style={{fontSize:8,color:MUTED,marginLeft:"auto"}}>outside window</span>}
            </div>
            <div style={{fontSize:13,color:isSel?INK:"rgba(26,16,8,0.78)",fontWeight:600,marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</div>
            <div style={{fontSize:11,color:MUTED}}>{e.region} · {e.start_date?.slice(0,7)}{e.scale?` · ${Number(e.scale).toLocaleString()}`:""}</div>
          </div>
        );
      })}
    </div>
  );

  // Mobile exercise list
  const ExListMobile = () => (
    <div style={{flex:1,overflowY:"auto",background:CREAM}}>
      {activeExercises.length > 0 && (
        <div style={{padding:"8px 16px 4px",fontSize:9,letterSpacing:"2px",color:MUTED,fontWeight:700}}>ACTIVE (±14 DAYS)</div>
      )}
      {activeExercises.map((e,i)=>{
        const c=getColor(e); const isSel=sel?.id===e.id;
        return (
          <div key={e.id||i} onClick={()=>selectEx(e)}
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
            <div key={e.id||i} onClick={()=>selectEx(e)}
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
    /* KEY: map div is ALWAYS mounted, just hidden via position/visibility.
       This prevents Leaflet from losing its DOM element on tab switches. */
    <div style={{
      position:"absolute", inset:0,
      // On mobile: visible only when map tab active
      // On desktop: always visible (no tabs)
      visibility: isMobile && mobileTab!=="map" ? "hidden" : "visible",
      pointerEvents: isMobile && mobileTab!=="map" ? "none" : "auto",
    }}>
      {/* No onTouchMove stopPropagation here — was breaking mobile drag */}
      <div ref={mapDiv} style={{width:"100%",height:"100%"}}/>
      {sel && mapMoved && !isMobile && (
        <button onClick={()=>flyTo(sel)} style={{position:"absolute",top:12,left:12,zIndex:1000,background:CREAM,border:`1px solid ${FAINT}`,borderRadius:6,padding:"6px 12px",fontSize:11,color:CRIMSON,cursor:"pointer",fontWeight:600}}>
          ◎ Focus {sel.name.split(" ")[0]}
        </button>
      )}
      <div style={{position:"absolute",bottom:isMobile?12:20,left:isMobile?12:20,zIndex:1000,fontSize:9,color:MUTED,letterSpacing:"1px",pointerEvents:"none"}}>
        {isMobile ? "DRAG TO PAN · PINCH TO ZOOM" : "DRAG TO PAN · USE +/− TO ZOOM"}
      </div>
      {!loading && exercises.length===0 && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,pointerEvents:"none"}}>
          <div style={{fontSize:12,letterSpacing:"2px",color:MUTED,textAlign:"center",lineHeight:2}}>NO EXERCISE DATA</div>
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div style={{height:"calc(100dvh - 56px)",overflow:"hidden",display:"flex",flexDirection:"column",background:CREAM}}>

        {/* Subheader */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 24px",borderBottom:`1px solid ${FAINT}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:11,letterSpacing:"4px",color:CRIMSON,fontWeight:700}}>WAR ROOM</span>
            <div style={{width:1,height:13,background:FAINT}}/>
            <span style={{fontSize:10,letterSpacing:"2px",color:MUTED,display:isMobile?"none":"block"}}>JOINT MILITARY EXERCISES</span>
          </div>
          <div style={{display:"flex",gap:12}}>
            <span style={{fontSize:10,color:MUTED,letterSpacing:"1px"}}>{loading?"…":`${activeExercises.length} ACTIVE`}</span>
            <div style={{width:1,height:12,background:FAINT}}/>
            <span style={{fontSize:10,color:MUTED,letterSpacing:"1px"}}>MAY 2026</span>
          </div>
        </div>

        {isMobile ? (
          /* ── MOBILE ── */
          <>
            {/* 2 tabs only: Map | Exercises */}
            <div style={{display:"flex",borderBottom:`1px solid ${FAINT}`,flexShrink:0}}>
              {[["map","Map"],["exercises","Exercises"]].map(([tab,label])=>(
                <button key={tab} onClick={()=>setMobileTab(tab)}
                  style={{flex:1,padding:"10px 0",fontSize:13,fontWeight:mobileTab===tab?700:400,color:mobileTab===tab?CRIMSON:MUTED,background:"none",border:"none",cursor:"pointer",borderBottom:mobileTab===tab?`2px solid ${CRIMSON}`:"2px solid transparent"}}>
                  {label}
                </button>
              ))}
            </div>

            {/* Content area — map always present in DOM */}
            <div style={{flex:1,position:"relative",overflow:"hidden",minHeight:0}}>
              {mapContainer}
              {mobileTab==="exercises" && (
                <div style={{position:"absolute",inset:0,background:CREAM,overflowY:"auto",zIndex:2}}>
                  <ExListMobile/>
                </div>
              )}
            </div>

            {/* Bottom sheet — slides up over map when exercise selected */}
            {showSheet && sel && (
              <>
                <div onClick={()=>{ setShowSheet(false); setSel(null); }} style={{position:"fixed",inset:0,background:"rgba(26,16,8,0.3)",zIndex:50}}/>
                <div style={{
                  position:"fixed", left:0, right:0, bottom:0, zIndex:51,
                  background:CREAM, borderRadius:"16px 16px 0 0",
                  boxShadow:"0 -4px 24px rgba(26,16,8,0.15)",
                  maxHeight:"65vh", overflowY:"auto",
                  paddingBottom:"env(safe-area-inset-bottom)",
                }}>
                  <div style={{width:36,height:4,background:FAINT,borderRadius:2,margin:"12px auto 4px"}}/>
                  <ExerciseDetail ex={sel} onClose={()=>{ setShowSheet(false); setSel(null); }} isMobile={true}/>
                </div>
              </>
            )}

            {/* Mobile footer */}
            <div style={{padding:"6px 16px",borderTop:`1px solid ${FAINT}`,display:"flex",gap:12,flexShrink:0,paddingBottom:"calc(6px + env(safe-area-inset-bottom))"}}>
              {[["#8B2030","NATO"],["#185FA5","Multilateral"],["#3B6D11","National"]].map(([c,l])=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:MUTED}}><span style={{width:6,height:6,borderRadius:"50%",background:c}}/>{l}</span>
              ))}
            </div>
          </>
        ) : (
          /* ── DESKTOP ── */
          <>
            <div style={{flex:1,display:"flex",minHeight:0}}>
              <div style={{flex:1,position:"relative",overflow:"hidden"}}>
                {mapContainer}
              </div>
              <div style={{width:300,borderLeft:`1px solid ${FAINT}`,display:"flex",flexDirection:"column",background:CREAM,flexShrink:0}}>
                <div style={{flex:"1 1 0",minHeight:0,overflowY:"auto"}}>
                <ExListDesktop/>
              </div>
                <div style={{borderTop:`1px solid ${FAINT}`,overflowY:"auto",height:280,flexShrink:0,background:CREAM}}>
                  <ExerciseDetail ex={sel}/>
                </div>
              </div>
            </div>
            <div style={{padding:"7px 24px",borderTop:`1px solid ${FAINT}`,display:"flex",gap:18,alignItems:"center",flexShrink:0}}>
              {[["#8B2030","NATO"],["#185FA5","US-led / Multilateral"],["#3B6D11","National"]].map(([c,l])=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:MUTED}}><span style={{width:7,height:7,borderRadius:"50%",background:c}}/>{l}</span>
              ))}
              <span style={{marginLeft:"auto",fontSize:10,color:"rgba(26,16,8,0.25)",letterSpacing:"1px"}}>SHAPE NATO · CENTCOM · INDOPACOM</span>
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
