export const REGIONS = [
  { id:"Gaza & Middle East",  label:"Gaza & Middle East", short:"GZ",  ei:58, prev:56, trend:+2,  category:"conflict", cat:"conflict", lat:31.5, lng:34.5, theatre:"levant"      },
  { id:"Ukraine",             label:"Ukraine",            short:"UA",  ei:58, prev:58, trend:0,   category:"conflict", cat:"conflict", lat:49,   lng:32,   theatre:"easteuro"    },
  { id:"Sudan",               label:"Sudan",              short:"SD",  ei:41, prev:40, trend:+1,  category:"conflict", cat:"conflict", lat:15,   lng:30,   theatre:"hornafrica"  },
  { id:"South China Sea",     label:"South China Sea",    short:"SCS", ei:32, prev:31, trend:+1,  category:"tension",  cat:"tension",  lat:13,   lng:114,  theatre:"indo"        },
  { id:"Taiwan Strait",       label:"Taiwan Strait",      short:"TW",  ei:28, prev:28, trend:0,   category:"tension",  cat:"tension",  lat:24,   lng:121,  theatre:"indo"        },
  { id:"Yemen",               label:"Yemen",              short:"YE",  ei:38, prev:39, trend:-1,  category:"conflict", cat:"conflict", lat:15.5, lng:48,   theatre:"levant"      },
  { id:"Sahel",               label:"Sahel",              short:"SH",  ei:40, prev:38, trend:+2,  category:"conflict", cat:"conflict", lat:15,   lng:0,    theatre:"westafrica"  },
  { id:"Korean Peninsula",    label:"Korean Peninsula",   short:"KR",  ei:24, prev:24, trend:0,   category:"tension",  cat:"tension",  lat:38,   lng:127,  theatre:"indo"        },
  { id:"Myanmar",             label:"Myanmar",            short:"MM",  ei:35, prev:35, trend:0,   category:"conflict", cat:"conflict", lat:21,   lng:96,   theatre:"indo"        },
  { id:"DRC",                 label:"DRC",                short:"CD",  ei:36, prev:35, trend:+1,  category:"conflict", cat:"conflict", lat:-2,   lng:23,   theatre:"centafrica"  },
  { id:"Syria",               label:"Syria",              short:"SY",  ei:30, prev:31, trend:-1,  category:"conflict", cat:"conflict", lat:35,   lng:38,   theatre:"levant"      },
  { id:"Somalia",             label:"Somalia",            short:"SO",  ei:34, prev:34, trend:0,   category:"conflict", cat:"conflict", lat:6,    lng:46,   theatre:"hornafrica"  },
  { id:"Baltic",              label:"Baltic",             short:"BLT", ei:22, prev:19, trend:+3,  category:"tension",  cat:"tension",  lat:58,   lng:24,   theatre:"easteuro"    },
  { id:"Haiti",               label:"Haiti",              short:"HT",  ei:33, prev:33, trend:0,   category:"conflict", cat:"conflict", lat:19,   lng:-72,  theatre:"caribbean"   },
  { id:"Ethiopia",            label:"Ethiopia",           short:"ET",  ei:31, prev:32, trend:-1,  category:"conflict", cat:"conflict", lat:9,    lng:40,   theatre:"hornafrica"  },
  { id:"South Caucasus",      label:"South Caucasus",     short:"SC",  ei:27, prev:26, trend:+1,  category:"tension",  cat:"tension",  lat:41,   lng:45,   theatre:"easteuro"    },
  { id:"Libya",               label:"Libya",              short:"LY",  ei:29, prev:29, trend:0,   category:"conflict", cat:"conflict", lat:27,   lng:17,   theatre:"levant"      },
  { id:"Kosovo",              label:"Kosovo",             short:"KS",  ei:18, prev:18, trend:0,   category:"tension",  cat:"tension",  lat:42.5, lng:21,   theatre:"easteuro"    },
  { id:"Arctic",              label:"Arctic",             short:"AR",  ei:14, prev:12, trend:+2,  category:"tension",  cat:"tension",  lat:78,   lng:20,   theatre:"arctic"      },
  { id:"Mozambique",          label:"Mozambique",         short:"MZ",  ei:28, prev:28, trend:0,   category:"conflict", cat:"conflict", lat:-15,  lng:39,   theatre:"centafrica"  },
];

export const DI_HISTORY = {};

