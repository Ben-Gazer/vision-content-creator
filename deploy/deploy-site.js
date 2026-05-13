import { deploySite } from '@remotion/lambda';
import { REMOTION_REGION } from './config.js';

const { serveUrl, siteName } = await deploySite({
  entryPoint: new URL('../src/Root.jsx', import.meta.url).pathname,
  region: REMOTION_REGION,
  siteName: 'vision-content-creator',
  options: {
    publicDir: new URL('..', import.meta.url).pathname,
  },
});

console.log('Site deployed:');
console.log(`  REMOTION_SITE_URL=${serveUrl}`);
console.log(`  Site name: ${siteName}`);
