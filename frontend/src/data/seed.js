export const REGIONS = [
  { id:"Gaza & Middle East",  label:"Gaza & Middle East", short:"GZ",  ei:58, prev:56, trend:+2,  cat:"conflict", category:"conflict", lat:31.5, lng:34.5,  theatre:"levant"     },
  { id:"Ukraine",             label:"Ukraine",            short:"UA",  ei:58, prev:58, trend:0,   cat:"conflict", category:"conflict", lat:49,   lng:32,    theatre:"easteuro"   },
  { id:"Sudan",               label:"Sudan",              short:"SD",  ei:41, prev:40, trend:+1,  cat:"conflict", category:"conflict", lat:15,   lng:30,    theatre:"hornafrica" },
  { id:"South China Sea",     label:"South China Sea",    short:"SCS", ei:32, prev:31, trend:+1,  cat:"tension",  category:"tension",  lat:13,   lng:114,   theatre:"indo"       },
  { id:"Taiwan Strait",       label:"Taiwan Strait",      short:"TW",  ei:28, prev:28, trend:0,   cat:"tension",  category:"tension",  lat:24,   lng:121,   theatre:"indo"       },
  { id:"Yemen",               label:"Yemen",              short:"YE",  ei:38, prev:39, trend:-1,  cat:"conflict", category:"conflict", lat:15.5, lng:48,    theatre:"levant"     },
  { id:"Sahel",               label:"Sahel",              short:"SH",  ei:40, prev:38, trend:+2,  cat:"conflict", category:"conflict", lat:15,   lng:0,     theatre:"westafrica" },
  { id:"Korean Peninsula",    label:"Korean Peninsula",   short:"KR",  ei:24, prev:24, trend:0,   cat:"tension",  category:"tension",  lat:38,   lng:127,   theatre:"indo"       },
  { id:"Myanmar",             label:"Myanmar",            short:"MM",  ei:35, prev:35, trend:0,   cat:"conflict", category:"conflict", lat:21,   lng:96,    theatre:"indo"       },
  { id:"DRC",                 label:"DRC",                short:"CD",  ei:36, prev:35, trend:+1,  cat:"conflict", category:"conflict", lat:-2,   lng:23,    theatre:"centafrica" },
  { id:"Syria",               label:"Syria",              short:"SY",  ei:30, prev:31, trend:-1,  cat:"conflict", category:"conflict", lat:35,   lng:38,    theatre:"levant"     },
  { id:"Somalia",             label:"Somalia",            short:"SO",  ei:34, prev:34, trend:0,   cat:"conflict", category:"conflict", lat:6,    lng:46,    theatre:"hornafrica" },
  { id:"Baltic",              label:"Baltic",             short:"BLT", ei:22, prev:19, trend:+3,  cat:"tension",  category:"tension",  lat:58,   lng:24,    theatre:"easteuro"   },
  { id:"Haiti",               label:"Haiti",              short:"HT",  ei:33, prev:33, trend:0,   cat:"conflict", category:"conflict", lat:19,   lng:-72,   theatre:"caribbean"  },
  { id:"Ethiopia",            label:"Ethiopia",           short:"ET",  ei:31, prev:32, trend:-1,  cat:"conflict", category:"conflict", lat:9,    lng:40,    theatre:"hornafrica" },
  { id:"South Caucasus",      label:"South Caucasus",     short:"SC",  ei:27, prev:26, trend:+1,  cat:"tension",  category:"tension",  lat:41,   lng:45,    theatre:"easteuro"   },
  { id:"Libya",               label:"Libya",              short:"LY",  ei:29, prev:29, trend:0,   cat:"conflict", category:"conflict", lat:27,   lng:17,    theatre:"levant"     },
  { id:"Kosovo",              label:"Kosovo",             short:"KS",  ei:18, prev:18, trend:0,   cat:"tension",  category:"tension",  lat:42.5, lng:21,    theatre:"easteuro"   },
  { id:"Arctic",              label:"Arctic",             short:"AR",  ei:14, prev:12, trend:+2,  cat:"tension",  category:"tension",  lat:78,   lng:20,    theatre:"arctic"     },
  { id:"Mozambique",          label:"Mozambique",         short:"MZ",  ei:28, prev:28, trend:0,   cat:"conflict", category:"conflict", lat:-15,  lng:39,    theatre:"centafrica" },
];

export const DI_HISTORY = {};

