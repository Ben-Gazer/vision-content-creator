import React from 'react';

export function Frame({
  venue = 'Padel Pass · Luton',
  footerTag = 'Feel Good Padel for Everyone',
  footerRight = 'padelpass.co.uk',
  children,
}) {
  return (
    <div className="dp-frame">
      <div className="dp-header">
        <span className="venue">{venue}</span>
      </div>
      <div className="dp-screen">{children}</div>
      <div className="dp-footer">
        <span className="tag">— {footerTag}</span>
        <span style={{ marginLeft: 'auto' }}>{footerRight}</span>
      </div>
    </div>
  );
}