export const SPARKLINES = (() => {
  const out = {};
  for (const r of REGIONS) {
    const arr = [];
    let v = r.ei - r.trend * 1.2 - (Math.random() * 6 - 3);
    for (let i = 0; i < 30; i++) {
      const noise = (Math.sin(i * 0.7 + r.ei) * 1.4) + (Math.random() * 2.4 - 1.2);
      v = Math.max(2, Math.min(95, v + noise + (r.trend * 0.08)));
      arr.push(Math.round(v * 10) / 10);
    }
    arr[arr.length - 1] = r.ei;
    out[r.id] = arr;
  }
  return out;
})();

export const CATS = {
  cyber:      { label:"Cyber",       color:"#8B2030", glyph:"◇" },
  airspace:   { label:"Airspace",    color:"#C0622B", glyph:"△" },
  maritime:   { label:"Maritime",    color:"#185FA5", glyph:"▽" },
  disinfo:    { label:"Disinfo",     color:"#7C3AED", glyph:"◊" },
  proxy:      { label:"Proxy",       color:"#B07D1A", glyph:"◈" },
  economic:   { label:"Economic",    color:"#2D7A4F", glyph:"◯" },
  military:   { label:"Military",    color:"#8B2030", glyph:"■" },
  diplomatic: { label:"Diplomatic",  color:"#185FA5", glyph:"□" },
  civilian:   { label:"Civilian",    color:"#B07D1A", glyph:"●" },
  none:       { label:"Unclassified",color:"rgba(26,16,8,0.35)", glyph:"·" },
  unknown:    { label:"Pending",     color:"#B07D1A", glyph:"·" },
};

