import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * ScrollToTop — resets scroll position on forward navigation.
 *
 * React Router does not manage scroll. When you navigate, it swaps the
 * component but the browser keeps whatever scroll offset it had. Two bugs
 * came out of that:
 *
 *   - Open a region dossier from halfway down the home page → the dossier
 *     opens halfway down. The escalation index, the whole point of the page,
 *     is above the fold and never seen.
 *   - Click Impressum from the footer → it opens at footer height.
 *
 * PUSH / REPLACE (a click) → go to the top. That is what a click means.
 * POP (browser Back / Forward) → leave it alone. The browser restores the
 * previous offset itself, and that is correct: going Back should land you
 * where you were, not at the top of the page you came from.
 *
 * Mount once, above <Routes>. Renders nothing.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType(); // "PUSH" | "REPLACE" | "POP"

  useEffect(() => {
    if (navType === "POP") return;

    // "instant" — an animated scroll on a page that is still mounting looks
    // like a glitch, and it fights the browser's own restoration on slow loads.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, navType]);

  return null;
}
