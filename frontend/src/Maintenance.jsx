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
  font-size:clamp(16px,1.35vw,21px);
  line-height:1.72;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:clamp(20px,5vw,72px);
  overflow-y:auto;
  overflow-x:hidden;
  text-shadow:0 0 2px rgba(77,255,122,.55),0 0 12px rgba(77,255,122,.18);
  animation:thm-flicker 9s linear infinite;
}
.thm-root *{box-sizing:border-box;margin:0;padding:0}

@keyframes thm-flicker{
  0%   {opacity:1;    filter:brightness(1)}
  8%   {opacity:.985; filter:brightness(1.04)}
  9%   {opacity:1;    filter:brightness(.97)}
  23%  {opacity:1;    filter:brightness(1)}
  24%  {opacity:.96;  filter:brightness(1.07)}
  25%  {opacity:1;    filter:brightness(.99)}
  47%  {opacity:1;    filter:brightness(1)}
  48%  {opacity:.99;  filter:brightness(1.03)}
  62%  {opacity:1;    filter:brightness(.98)}
  63%  {opacity:.93;  filter:brightness(1.09)}
  64%  {opacity:1;    filter:brightness(1)}
  81%  {opacity:1;    filter:brightness(1)}
  82%  {opacity:.975; filter:brightness(1.05)}
  83%  {opacity:1;    filter:brightness(.98)}
  95%  {opacity:1;    filter:brightness(1)}
  96%  {opacity:.955; filter:brightness(1.06)}
  97%  {opacity:1;    filter:brightness(1)}
  100% {opacity:1;    filter:brightness(1)}
}

.thm-crt{position:absolute;inset:0;pointer-events:none;z-index:9}
.thm-crt::before{
  content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(to bottom,
    rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,
    rgba(0,0,0,.30) 3px,rgba(0,0,0,.30) 5px);
}
.thm-crt::after{
  content:"";position:absolute;inset:0;
  background:radial-gradient(ellipse 78% 68% at 50% 50%,
    rgba(0,0,0,0) 42%,rgba(0,0,0,.55) 78%,rgba(0,0,0,.9) 100%);
}
.thm-term{position:relative;z-index:2;width:100%;max-width:min(1100px,86vw)}

.thm-mark{display:flex;align-items:center;gap:1.1em;margin-bottom:2.1em}
.thm-mark svg{display:block;filter:drop-shadow(0 0 6px rgba(77,255,122,.5))}
.thm-wordmark{
  font-size:.82em;letter-spacing:.34em;text-transform:uppercase;color:var(--phos-dim);
}

.thm-rule{border:0;border-top:1px solid var(--phos-ghost);margin:0 0 1.8em}

.thm-title{
  font-size:clamp(34px,6.4vw,86px);font-weight:500;letter-spacing:.01em;
  line-height:1.05;margin-bottom:.18em;
}
.thm-cursor{
  display:inline-block;width:.56em;height:.86em;background:var(--phos);
  vertical-align:-.06em;margin-left:.14em;
  box-shadow:0 0 10px rgba(77,255,122,.8);
  animation:thm-blink 1.1s steps(1) infinite;
}
@keyframes thm-blink{0%,49%{opacity:1}50%,100%{opacity:0}}

.thm-sub{
  color:var(--amber);font-size:.9em;letter-spacing:.17em;text-transform:uppercase;
  margin-bottom:2.3em;
  text-shadow:0 0 2px rgba(255,184,77,.5),0 0 12px rgba(255,184,77,.2);
}

.thm-log{list-style:none;font-size:.92em;margin-bottom:2.3em}
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
  border-left:2px solid var(--phos-ghost);padding-left:1.2em;
  color:var(--phos-dim);font-size:.92em;max-width:64ch;margin-bottom:2.3em;
}
.thm-note strong{color:var(--phos);font-weight:500}

.thm-foot{
  border-top:1px solid var(--phos-ghost);padding-top:1.1em;font-size:.8em;
  color:var(--phos-ghost);display:flex;flex-wrap:wrap;gap:.5em 1.8em;align-items:baseline;
}
.thm-foot a{color:var(--phos-dim);text-decoration:none;border-bottom:1px dotted var(--phos-ghost)}
.thm-foot a:hover,.thm-foot a:focus-visible{color:var(--phos);border-bottom-color:var(--phos)}
.thm-foot a:focus-visible{outline:1px solid var(--phos);outline-offset:3px}
.thm-spacer{flex:1 1 auto}

@media (max-width:560px){
  .thm-root{font-size:14px;align-items:flex-start;padding-top:36px}
  .thm-term{max-width:100%}
  .thm-log{font-size:11.5px}
  .thm-log .thm-dots{letter-spacing:.08em;min-width:1ch}
  .thm-sub{font-size:.86em;letter-spacing:.12em}
}

@media (prefers-reduced-motion:reduce){
  .thm-root{animation:none}
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

      <main className="thm-term">
        <div className="thm-mark">
          <svg width="1em" height="1em" viewBox="0 0 32 32" style={{ width: "2.4em", height: "2.4em" }} role="img" aria-label="Threshold">
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
                {"·".repeat(160)}
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
          <a href="https://evandrianov.pro/">Ivan Andrianov</a>
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