export const SOURCE_CONF = {
  "UN":"Inst",  "OCHA":"Inst", "ReliefWeb":"Inst",
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
  { id:1,  date:"2026-05-20T08:14:00", region:"Ukraine",            category:"military",   escalation_level:4, title:"Russian glide bomb strike on Kharkiv energy substation", description:"Coordinated FAB-1500 glide bomb attack on two substations, leaving 340,000 without power. Third such strike in seven days.", source_name:"DeepState", src:"DeepState" },
  { id:2,  date:"2026-05-20T06:30:00", region:"Gaza & Middle East", category:"military",   escalation_level:4, title:"IDF ground operation resumes in northern Khan Younis", description:"Brigade-level maneuver force re-entered urban area. UNRWA reports displacement of ~18,000 civilians within 48 hours.", source_name:"UN News", src:"UN News" },
  { id:3,  date:"2026-05-19T14:22:00", region:"South China Sea",    category:"maritime",   escalation_level:3, title:"PLA Navy frigate conducts 'rights protection' patrol inside Philippines EEZ", description:"CNS Zibo held course within 12nm of Palawan Island for four hours, shadowed by PCG vessel BRP Teresa Magbanua.", source_name:"CSIS", src:"CSIS" },
  { id:4,  date:"2026-05-19T09:55:00", region:"Baltic",             category:"cyber",      escalation_level:3, title:"DDoS campaign disrupts Estonian parliament website ahead of vote", description:"Attribution to GRU-linked Killnet successor cluster. Attack peaked at 480 Gbps, coinciding with NATO infrastructure debate.", source_name:"Bellingcat", src:"Bellingcat" },
  { id:5,  date:"2026-05-18T17:40:00", region:"Taiwan Strait",      category:"airspace",   escalation_level:3, title:"PLAAF conducts unannounced ADIZ incursion with 24 aircraft", description:"Two H-6K bombers flanked by J-16 escorts crossed median line. Taiwan MND activated ROCAF intercept protocol.", source_name:"Reuters", src:"Reuters" },
  { id:6,  date:"2026-05-18T11:10:00", region:"Sudan",              category:"military",   escalation_level:4, title:"RSF artillery barrage on El Fasher hospital district", description:"Twelve confirmed civilian casualties. MSF field hospital partially destroyed. UNOCHA declares medical emergency in North Darfur.", source_name:"OCHA", src:"OCHA" },
  { id:7,  date:"2026-05-17T15:30:00", region:"Sahel",              category:"proxy",      escalation_level:3, title:"Wagner/Africa Corps convoy ambushed in Gao corridor", description:"JNIM claim of responsibility. Satellite imagery shows twelve vehicles destroyed. Mali government denies Russian involvement.", source_name:"Atlantic Council", src:"Atlantic Council" },
  { id:8,  date:"2026-05-17T07:00:00", region:"Yemen",              category:"maritime",   escalation_level:3, title:"Houthi anti-ship missile narrowly misses MV Talia in Red Sea", description:"British warship HMS Duncan provided escort. Commercial traffic rerouting around Cape of Good Hope resumes.", source_name:"Reuters", src:"Reuters" },
  { id:9,  date:"2026-05-16T19:45:00", region:"Korean Peninsula",   category:"airspace",   escalation_level:2, title:"North Korea launches two ballistic missiles from Sukchon", description:"Missiles splashed down 450km east of the coast, short of Japan's EEZ. Japan lodged formal protest via diplomatic channel.", source_name:"Reuters", src:"Reuters" },
  { id:10, date:"2026-05-16T13:20:00", region:"Ukraine",            category:"cyber",      escalation_level:3, title:"Sandworm disrupts Ukrtelecom national backbone for 4 hours", description:"CERT-UA attributes to Sandworm cluster. Attack coincided with artillery barrage, suggesting coordinated kinetic-cyber operation.", source_name:"CERT-UA", src:"CERT-UA" },
  { id:11, date:"2026-05-15T10:05:00", region:"DRC",                category:"military",   escalation_level:4, title:"M23 advance on Butembo threatens humanitarian corridor", description:"MONUSCO peacekeepers repositioned. OCHA warns of supply blockade affecting 1.2 million beneficiaries in North Kivu.", source_name:"OCHA", src:"OCHA" },
  { id:12, date:"2026-05-15T08:30:00", region:"Myanmar",            category:"military",   escalation_level:3, title:"Junta airstrikes on Sagaing resistance stronghold kill 31", description:"AAPP confirmed 31 killed, 60 wounded. PDF advance stalled by air interdiction campaign targeting supply lines.", source_name:"Guardian", src:"Guardian" },
  { id:13, date:"2026-05-14T16:50:00", region:"Baltic",             category:"disinfo",    escalation_level:2, title:"Russian state media amplifies fabricated NATO troop incident in Latvia", description:"Coordinated push across VK, Telegram. Latvian State Security Bureau issued formal debunk. Narrative reached 2.4M impressions.", source_name:"Bellingcat", src:"Bellingcat" },
  { id:14, date:"2026-05-14T11:15:00", region:"Gaza & Middle East", category:"diplomatic", escalation_level:3, title:"Egypt-Qatar mediation talks collapse; Hamas withdraws from Cairo", description:"Disagreement over Philadelphi corridor. US envoy returns to Washington for consultations. Ceasefire window assessed as closed.", source_name:"MEE", src:"MEE" },
  { id:15, date:"2026-05-13T14:00:00", region:"South China Sea",    category:"maritime",   escalation_level:3, title:"Philippine supply mission to Ayungin Shoal escorted by two US destroyers", description:"First overt US escort. PLA Navy corvette issued radio warning. FONOP designation disputed by Beijing.", source_name:"CSIS", src:"CSIS" },
  { id:16, date:"2026-05-13T09:30:00", region:"Sudan",              category:"civilian",   escalation_level:3, title:"Mass displacement from Port Sudan as SAF-RSF fighting intensifies", description:"IOM registers 67,000 new IDPs in 72 hours. Aid agencies suspend operations in Red Sea State.", source_name:"ReliefWeb", src:"ReliefWeb" },
  { id:17, date:"2026-05-12T17:20:00", region:"Ethiopia",           category:"military",   escalation_level:3, title:"TPLF splinter faction resumes shelling of Tigray regional capital", description:"Post-Pretoria framework breakdown. UN monitors report withdrawal by federal army from two buffer positions.", source_name:"UN News", src:"UN News" },
  { id:18, date:"2026-05-12T08:00:00", region:"Somalia",            category:"military",   escalation_level:2, title:"Al-Shabaab mortar attack on Mogadishu's Halane compound", description:"One AMISOM soldier killed, three contractors wounded. AFRICOM confirms counter-strike at mortar position.", source_name:"Reuters", src:"Reuters" },
  { id:19, date:"2026-05-11T13:45:00", region:"Syria",              category:"airspace",   escalation_level:2, title:"IDF strikes Iranian weapons cache near Palmyra", description:"Seven strikes destroyed tunnel complex. SOHR reports twelve personnel killed. Russia summoned Israeli envoy.", source_name:"Reuters", src:"Reuters" },
  { id:20, date:"2026-05-11T07:30:00", region:"Taiwan Strait",      category:"maritime",   escalation_level:2, title:"PLA vessel challenges USS Chafee in Luzon Strait", description:"Unsafe intercept at 90 meters. USS Chafee took evasive maneuver. INDOPACOM released bridge camera footage.", source_name:"Reuters", src:"Reuters" },
  { id:21, date:"2026-05-10T15:00:00", region:"Haiti",              category:"civilian",   escalation_level:3, title:"Gang coalition seizes Port-au-Prince waterworks; UN warns of crisis", description:"G9 alliance holds three major infrastructure nodes. MSS Kenya brigade unable to dislodge entrenched positions.", source_name:"UN News", src:"UN News" },
  { id:22, date:"2026-05-10T10:20:00", region:"Ukraine",            category:"military",   escalation_level:4, title:"Massive drone swarm targets Kyiv — 83 Shahed-136 intercepted", description:"Largest single-night drone attack since February 2024. Three fell through air defenses, injuring 14. USAF E-3 Sentry operating in Romanian airspace.", source_name:"Kyiv Independent", src:"Kyiv Independent" },
  { id:23, date:"2026-05-09T09:00:00", region:"Arctic",             category:"maritime",   escalation_level:2, title:"Russian nuclear submarine patrol detected off Norwegian Lofoten", description:"Akula-class tracked for 18 hours by P-8 Poseidons. Norwegian FSB raised alert. NATO MARCOM convened emergency call.", source_name:"SIPRI", src:"SIPRI" },
  { id:24, date:"2026-05-08T14:30:00", region:"South Caucasus",     category:"military",   escalation_level:2, title:"Azerbaijan repositions armored units along Line of Contact in Karabakh", description:"Satellite imagery shows 40+ IFVs within 8km of demarcation line. Armenian PM calls for CSTO consultations.", source_name:"Crisis Group", src:"Crisis Group" },
  { id:25, date:"2026-05-08T11:00:00", region:"Kosovo",             category:"diplomatic", escalation_level:2, title:"Serbia requests UNSC emergency session over Kosovo border provocations", description:"Kfor logs 14 incidents in 72 hours. US State Dept calls on Belgrade to stand down army grouping near Merdare.", source_name:"Reuters", src:"Reuters" },
  { id:26, date:"2026-05-07T16:10:00", region:"Libya",              category:"military",   escalation_level:2, title:"GNU forces advance on Sirte — Wagner-backed units retreat 12km", description:"TUAF drone support credited for breakthrough. Egypt lodges diplomatic protest; maritime patrol increased.", source_name:"Atlantic Council", src:"Atlantic Council" },
  { id:27, date:"2026-05-07T09:45:00", region:"DRC",                category:"civilian",   escalation_level:3, title:"Cholera outbreak in Goma IDP camps threatens 340,000 displaced", description:"WHO declares public health emergency. Supply convoy blocked by M23 checkpoint on RN2.", source_name:"ReliefWeb", src:"ReliefWeb" },
  { id:28, date:"2026-05-06T15:30:00", region:"Mozambique",         category:"military",   escalation_level:2, title:"ISIS-Mozambique attack on Nangade district kills 12 civilians", description:"IS-MOZ overran village 22km from Mueda. SADC Mission Mozambique battalion deployed to reinforce perimeter.", source_name:"ReliefWeb", src:"ReliefWeb" },
  { id:29, date:"2026-05-06T10:00:00", region:"Korean Peninsula",   category:"disinfo",    escalation_level:1, title:"North Korea broadcasts fabricated footage of 'US biological weapon labs'", description:"Doctored satellite imagery distributed via KCNA. ROK NIS flags as part of broader pre-election narrative operation.", source_name:"Wikipedia", src:"Wikipedia" },
  { id:30, date:"2026-05-06T08:20:00", region:"Sahel",              category:"economic",   escalation_level:2, title:"Mali-Niger-Burkina Alliance announces withdrawal from ECOWAS payment system", description:"AES bloc moves to create parallel clearing mechanism backed by Russian Mir protocol.", source_name:"Atlantic Council", src:"Atlantic Council" },
];

