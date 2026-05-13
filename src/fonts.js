import { staticFile, delayRender, continueRender } from 'remotion';

// Load Poppins self-hosted TTFs before any frame is captured.
// delayRender/continueRender tells Remotion to wait until the promise resolves.
const handle = delayRender('Loading Poppins fonts');

const FONTS = [
  { weight: '600', style: 'normal',  file: 'Poppins-SemiBold.ttf' },
  { weight: '600', style: 'italic',  file: 'Poppins-SemiBoldItalic.ttf' },
  { weight: '700', style: 'normal',  file: 'Poppins-Bold.ttf' },
  { weight: '700', style: 'italic',  file: 'Poppins-BoldItalic.ttf' },
  { weight: '800', style: 'normal',  file: 'Poppins-ExtraBold.ttf' },
  { weight: '800', style: 'italic',  file: 'Poppins-ExtraBoldItalic.ttf' },
];

Promise.all(
  FONTS.map(({ weight, style, file }) =>
    new FontFace('Poppins', `url(${staticFile(`fonts/${file}`)})`, { weight, style }).load()
  )
)
  .then((loaded) => {
    loaded.forEach((f) => document.fonts.add(f));
    continueRender(handle);
  })
  .catch(() => continueRender(handle));