export const SPARKLINES = (() => {
  // Deterministic pseudo-random using region EI as seed — stable across hot reloads
  const seededRand = (seed, i) => {
    const x = Math.sin(seed * 9301 + i * 49297 + 233) * 1000;
    return x - Math.floor(x);
  };
  const out = {};
  for (const r of REGIONS) {
    const arr = [];
    let v = r.ei - r.trend * 1.2 - (seededRand(r.ei, 0) * 6 - 3);
    for (let i = 0; i < 30; i++) {
      const noise = (Math.sin(i * 0.7 + r.ei) * 1.4) + (seededRand(r.ei, i + 1) * 2.4 - 1.2);
      v = Math.max(2, Math.min(95, v + noise + (r.trend * 0.08)));
      arr.push(Math.round(v * 10) / 10);
    }
    arr[arr.length - 1] = r.ei;
    out[r.id] = arr;
  }
  return out;
})();

export const CATS = {
  cyber:      { label:"Cyber",        color:"#8B2030", glyph:"◇" },
  airspace:   { label:"Airspace",     color:"#C0622B", glyph:"△" },
  maritime:   { label:"Maritime",     color:"#185FA5", glyph:"▽" },
  disinfo:    { label:"Disinfo",      color:"#7C3AED", glyph:"◊" },
  proxy:      { label:"Proxy",        color:"#B07D1A", glyph:"◈" },
  economic:   { label:"Economic",     color:"#2D7A4F", glyph:"◯" },
  military:   { label:"Military",     color:"#8B2030", glyph:"■" },
  diplomatic: { label:"Diplomatic",   color:"#185FA5", glyph:"□" },
  civilian:   { label:"Civilian",     color:"#B07D1A", glyph:"●" },
  none:       { label:"Unclassified", color:"rgba(26,16,8,0.35)", glyph:"·" },
  unknown:    { label:"Pending",      color:"#B07D1A", glyph:"·" },
};

export const SOURCE_CONF = {
  "UN":"Inst",   "OCHA":"Inst",  "ReliefWeb":"Inst",
  "UCDP":"Acad", "SIPRI":"Acad",
  "Bellingcat":"OSINT", "DeepState":"OSINT", "CIT":"OSINT",
  "Reuters":"Media", "Guardian":"Media", "Kyiv Independent":"Media", "MEE":"Media",
  "Atlantic Council":"Anal", "Carnegie":"Anal", "CSIS":"Anal", "Crisis Group":"Anal",
  "Wikipedia":"Disc",
};

export function getConf(source) {
  for (const [k,v] of Object.entries(SOURCE_CONF)) {
    if ((source||"").includes(k)) return v;
  }
  return "Media";
}

export const EI_COLOR = s => s==null?"#94a3b8":s>=65?"#8B2030":s>=45?"#C0622B":s>=25?"#B07D1A":"#2D7A4F";
export const EI_LABEL = s => s==null?"NO DATA":s>=65?"HIGH":s>=45?"MODERATE":s>=25?"ELEVATED":"LOW";
export const EI_BG    = s => s==null?"rgba(148,163,184,0.08)":s>=65?"rgba(139,32,48,0.07)":s>=45?"rgba(192,98,43,0.07)":s>=25?"rgba(176,125,26,0.07)":"rgba(45,122,79,0.07)";

