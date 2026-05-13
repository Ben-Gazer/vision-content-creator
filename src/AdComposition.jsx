import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Ad } from './Ad';
import './display.css';
import './fonts.js';

export function AdComposition(props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ease = { easing: (t) => 1 - Math.pow(1 - t, 3) };

  const logoOpacity  = interpolate(frame, [0, 20],   [0, 1], { extrapolateRight: 'clamp' });
  const logoY        = interpolate(frame, [0, 20],   [-24, 0], { extrapolateRight: 'clamp', ...ease });

  const h1Opacity    = interpolate(frame, [15, 40],  [0, 1], { extrapolateRight: 'clamp' });
  const h1X          = interpolate(frame, [15, 40],  [-48, 0], { extrapolateRight: 'clamp', ...ease });

  const h2Opacity    = interpolate(frame, [25, 50],  [0, 1], { extrapolateRight: 'clamp' });
  const h2X          = interpolate(frame, [25, 50],  [-48, 0], { extrapolateRight: 'clamp', ...ease });

  const bodyOpacity  = interpolate(frame, [45, 65],  [0, 1], { extrapolateRight: 'clamp' });

  const photoScale   = interpolate(frame, [0, 180],  [1.05, 1.0], { extrapolateRight: 'clamp' });

  const qrScale   = spring({ frame: frame - 140, fps, config: { damping: 12, stiffness: 180 } });
  const qrOpacity = interpolate(frame, [140, 158], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ width: 1080, height: 1920, background: '#000', fontFamily: 'Poppins, sans-serif' }}>
      <Ad
        {...props}
        logoStyle={{ opacity: logoOpacity, transform: `translateY(${logoY}px)` }}
        headline1Style={{ opacity: h1Opacity, transform: `translateX(${h1X}px)` }}
        headline2Style={{ opacity: h2Opacity, transform: `translateX(${h2X}px)` }}
        bodyStyle={{ opacity: bodyOpacity }}
        photoStyle={{ transform: `scale(${photoScale})`, transformOrigin: 'center center' }}
        qrStyle={{ opacity: qrOpacity, transform: `scale(${qrScale})`, transformOrigin: 'bottom right' }}
      />
    </div>
  );
}
