// Frame — 1080×1920 stage + venue header + footer rail.
// Also exports a Stage component that scales the canvas to viewport.

const { useState: dpUseState, useEffect: dpUseEffect, useRef: dpUseRef } = React;

function Stage({ children }) {
  const ref = dpUseRef(null);
  dpUseEffect(() => {
    function fit() {
      const el = ref.current;
      if (!el) return;
      const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
      el.style.transform = `scale(${s})`;
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="dp-stage">
      <div className="dp-canvas" ref={ref}>
        {children}
      </div>
    </div>
  );
}

function useClock() {
  const [now, setNow] = dpUseState(new Date());
  dpUseEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function fmtTime(d) {
  return d.toTimeString().slice(0, 5);
}

function fmtDate(d) {
  return d.toLocaleDateString("en-GB", {
    weekday: "short", day: "2-digit", month: "short"
  }).toUpperCase();
}

function Frame({
  venue = "Padel Pass · Luton",
  footerTag = "Feel Good Padel for Everyone",
  footerRight,
  children,
}) {
  const now = useClock();
  return (
    <div className="dp-frame">
      <div className="dp-header">
        <span className="venue">{venue}</span>
        <span className="date">{fmtDate(now)}</span>
        <span className="clock">{fmtTime(now)}</span>
      </div>
      <div className="dp-screen">{children}</div>
      <div className="dp-footer">
        <span className="tag">— {footerTag}</span>
        <span style={{ marginLeft: "auto" }}>{footerRight || "padelpass.co.uk"}</span>
      </div>
    </div>
  );
}

Object.assign(window, { Stage, Frame });