export const INCIDENTS = [
  { id:"i1",  date:"2026-05-20", region:"Baltic",            category:"cyber",      escalation_level:3, title:"Coordinated GPS spoofing reported across Estonian and Latvian Baltic shipping corridors", description:"Maritime traffic authorities in Tallinn and Riga issued joint advisory after 26 vessels reported position drift exceeding 2 nautical miles within a 90-minute window.", source_name:"Reuters" },
  { id:"i2",  date:"2026-05-20", region:"Ukraine",           category:"military",   escalation_level:4, title:"Long-range strike package hits energy substation in Sumy oblast", description:"Three transformer units reported destroyed; partial power loss affecting 78,000 households. No casualties confirmed at time of report.", source_name:"Kyiv Independent" },
  { id:"i3",  date:"2026-05-19", region:"Taiwan Strait",     category:"airspace",   escalation_level:2, title:"Twelve PLA aircraft crossed median line; sustained 4h17m intrusion", description:"Republic of China Ministry of Defence logged the largest single-day median-line crossing of May. Configuration included two J-16 and one KJ-500 AEW&C.", source_name:"Reuters" },
  { id:"i4",  date:"2026-05-19", region:"Gaza & Middle East",category:"diplomatic", escalation_level:2, title:"Qatar and Egypt suspend ceasefire facilitation pending mediated resumption", description:"Joint statement issued following 72-hour breakdown of indirect talks. Both governments indicated readiness to reconvene on revised framework.", source_name:"UN News" },
  { id:"i5",  date:"2026-05-18", region:"Sudan",             category:"civilian",   escalation_level:4, title:"Mass displacement event in North Kordofan estimated at 42,000 within 96 hours", description:"OCHA situation report attributes movement to combined RSF advance and acute food insecurity. Three IDP sites near El Obeid now at over-capacity.", source_name:"OCHA" },
  { id:"i6",  date:"2026-05-18", region:"South China Sea",   category:"maritime",   escalation_level:2, title:"Chinese Coast Guard water-cannon engagement at Second Thomas Shoal", description:"Philippine BRP Sindangan sustained superstructure damage during BRP Sierra Madre resupply mission. No injuries reported by Philippine Coast Guard.", source_name:"Bellingcat" },
  { id:"i7",  date:"2026-05-18", region:"Yemen",             category:"maritime",   escalation_level:3, title:"Houthi anti-ship missile splash 18nm off Bab el-Mandeb chokepoint", description:"CENTCOM confirmed interception by USS Roosevelt. No commercial vessel struck. Houthi spokesman claimed targeting of Greek-flagged tanker.", source_name:"CSIS" },
  { id:"i8",  date:"2026-05-17", region:"Sahel",             category:"military",   escalation_level:4, title:"JNIM-claimed coordinated attacks on three Burkinabè military positions", description:"Initial reports indicate at least 31 military personnel killed. Burkinabè authorities have not yet confirmed casualty figures.", source_name:"Crisis Group" },
  { id:"i9",  date:"2026-05-17", region:"Arctic",            category:"airspace",   escalation_level:1, title:"Two Tu-95 long-range bombers identified in Norwegian ADIZ; RAF Typhoons scrambled", description:"Standard intercept-and-escort. NORAD logged a parallel North Slope incursion 4 hours later. Both passes consistent with prior pattern.", source_name:"SIPRI" },
  { id:"i10", date:"2026-05-16", region:"Korean Peninsula",  category:"diplomatic", escalation_level:1, title:"DPRK Foreign Ministry issues statement opposing US-ROK Freedom Shield 2026 schedule", description:"Spokesman warned of \"physical response\" should exercise scope expand. Language consistent with annual cycle. No verified launch activity.", source_name:"UN News" },
  { id:"i11", date:"2026-05-16", region:"Libya",             category:"proxy",      escalation_level:2, title:"Convoy attributed to Russian-aligned force observed moving toward Brak el-Shati", description:"Open-source satellite imagery (Planet) shows movement consistent with logistics resupply. No engagement reported.", source_name:"Bellingcat" },
  { id:"i12", date:"2026-05-15", region:"DRC",               category:"civilian",   escalation_level:3, title:"M23-aligned forces consolidate position around Sake; humanitarian access restricted", description:"MSF reported suspension of three health facilities. Approximately 7,200 displaced toward Goma over 48h.", source_name:"OCHA" },
  { id:"i13", date:"2026-05-15", region:"Baltic",            category:"disinfo",    escalation_level:2, title:"Coordinated inauthentic-behaviour network targeting Lithuanian elections taken down", description:"Meta disclosed removal of 84 accounts linked to GRU Unit 54777 information operations. Network active since February.", source_name:"Atlantic Council" },
  { id:"i14", date:"2026-05-14", region:"Ethiopia",          category:"military",   escalation_level:3, title:"Renewed clashes reported in Amhara region between ENDF and Fano militia", description:"UCDP coding indicates third consecutive week of high-intensity events in West Gojjam zone. Estimated 40+ fatalities cumulative.", source_name:"UCDP" },
  { id:"i15", date:"2026-05-14", region:"South Caucasus",    category:"diplomatic", escalation_level:1, title:"Armenia–Azerbaijan border commission completes section 14 demarcation", description:"OSCE-observed handover proceeded without incident. Section covers 11km north of Tavush. Five sections remain.", source_name:"Carnegie" },
  { id:"i16", date:"2026-05-13", region:"Myanmar",           category:"military",   escalation_level:3, title:"Three Brotherhood Alliance pushes toward Lashio; Tatmadaw airstrikes intensify", description:"Open-source imagery shows new fortifications outside Lashio. Tatmadaw conducted 14 airstrike sorties in 24h per OSINT tracking.", source_name:"Crisis Group" },
  { id:"i17", date:"2026-05-13", region:"Gaza & Middle East",category:"civilian",   escalation_level:4, title:"UN-sponsored aid convoy denied transit at Rafah crossing for 7th consecutive day", description:"WFP reports 14 trucks idling. UN spokesman characterised situation as \"unsustainable\" given food insecurity classification.", source_name:"UN News" },
  { id:"i18", date:"2026-05-12", region:"Somalia",           category:"military",   escalation_level:2, title:"Al-Shabaab IED attack on Mogadishu–Afgooye road; ATMIS convoy damaged", description:"No fatalities among ATMIS personnel reported. Civilian casualty figures not yet verified.", source_name:"UCDP" },
  { id:"i19", date:"2026-05-12", region:"Haiti",             category:"civilian",   escalation_level:3, title:"BSAP-Viv Ansanm clashes spread into Pétion-Ville commune for first time", description:"MSS contingent commander cited \"new operational pattern\" in press statement. Estimated 3,400 displaced.", source_name:"OCHA" },
  { id:"i20", date:"2026-05-11", region:"Ukraine",           category:"cyber",      escalation_level:2, title:"State Service of Special Communications attributes Diia outage to coordinated DDoS", description:"Service restored within 4h. Attribution by SSSCIP to Sandworm/UAC-0133. No data exfiltration confirmed.", source_name:"CIT" },
  { id:"i21", date:"2026-05-11", region:"Ukraine",           category:"airspace",   escalation_level:3, title:"Coordinated overnight drone wave: 78 launched, 62 reported intercepted by air force", description:"Largest single-night Shahed/Geran wave of May. Strikes registered in Odesa, Mykolaiv, and Vinnytsia oblasts.", source_name:"DeepState" },
  { id:"i22", date:"2026-05-10", region:"Mozambique",        category:"military",   escalation_level:2, title:"ASWJ insurgent activity reported in Cabo Delgado near Macomia", description:"Rwandan Defence Force contingent engaged. No verified casualty figures. Pattern consistent with seasonal escalation.", source_name:"Crisis Group" },
  { id:"i23", date:"2026-05-10", region:"Kosovo",            category:"diplomatic", escalation_level:1, title:"KFOR commander meets with Belgrade and Pristina liaison in Mitrovica", description:"Routine bilateral. Communiqué references \"de-escalation pathways\". No operational changes announced.", source_name:"UN News" },
  { id:"i24", date:"2026-05-09", region:"Syria",             category:"airspace",   escalation_level:2, title:"Israeli airstrikes target reported IRGC facility outside Damascus", description:"Syrian state media reported air defence engagement. No public IDF acknowledgement. Pattern of strikes ongoing.", source_name:"MEE" },
  { id:"i25", date:"2026-05-09", region:"Sahel",             category:"proxy",      escalation_level:2, title:"Africa Corps rotation observed at Gao airfield via Maxar imagery", description:"Approximately 220 personnel and 18 vehicles identified. Consistent with documented rotation cycle for Mali deployment.", source_name:"Bellingcat" },
  { id:"i26", date:"2026-05-08", region:"Gaza & Middle East",category:"military",   escalation_level:3, title:"IDF Southern Command announces extension of operational presence in Khan Younis", description:"Statement specifies \"buffer-zone consolidation\". UN officials called extension \"contrary to ceasefire framework\".", source_name:"UN News" },
  { id:"i27", date:"2026-05-08", region:"Arctic",            category:"economic",   escalation_level:1, title:"Rosatomflot announces extension of NSR commercial transit window through November", description:"Decision predicated on multi-year ice extent reduction. May reshape Arctic shipping economics on 5-year horizon.", source_name:"SIPRI" },
  { id:"i28", date:"2026-05-07", region:"Baltic",            category:"maritime",   escalation_level:2, title:"Suspected sabotage of submarine cable between Sweden and Estonia under investigation", description:"Swedish coast guard and Estonian authorities opened joint inquiry. Tanker \"Vezhen\" identified at coordinates within the incident window.", source_name:"Bellingcat" },
  { id:"i29", date:"2026-05-07", region:"Ukraine",           category:"military",   escalation_level:3, title:"AFU 79th Air Assault Brigade reports advance south of Robotyne", description:"Independent verification via geolocated combat footage by DeepState. Reported advance of 1.2km along an 800m frontage.", source_name:"DeepState" },
  { id:"i30", date:"2026-05-06", region:"South China Sea",   category:"maritime",   escalation_level:1, title:"Vietnam protests Chinese survey vessel activity within EEZ near Vanguard Bank", description:"Diplomatic note issued. Vessel identified by AIS as \"Haiyang Dizhi 8\" with two CCG escorts.", source_name:"CSIS" },
];

