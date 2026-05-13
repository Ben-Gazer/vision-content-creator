/**
 * Bundles api/render.js with esbuild, deploys it as an AWS Lambda function,
 * and enables a Function URL so Make.com can call it directly over HTTPS.
 *
 * Requires these env vars (in .env):
 *   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   REMOTION_FUNCTION_NAME, REMOTION_SITE_URL
 *   RENDER_API_ROLE_ARN  (IAM role ARN for the Lambda — see README)
 *
 * Usage:
 *   npm run deploy:render-api
 */

import { build } from 'esbuild';
import { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand,
         UpdateFunctionConfigurationCommand, AddPermissionCommand,
         CreateFunctionUrlConfigCommand, GetFunctionUrlConfigCommand,
         GetFunctionCommand } from '@aws-sdk/client-lambda';
import { readFile, rm, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT    = path.resolve(fileURLToPath(import.meta.url), '../../');
const DIST    = path.join(ROOT, 'dist');
const BUNDLE  = path.join(DIST, 'render.mjs');
const ZIPFILE = path.join(DIST, 'render.zip');

const REGION        = process.env.AWS_REGION ?? 'eu-west-2';
const FUNCTION_NAME = 'vision-render-api';
const ROLE_ARN      = process.env.RENDER_API_ROLE_ARN;

if (!ROLE_ARN) {
  console.error('RENDER_API_ROLE_ARN must be set in .env — see README for setup steps');
  process.exit(1);
}

const lambda = new LambdaClient({ region: REGION });

// ─── 1. Bundle ────────────────────────────────────────────────────────────────

console.log('\nBundling api/render.js…');
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

await build({
  entryPoints: [path.join(ROOT, 'api/render.js')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: BUNDLE,
  external: ['@aws-sdk/*'],  // use Lambda's built-in AWS SDK
});

// ─── 2. Zip ───────────────────────────────────────────────────────────────────

console.log('Creating zip…');
execSync(`zip -j "${ZIPFILE}" "${BUNDLE}"`);
const zipBytes = await readFile(ZIPFILE);

// ─── 3. Deploy Lambda ─────────────────────────────────────────────────────────

let exists = false;
try {
  await lambda.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
  exists = true;
} catch {}

const envVars = {
  AWS_REGION:              REGION,
  REMOTION_FUNCTION_NAME:  process.env.REMOTION_FUNCTION_NAME ?? '',
  REMOTION_SITE_URL:       process.env.REMOTION_SITE_URL ?? '',
};

if (exists) {
  console.log('Updating existing Lambda…');
  await lambda.send(new UpdateFunctionCodeCommand({
    FunctionName: FUNCTION_NAME,
    ZipFile: zipBytes,
  }));
  // Wait briefly for code update to propagate
  await new Promise(r => setTimeout(r, 3000));
  await lambda.send(new UpdateFunctionConfigurationCommand({
    FunctionName: FUNCTION_NAME,
    Environment: { Variables: envVars },
    Timeout: 600,
    MemorySize: 512,
  }));
} else {
  console.log('Creating Lambda…');
  await lambda.send(new CreateFunctionCommand({
    FunctionName: FUNCTION_NAME,
    Runtime: 'nodejs20.x',
    Role: ROLE_ARN,
    Handler: 'render.handler',
    Code: { ZipFile: zipBytes },
    Environment: { Variables: envVars },
    Timeout: 600,
    MemorySize: 512,
    Architectures: ['arm64'],
  }));
}

// ─── 4. Function URL ──────────────────────────────────────────────────────────

let functionUrl;
try {
  const res = await lambda.send(new GetFunctionUrlConfigCommand({ FunctionName: FUNCTION_NAME }));
  functionUrl = res.FunctionUrl;
  console.log('Function URL already exists.');
} catch {
  console.log('Creating Function URL…');
  await lambda.send(new AddPermissionCommand({
    FunctionName: FUNCTION_NAME,
    StatementId:  'FunctionURLAllowPublicAccess',
    Action:       'lambda:InvokeFunctionUrl',
    Principal:    '*',
    FunctionUrlAuthType: 'NONE',
  }));
  const res = await lambda.send(new CreateFunctionUrlConfigCommand({
    FunctionName: FUNCTION_NAME,
    AuthType: 'NONE',
    Cors: {
      AllowOrigins: ['*'],
      AllowMethods: ['POST'],
      AllowHeaders: ['content-type'],
    },
  }));
  functionUrl = res.FunctionUrl;
}

console.log('\n✓ Render API deployed.\n');
console.log(`Add to .env:`);
console.log(`  RENDER_API_URL=${functionUrl}`);
