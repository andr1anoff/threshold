import { useEffect, useRef, useState } from "react";

export default function AnimatedNumber({ value, duration = 1200, format }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  const startVal = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    startVal.current = display;
    startRef.current = null;

    function tick(ts) {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal.current + (target - startVal.current) * eased);
      setDisplay(current);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{format ? format(display) : display.toLocaleString()}</>;
}
