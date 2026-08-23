# Maintenance mode

The maintenance screen is a single component gated behind one environment
variable. Nothing else in the app is aware of it: no router change, no CSS
import, no build config. Turning it on and off is a Vercel setting plus a
redeploy.

## Files

| File | Where it goes |
|---|---|
| `Maintenance.jsx` | `src/Maintenance.jsx` |
| `MAINTENANCE.md` | repo root (this file) |

## One-time wiring

Find your entry file:

```bash
cd ~/threshold
ls src/main.jsx src/main.tsx src/index.jsx 2>/dev/null
```

Open it. It currently looks roughly like this:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Add the import and the guard:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Maintenance from "./Maintenance";
import "./index.css";

const MAINTENANCE = import.meta.env.VITE_MAINTENANCE === "true";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {MAINTENANCE ? <Maintenance /> : <App />}
  </React.StrictMode>
);
```

That is the entire code change. The default is off: with the variable unset,
the strict string comparison fails and the app renders normally.

If your entry file is somewhere else or wraps `<App />` in providers, put the
ternary as tight around `<App />` as possible so the providers still mount.

## Turning it on

Vercel dashboard, project Threshold, Settings, Environment Variables:

```
Name:        VITE_MAINTENANCE
Value:       true
Environment: Production
```

Then Deployments, latest, Redeploy. Vite bakes `import.meta.env` at build
time, so changing the variable without a redeploy does nothing.

## Turning it off

Delete the variable (or set it to anything other than `true`) and redeploy.
Roughly ninety seconds end to end. The component can stay in the repo.

## Local check before you push

```bash
cd ~/threshold
VITE_MAINTENANCE=true npm run dev
```

Open the dev URL. You should see the terminal screen. Stop, run `npm run dev`
without the variable, confirm the site is back.

## Deploying the change

Files arrive in `~/Downloads`. Adjust the source path if your browser unpacked
them into a subfolder.

```bash
cd ~/threshold
git pull --rebase origin main

cp ~/Downloads/Maintenance.jsx src/Maintenance.jsx
cp ~/Downloads/MAINTENANCE.md  MAINTENANCE.md
# then edit src/main.jsx by hand as shown above

git status --short
git add src/Maintenance.jsx src/main.jsx MAINTENANCE.md
git commit -m "feat: maintenance screen behind VITE_MAINTENANCE

Renders a standalone terminal screen instead of the app while the
escalation index is withdrawn pending the exercise registry rebuild.
Off by default; enabled by setting VITE_MAINTENANCE=true in Vercel."
git push origin main
```

Pushing does not switch anything on. The screen appears only once
`VITE_MAINTENANCE=true` is set in Vercel and a build runs with it.

## Routes that stay reachable

The component covers the whole viewport, so `/impressum` and `/datenschutz`
are not reachable while it is on. Both are linked in its footer, but those
links land back on the maintenance screen.

If you want the legal pages to stay live, keep the guard out of `main.jsx` and
put it inside your router instead, wrapping every route except those two.
Roughly:

```jsx
{MAINTENANCE ? (
  <Routes>
    <Route path="/impressum" element={<Impressum />} />
    <Route path="/datenschutz" element={<Datenschutz />} />
    <Route path="*" element={<Maintenance />} />
  </Routes>
) : (
  <AppRoutes />
)}
```

## Fallback

`threshold-maintenance.html` is the same screen as a plain static page with no
build step. Use it if the Vercel build itself breaks and you need something up
immediately: rename it to `index.html` and drop it in as a static deployment.