export const EXERCISES = [
  { id:"x1", name:"STEADFAST DEFENDER 26", exercise_type:"LIVEX", lead_nation:"NATO/SHAPE",  domain:"Multi-domain",  region:"Atlantic + Europe", start_date:"2026-04-12", end_date:"2026-05-26", scale:90000, signal_target:"NATO Article 5 readiness", rhetoric_score:0.82, statements:{ raw_summary:"Largest NATO exercise since the Cold War. SACEUR briefing emphasised Article 5 readiness across SACLANT and SACEUR theatres." } },
  { id:"x2", name:"AURORA 26",             exercise_type:"LIVEX", lead_nation:"Sweden",       domain:"Joint",          region:"Nordic / Baltic",    start_date:"2026-05-04", end_date:"2026-05-30", scale:25000, signal_target:"National defence",          rhetoric_score:0.31, statements:{ raw_summary:"Sweden's largest national exercise in 25 years. Strong focus on total-defence framework with civil contingencies integration." } },
  { id:"x3", name:"DYNAMIC MONGOOSE 26",   exercise_type:"MAREX", lead_nation:"NATO",         domain:"Maritime/ASW",   region:"GIUK Gap",           start_date:"2026-05-18", end_date:"2026-05-30", scale:6500,  signal_target:"Regional reassurance",      rhetoric_score:0.48, statements:{ raw_summary:"Anti-submarine warfare in the GIUK gap. Norwegian, UK, US, and Canadian frigates participating." } },
  { id:"x4", name:"AFRICAN LION 26",       exercise_type:"LIVEX", lead_nation:"AFRICOM",      domain:"Joint",          region:"Morocco/Tunisia",    start_date:"2026-05-12", end_date:"2026-05-30", scale:8000,  signal_target:"Partnership",               rhetoric_score:0.22, statements:{ raw_summary:"AFRICOM's largest exercise, focused on partner-nation interoperability rather than deterrence signalling." } },
  { id:"x5", name:"TALISMAN SABRE 26",     exercise_type:"LIVEX", lead_nation:"US/Australia", domain:"Multi-domain",   region:"Pacific",            start_date:"2026-07-01", end_date:"2026-08-04", scale:35000, signal_target:"Indo-Pacific deterrence",   rhetoric_score:0.68, statements:{ raw_summary:"Largest iteration of Talisman Sabre to date. Includes long-range fires demonstration north of Darwin." } },
  { id:"x6", name:"VOSTOK 26",             exercise_type:"LIVEX", lead_nation:"Russia",       domain:"Multi-domain",   region:"Far East",           start_date:"2026-09-08", end_date:"2026-09-22", scale:65000, signal_target:"Strategic deterrence",      rhetoric_score:0.91, statements:{ raw_summary:"Strategic-level exercise with announced nuclear deterrence component. Chinese PLA observer delegation invited." } },
  { id:"x7", name:"CYBER COALITION 26",    exercise_type:"TTX",   lead_nation:"NATO",         domain:"Cyber",          region:"Tallinn (CCDCOE)",   start_date:"2026-12-01", end_date:"2026-12-05", scale:1200,  signal_target:"Cyber resilience",          rhetoric_score:0.42, statements:{ raw_summary:"Tabletop exercise on coordinated response to hybrid cyber-kinetic scenarios. 35 nations." } },
  { id:"x8", name:"FREEDOM SHIELD 26",     exercise_type:"LIVEX", lead_nation:"US/ROK",       domain:"Joint",          region:"Korean Peninsula",   start_date:"2026-03-04", end_date:"2026-03-14", scale:19000, signal_target:"Combined defence",          rhetoric_score:0.65, statements:{ raw_summary:"Annual combined US-ROK exercise. DPRK Foreign Ministry registered objection per established pattern." } },
];
