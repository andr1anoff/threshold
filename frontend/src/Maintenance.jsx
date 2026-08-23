import { useEffect, useState } from "react";

/**
 * Threshold maintenance screen.
 *
 * Rendered instead of the app when VITE_MAINTENANCE === "true".
 * Self-contained: injects its own styles, imports no CSS, touches no router.
 * Turn it off by removing the env var and redeploying (see MAINTENANCE.md).
 */

const LINES = [
  { k: "Incident scraper", v: "running", tone: "ok" },
  { k: "Escalation index", v: "halted", tone: "halt" },
  { k: "Exercise registry", v: "rebuilding", tone: "warn" },
  { k: "Published values", v: "withheld", tone: "warn" },
  { k: "Public repository", v: "open", tone: "ok" },
];

const CSS = `
.thm-root{
  --void:#060a06;
  --phos:#4dff7a;
  --phos-dim:#2a8f45;
  --phos-ghost:#164a24;
  --amber:#ffb84d;
  --crimson:#e0483a;
  --thm-mono:"DM Mono","IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;

  position:fixed;
  inset:0;
  z-index:2147483647;
  background:var(--void);
  color:var(--phos);
  font-family:var(--thm-mono);
  font-size:15px;
  line-height:1.7;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:clamp(16px,4vw,48px);
  overflow-y:auto;
  overflow-x:hidden;
  text-shadow:0 0 2px rgba(77,255,122,.55),0 0 12px rgba(77,255,122,.18);
  animation:thm-flicker 6s steps(1) infinite;
}
.thm-root *{box-sizing:border-box;margin:0;padding:0}

@keyframes thm-flicker{
  0%,96%,100%{opacity:1}
  97%{opacity:.94}
  98%{opacity:1}
  99%{opacity:.97}
}

.thm-crt{position:absolute;inset:0;pointer-events:none;z-index:9}
.thm-crt::before{
  content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(to bottom,
    rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,
    rgba(0,0,0,.34) 3px,rgba(0,0,0,.34) 4px);
}
.thm-crt::after{
  content:"";position:absolute;inset:0;
  background:radial-gradient(ellipse 78% 68% at 50% 50%,
    rgba(0,0,0,0) 42%,rgba(0,0,0,.55) 78%,rgba(0,0,0,.9) 100%);
}
.thm-sweep{
  position:absolute;left:0;right:0;height:180px;z-index:10;pointer-events:none;
  background:linear-gradient(to bottom,
    rgba(77,255,122,0) 0%,rgba(77,255,122,.035) 50%,rgba(77,255,122,0) 100%);
  animation:thm-sweep 7s linear infinite;
}
@keyframes thm-sweep{
  0%{transform:translateY(-200px)}
  100%{transform:translateY(105vh)}
}

.thm-term{position:relative;z-index:2;width:100%;max-width:720px}

.thm-mark{display:flex;align-items:center;gap:14px;margin-bottom:30px}
.thm-mark svg{display:block;filter:drop-shadow(0 0 6px rgba(77,255,122,.5))}
.thm-wordmark{
  font-size:13px;letter-spacing:.34em;text-transform:uppercase;color:var(--phos-dim);
}

.thm-rule{border:0;border-top:1px solid var(--phos-ghost);margin:0 0 26px}

.thm-title{
  font-size:clamp(30px,7vw,54px);font-weight:500;letter-spacing:.02em;
  line-height:1.08;margin-bottom:6px;
}
.thm-cursor{
  display:inline-block;width:.56em;height:.86em;background:var(--phos);
  vertical-align:-.06em;margin-left:.14em;
  box-shadow:0 0 10px rgba(77,255,122,.8);
  animation:thm-blink 1.1s steps(1) infinite;
}
@keyframes thm-blink{0%,49%{opacity:1}50%,100%{opacity:0}}

.thm-sub{
  color:var(--amber);font-size:14px;letter-spacing:.16em;text-transform:uppercase;
  margin-bottom:34px;
  text-shadow:0 0 2px rgba(255,184,77,.5),0 0 12px rgba(255,184,77,.2);
}

.thm-log{list-style:none;font-size:13.5px;margin-bottom:34px}
.thm-log li{
  display:flex;align-items:baseline;gap:.6ch;
  color:var(--phos-dim);white-space:nowrap;
  opacity:0;transition:opacity .18s linear;
}
.thm-log li.thm-on{opacity:1}
.thm-log .thm-k{flex:0 0 auto;white-space:nowrap}
.thm-log .thm-dots{
  flex:1 1 auto;min-width:2ch;overflow:hidden;white-space:nowrap;
  color:var(--phos-ghost);letter-spacing:.2em;
}
.thm-log .thm-v{flex:0 0 auto;white-space:nowrap;color:var(--phos)}
.thm-log .thm-v.thm-warn{color:var(--amber)}
.thm-log .thm-v.thm-halt{
  color:var(--crimson);
  text-shadow:0 0 2px rgba(224,72,58,.6),0 0 12px rgba(224,72,58,.25);
}

.thm-note{
  border-left:2px solid var(--phos-ghost);padding-left:16px;
  color:var(--phos-dim);font-size:13.5px;max-width:58ch;margin-bottom:34px;
}
.thm-note strong{color:var(--phos);font-weight:500}

.thm-foot{
  border-top:1px solid var(--phos-ghost);padding-top:16px;font-size:12px;
  color:var(--phos-ghost);display:flex;flex-wrap:wrap;gap:6px 22px;align-items:baseline;
}
.thm-foot a{color:var(--phos-dim);text-decoration:none;border-bottom:1px dotted var(--phos-ghost)}
.thm-foot a:hover,.thm-foot a:focus-visible{color:var(--phos);border-bottom-color:var(--phos)}
.thm-foot a:focus-visible{outline:1px solid var(--phos);outline-offset:3px}
.thm-spacer{flex:1 1 auto}

@media (max-width:560px){
  .thm-root{font-size:14px;align-items:flex-start;padding-top:40px}
  .thm-log{font-size:11.5px}
  .thm-log .thm-dots{letter-spacing:.08em;min-width:1ch}
  .thm-sub{font-size:12px;letter-spacing:.12em}
}

@media (prefers-reduced-motion:reduce){
  .thm-root{animation:none}
  .thm-sweep{display:none}
  .thm-cursor{animation:none}
  .thm-log li{opacity:1;transition:none}
}
`;

