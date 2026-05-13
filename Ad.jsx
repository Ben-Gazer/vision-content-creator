// Ad — reusable promotional poster for the 1080×1920 display canvas.
// Props let you swap copy, image, and QR target per campaign.

function Ad({
  headline = ["Play More.", "Pay Less."],
  body = "Unlock 20% off every booking and early court access with Padel Plus Membership",
  image = "assets/brand-rally.jpg",
  qrUrl = "https://padelpass.co.uk/membership",
  qrCta = "Scan to join",
  footerTag = "Padel Plus Membership",
  venue = "Padel Pass · Luton",
}) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(qrUrl)}`;
  return (
    <Stage>
      <Frame venue={venue} footerTag={footerTag}>
        <div className="dp-ad">
          <img
            className="logo"
            src="assets/logo-padel-pass-stacked-on-dark.png"
            alt="Padel Pass"
          />
          <div className="headline">
            {headline.map((line, i) => (
              <span key={i} style={{ display: "block" }}>{line}</span>
            ))}
          </div>
          <div className="body">{body}</div>
          <div className="photoWrap">
            <div className="photo" style={{ backgroundImage: `url('${image}')` }} />
            <div className="qrBlock">
              <img className="qr" src={qrSrc} alt="QR code" />
              <div className="qrCta">{qrCta}</div>
            </div>
          </div>
        </div>
      </Frame>
    </Stage>
  );
}

Object.assign(window, { Ad });
