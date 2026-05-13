import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { AdComposition } from './AdComposition';

const VARIANTS = [
  {
    id: 'ad-price',
    headline: ['Play More.', 'Pay Less.'],
    body: 'Unlock 20% off every booking and early court access with Padel Plus Membership',
    image: 'assets/brand-rally.jpg',
    qrCta: 'Scan to join',
    footerTag: 'Padel Plus Membership',
  },
  {
    id: 'ad-community',
    headline: ['Your Courts.', 'Your Club.'],
    body: 'Join hundreds of members playing more padel, more often, for less',
    image: 'assets/brand-team-four.jpg',
    qrCta: 'Join the club',
    footerTag: 'Padel Plus Membership',
  },
  {
    id: 'ad-urgency',
    headline: ['Stop Waiting.', 'Start Playing.'],
    body: 'Book any court at any Padel Pass venue in seconds. Your next game is closer than you think',
    image: 'assets/brand-handshake.jpg',
    qrCta: 'Book now',
    footerTag: 'Padel Plus Membership',
  },
];

const RemotionRoot = () =>
  VARIANTS.map(({ id, ...props }) => (
    <Composition
      key={id}
      id={id}
      component={AdComposition}
      durationInFrames={180}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={props}
    />
  ));

registerRoot(RemotionRoot);
