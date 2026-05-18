import { useState } from "react";
import { CRIMSON } from "../data/seed";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function NarrativeBlock({ region, hasData = false }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/narrative/${encodeURIComponent(region)}`);
      const d = await res.json();
      setText(d.narrative || "");
      setDone(true);
    } catch { setText("Failed to connect to API."); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
        <span style={{ fontSize:10,fontWeight:700,letterSpacing:"2px",color:"rgba(0,0,0,0.35)" }}>AI ANALYSIS</span>
        {!done && hasData && (
          <button onClick={generate} disabled={loading}
            style={{ fontSize:11,padding:"5px 14px",borderRadius:999,border:"1px solid rgba(0,0,0,0.15)",background:"transparent",color:"rgba(0,0,0,0.5)",cursor:loading?"default":"pointer" }}
            onMouseEnter={e=>{if(!loading){e.currentTarget.style.background=CRIMSON;e.currentTarget.style.color="#fff";e.currentTarget.style.borderColor=CRIMSON;}}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(0,0,0,0.5)";e.currentTarget.style.borderColor="rgba(0,0,0,0.15)";}}
          >{loading ? "Generating…" : "Generate ↗"}</button>
        )}
      </div>
      {text
        ? <p style={{ fontSize:13,lineHeight:1.7,color:"rgba(0,0,0,0.65)" }}>{text}</p>
        : hasData
          ? <p style={{ fontSize:12,fontStyle:"italic",color:"rgba(0,0,0,0.3)" }}>Click Generate for an AI-powered escalation assessment.</p>
          : <p style={{ fontSize:12,fontStyle:"italic",color:"rgba(0,0,0,0.3)" }}>Available after events are loaded for this region.</p>
      }
    </div>
  );
}
