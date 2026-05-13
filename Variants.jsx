// A/B/C test variants for the display Ad.
// Three message angles: Price, Community, Urgency.

const VARIANTS = [
  {
    id: "a",
    label: "A — Price",
    props: {
      headline: ["Play More.", "Pay Less."],
      body: "Unlock 20% off every booking and early court access with Padel Plus Membership",
      image: "assets/brand-rally.jpg",
      qrUrl: "https://padelpass.co.uk/membership",
      qrCta: "Scan to join",
      footerTag: "Padel Plus Membership",
    },
  },
  {
    id: "b",
    label: "B — Community",
    props: {
      headline: ["Your Courts.", "Your Club."],
      body: "Join hundreds of members playing more padel, more often, for less",
      image: "assets/brand-team-four.jpg",
      qrUrl: "https://padelpass.co.uk/membership",
      qrCta: "Join the club",
      footerTag: "Padel Plus Membership",
    },
  },
  {
    id: "c",
    label: "C — Urgency",
    props: {
      headline: ["Stop Waiting.", "Start Playing."],
      body: "Book any court at any Padel Pass venue in seconds. Your next game is closer than you think",
      image: "assets/brand-handshake.jpg",
      qrUrl: "https://padelpass.co.uk/membership",
      qrCta: "Book now",
      footerTag: "Padel Plus Membership",
    },
  },
];

const variantLabelStyle = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(0,0,0,0.75)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 999,
  padding: "10px 28px",
  display: "flex",
  alignItems: "center",
  gap: 20,
  zIndex: 100,
  fontFamily: "var(--ff-display)",
  fontWeight: 700,
  fontSize: 18,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#fff",
  userSelect: "none",
};

const dotStyle = (active) => ({
  width: active ? 32 : 12,
  height: 12,
  borderRadius: 999,
  background: active ? "#73BB12" : "rgba(255,255,255,0.3)",
  border: "none",
  padding: 0,
  cursor: "pointer",
  transition: "all 200ms ease-out",
});

function VariantSwitcher() {
  const [idx, setIdx] = React.useState(0);
  const v = VARIANTS[idx];

  React.useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % VARIANTS.length);
      else if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + VARIANTS.length) % VARIANTS.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Ad {...v.props} />
      <div style={variantLabelStyle}>
        {VARIANTS.map((vr, i) => (
          <button key={vr.id} style={dotStyle(i === idx)} onClick={() => setIdx(i)} aria-label={vr.label} />
        ))}
        <span style={{ paddingLeft: 8, borderLeft: "1px solid rgba(255,255,255,0.2)", marginLeft: 4 }}>
          {v.label}
        </span>
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<VariantSwitcher />);
