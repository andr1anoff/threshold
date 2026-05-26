const BASE = import.meta.env.VITE_API_URL || "https://threshold-production-d13c.up.railway.app";

const get = (path) => fetch(`${BASE}${path}`).then(r => r.json()).catch(() => ({ data: [] }));

export const api = {
  incidents: {
    list:      ()       => get("/api/incidents/"),
    byRegion:  (region) => get(`/api/incidents/?region=${encodeURIComponent(region)}`),
  },
  exercises: {
    list: () => get("/api/exercises/"),
  },
  di: {
    global:   ()       => get("/api/di/global"),
    byRegion: (region) => get(`/api/di/region/${encodeURIComponent(region)}`),
    history:  (region) => get(`/api/di/history/${encodeURIComponent(region)}`),
  },
};