export const EXERCISES = [
  {
    id:"ex-1", name:"STEADFAST DEFENDER 26",
    exercise_type:"LIVEX", domain:"Land / Air", region:"Baltic",
    lead_nation:"NATO / SHAPE", scale:22000,
    start_date:"2026-05-12", end_date:"2026-06-14",
    signal_target:"Russia — Eastern Flank deterrence", rhetoric_score:0.7,
    source_url:"https://www.nato.int",
    statements:{ raw_summary:"SACEUR framed exercise as direct response to Russian force buildup opposite Estonia and Latvia." },
  },
  {
    id:"ex-2", name:"AURORA 26",
    exercise_type:"FTX", domain:"Land / Air", region:"Nordic",
    lead_nation:"Sweden / Finland", scale:15000,
    start_date:"2026-05-18", end_date:"2026-06-01",
    signal_target:"General deterrence — High North", rhetoric_score:0.4,
    source_url:"https://www.mil.se",
    statements:{ raw_summary:"First joint exercise as combined NATO ally pair. Scenarios include hybrid incursion defence in northern Lapland." },
  },
  {
    id:"ex-3", name:"DYNAMIC MONGOOSE 26",
    exercise_type:"MAREX", domain:"Maritime / ASW", region:"North Atlantic",
    lead_nation:"NATO / MARCOM", scale:4800,
    start_date:"2026-05-05", end_date:"2026-05-23",
    signal_target:"Russia — submarine deterrence", rhetoric_score:0.6,
    source_url:"https://www.nato.int",
    statements:{ raw_summary:"Anti-submarine warfare focus following Akula-class detection near Lofoten." },
  },
  {
    id:"ex-4", name:"AFRICAN LION 26",
    exercise_type:"FTX", domain:"Land / SOCOM", region:"North Africa",
    lead_nation:"United States / AFRICOM", scale:9500,
    start_date:"2026-06-02", end_date:"2026-06-20",
    signal_target:"General deterrence — Sahel / Maghreb", rhetoric_score:0.3,
    source_url:"https://www.africom.mil",
    statements:{ raw_summary:"Annual exercise expanded to include Sahel counter-VEO scenarios following AES bloc formation." },
  },
  {
    id:"ex-5", name:"TALISMAN SABRE 26",
    exercise_type:"FTX", domain:"Joint / Amphibious", region:"Indo-Pacific",
    lead_nation:"United States / Australia", scale:34000,
    start_date:"2026-07-12", end_date:"2026-08-08",
    signal_target:"China — Indo-Pacific deterrence", rhetoric_score:0.65,
    source_url:"https://www.pacom.mil",
    statements:{ raw_summary:"Largest bilateral exercise in Southern Hemisphere; amphibious seizure scenarios publicly disclosed." },
  },
  {
    id:"ex-6", name:"VOSTOK 26",
    exercise_type:"FTX", domain:"Land / Air", region:"Eastern Russia",
    lead_nation:"Russia", scale:40000,
    start_date:"2026-09-10", end_date:"2026-09-25",
    signal_target:"NATO — strategic signalling", rhetoric_score:0.75,
    source_url:"https://mil.ru",
    statements:{ raw_summary:"Announced by MoD as response to NATO eastern flank buildup. China and North Korea invited as observers." },
  },
  {
    id:"ex-7", name:"CYBER COALITION 26",
    exercise_type:"CPX", domain:"Cyber", region:"NATO — distributed",
    lead_nation:"NATO / CCDCOE", scale:null,
    start_date:"2026-05-27", end_date:"2026-05-30",
    signal_target:"General deterrence — Cyber domain", rhetoric_score:0.3,
    source_url:"https://ccdcoe.org",
    statements:{ raw_summary:"32-nation exercise. Scenarios derived from real 2025–26 threat intelligence including Sandworm TTPs." },
  },
  {
    id:"ex-8", name:"FREEDOM SHIELD 26",
    exercise_type:"LIVEX", domain:"Land / Air / Naval", region:"Korean Peninsula",
    lead_nation:"United States / Republic of Korea", scale:18000,
    start_date:"2026-08-18", end_date:"2026-09-05",
    signal_target:"North Korea — peninsular deterrence", rhetoric_score:0.6,
    source_url:"https://www.usfk.mil",
    statements:{ raw_summary:"Annual combined exercise; DPRK issued warning condemning 'war rehearsal' following nuclear submarine port call." },
  },
];