export default function Maintenance() {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    document.title = "Threshold — under maintenance";
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setShown(LINES.length);
      return;
    }

    const timers = LINES.map((_, i) =>
      setTimeout(() => setShown((n) => Math.max(n, i + 1)), 200 + i * 220)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="thm-root">
      <style>{CSS}</style>
      <div className="thm-crt" aria-hidden="true" />
      <div className="thm-sweep" aria-hidden="true" />

      <main className="thm-term">
        <div className="thm-mark">
          <svg width="34" height="34" viewBox="0 0 32 32" role="img" aria-label="Threshold">
            <rect x="3" y="6" width="10" height="4" fill="#e0483a" />
            <rect x="11" y="12" width="10" height="4" fill="currentColor" />
            <rect x="19" y="18" width="10" height="4" fill="currentColor" />
          </svg>
          <span className="thm-wordmark">Threshold</span>
        </div>

        <hr className="thm-rule" />

        <h1 className="thm-title">
          Please stand by
          <span className="thm-cursor" aria-hidden="true" />
        </h1>
        <p className="thm-sub">System offline for methodological revision</p>

        <ul className="thm-log">
          {LINES.map((line, i) => (
            <li key={line.k} className={i < shown ? "thm-on" : ""}>
              <span className="thm-k">{line.k}</span>
              <span className="thm-dots" aria-hidden="true">
                {"·".repeat(120)}
              </span>
              <span
                className={
                  "thm-v" +
                  (line.tone === "warn" ? " thm-warn" : "") +
                  (line.tone === "halt" ? " thm-halt" : "")
                }
              >
                {line.v}
              </span>
            </li>
          ))}
        </ul>

        <p className="thm-note">
          A pre-registered event study found that the escalation index does not
          lead escalation events. Rather than leave numbers up that I cannot
          defend, the index is down until the exercise data underneath it is
          rebuilt.{" "}
          <strong>
            Nothing here was ever synthetic, and it is not going to start now.
          </strong>
        </p>

        <footer className="thm-foot">
          <span>Ivan Andrianov</span>
          <a href="https://github.com/andr1anoff/threshold">Repository</a>
          <a href="mailto:ivaa03@zedat.fu-berlin.de">Contact</a>
          <span className="thm-spacer" />
          <a href="/impressum">Impressum</a>
          <a href="/datenschutz">Datenschutz</a>
        </footer>
      </main>
    </div>
  );
}
