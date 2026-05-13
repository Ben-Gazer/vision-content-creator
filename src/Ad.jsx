import React from 'react';
import { staticFile } from 'remotion';
import { Frame } from './Frame';

export function Ad({
  headline = ['Play More.', 'Pay Less.'],
  body = 'Unlock 20% off every booking and early court access with Padel Plus Membership',
  image = 'assets/brand-rally.jpg',
  qrUrl = 'https://padelpass.co.uk/membership',
  qrCta = 'Scan to join',
  footerTag = 'Padel Plus Membership',
  venue = 'Padel Pass · Luton',
  logoStyle,
  headline1Style,
  headline2Style,
  bodyStyle,
  photoStyle,
  qrStyle,
}) {
  const logoSrc = staticFile('assets/logo-padel-pass-stacked-on-dark.png');
  const imageSrc = image.startsWith('http') ? image : staticFile(image);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(qrUrl)}`;

  return (
    <Frame venue={venue} footerTag={footerTag}>
      <div className="dp-ad">
        <img
          className="logo"
          src={logoSrc}
          alt="Padel Pass"
          style={logoStyle}
        />
        <div className="headline">
          <span style={{ display: 'block', ...headline1Style }}>{headline[0]}</span>
          <span style={{ display: 'block', ...headline2Style }}>{headline[1]}</span>
        </div>
        <div className="body" style={bodyStyle}>{body}</div>
        <div className="photoWrap">
          <div
            className="photo"
            style={{ backgroundImage: `url('${imageSrc}')`, ...photoStyle }}
          />
          <div className="qrBlock" style={qrStyle}>
            <img className="qr" src={qrSrc} alt="QR code" />
            <div className="qrCta">{qrCta}</div>
          </div>
        </div>
      </div>
    </Frame>
  );
}
