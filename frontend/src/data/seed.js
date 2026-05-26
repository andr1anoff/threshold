export const REGIONS = [
  { id:"Gaza & Middle East",  label:"Gaza & Middle East", short:"GZ",  ei:58, prev:56, trend:+2,  category:"conflict", lat:31.5, lng:34.5, theatre:"levant"      },
  { id:"Ukraine",             label:"Ukraine",            short:"UA",  ei:58, prev:58, trend:0,   category:"conflict", lat:49,   lng:32,   theatre:"easteuro"    },
  { id:"Sudan",               label:"Sudan",              short:"SD",  ei:41, prev:40, trend:+1,  category:"conflict", lat:15,   lng:30,   theatre:"hornafrica"  },
  { id:"South China Sea",     label:"South China Sea",    short:"SCS", ei:32, prev:31, trend:+1,  category:"tension",  lat:13,   lng:114,  theatre:"indo"        },
  { id:"Taiwan Strait",       label:"Taiwan Strait",      short:"TW",  ei:28, prev:28, trend:0,   category:"tension",  lat:24,   lng:121,  theatre:"indo"        },
  { id:"Yemen",               label:"Yemen",              short:"YE",  ei:38, prev:39, trend:-1,  category:"conflict", lat:15.5, lng:48,   theatre:"levant"      },
  { id:"Sahel",               label:"Sahel",              short:"SH",  ei:40, prev:38, trend:+2,  category:"conflict", lat:15,   lng:0,    theatre:"westafrica"  },
  { id:"Korean Peninsula",    label:"Korean Peninsula",   short:"KR",  ei:24, prev:24, trend:0,   category:"tension",  lat:38,   lng:127,  theatre:"indo"        },
  { id:"Myanmar",             label:"Myanmar",            short:"MM",  ei:35, prev:35, trend:0,   category:"conflict", lat:21,   lng:96,   theatre:"indo"        },
  { id:"DRC",                 label:"DRC",                short:"CD",  ei:36, prev:35, trend:+1,  category:"conflict", lat:-2,   lng:23,   theatre:"centafrica"  },
  { id:"Syria",               label:"Syria",              short:"SY",  ei:30, prev:31, trend:-1,  category:"conflict", lat:35,   lng:38,   theatre:"levant"      },
  { id:"Somalia",             label:"Somalia",            short:"SO",  ei:34, prev:34, trend:0,   category:"conflict", lat:6,    lng:46,   theatre:"hornafrica"  },
  { id:"Baltic",              label:"Baltic",             short:"BLT", ei:22, prev:19, trend:+3,  category:"tension",  lat:58,   lng:24,   theatre:"easteuro"    },
  { id:"Haiti",               label:"Haiti",              short:"HT",  ei:33, prev:33, trend:0,   category:"conflict", lat:19,   lng:-72,  theatre:"caribbean"   },
  { id:"Ethiopia",            label:"Ethiopia",           short:"ET",  ei:31, prev:32, trend:-1,  category:"conflict", lat:9,    lng:40,   theatre:"hornafrica"  },
  { id:"South Caucasus",      label:"South Caucasus",     short:"SC",  ei:27, prev:26, trend:+1,  category:"tension",  lat:41,   lng:45,   theatre:"easteuro"    },
  { id:"Libya",               label:"Libya",              short:"LY",  ei:29, prev:29, trend:0,   category:"conflict", lat:27,   lng:17,   theatre:"levant"      },
  { id:"Kosovo",              label:"Kosovo",             short:"KS",  ei:18, prev:18, trend:0,   category:"tension",  lat:42.5, lng:21,   theatre:"easteuro"    },
  { id:"Arctic",              label:"Arctic",             short:"AR",  ei:14, prev:12, trend:+2,  category:"tension",  lat:78,   lng:20,   theatre:"arctic"      },
  { id:"Mozambique",          label:"Mozambique",         short:"MZ",  ei:28, prev:28, trend:0,   category:"conflict", lat:-15,  lng:39,   theatre:"centafrica"  },
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
