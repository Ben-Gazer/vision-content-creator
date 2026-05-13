/**
 * Seeds the Padel Pass client record in Directus and uploads all brand assets
 * (logo + three campaign images) to Directus Files.
 *
 * Safe to re-run — checks for an existing client record before creating one.
 *
 * Usage:
 *   DIRECTUS_URL=https://your-project.up.railway.app \
 *   DIRECTUS_TOKEN=your-admin-token \
 *   node directus/seed-padel-pass.js
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.DIRECTUS_URL;
const TOKEN = process.env.DIRECTUS_TOKEN;

if (!BASE || !TOKEN) {
  console.error('DIRECTUS_URL and DIRECTUS_TOKEN must be set');
  process.exit(1);
}

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../');

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data?.errors?.[0]?.message}`);
  return data.data;
}

async function uploadFile(localPath, title) {
  const filename = path.basename(localPath);
  const ext = filename.split('.').pop().toLowerCase();
  const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
  const type = mimeTypes[ext] ?? 'application/octet-stream';

  const bytes = await readFile(localPath);
  const form = new FormData();
  form.append('title', title);
  form.append('file', new Blob([bytes], { type }), filename);

  const res = await fetch(`${BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload ${filename} → ${res.status}: ${data?.errors?.[0]?.message}`);
  console.log(`  uploaded: ${title} (${data.data.id})`);
  return data.data.id;
}

// ─── Upload brand assets ──────────────────────────────────────────────────────

console.log('\nUploading brand assets…');

const [logoId, rallyId, teamFourId, handshakeId] = await Promise.all([
  uploadFile(path.join(ROOT, 'assets/logo-padel-pass-stacked-on-dark.png'), 'Padel Pass — Logo (stacked, dark)'),
  uploadFile(path.join(ROOT, 'assets/brand-rally.jpg'),                     'Padel Pass — Brand Rally'),
  uploadFile(path.join(ROOT, 'assets/brand-team-four.jpg'),                 'Padel Pass — Brand Team Four'),
  uploadFile(path.join(ROOT, 'assets/brand-handshake.jpg'),                 'Padel Pass — Brand Handshake'),
]);

// ─── Create or fetch client record ───────────────────────────────────────────

console.log('\nChecking for existing client record…');

const existing = await api('GET', '/items/clients?filter[slug][_eq]=padel-pass&limit=1');

let clientId;
if (existing.length > 0) {
  clientId = existing[0].id;
  console.log(`  found existing client: ${clientId}`);
  await api('PATCH', `/items/clients/${clientId}`, { logo: logoId });
  console.log('  updated logo');
} else {
  const client = await api('POST', '/items/clients', {
    slug: 'padel-pass',
    name: 'Padel Pass',
    venue: 'Padel Pass · Luton',
    footer_tag: 'Padel Plus Membership',
    default_qr_url: 'https://padelpass.co.uk/membership',
    logo: logoId,
  });
  clientId = client.id;
  console.log(`  created client: ${clientId}`);
}

// ─── Print asset IDs for Make.com / reference ────────────────────────────────

console.log('\n✓ Seed complete.\n');
console.log('Asset IDs (use these in variant records or Make.com):');
console.log(`  logo              ${logoId}`);
console.log(`  brand-rally       ${rallyId}`);
console.log(`  brand-team-four   ${teamFourId}`);
console.log(`  brand-handshake   ${handshakeId}`);
console.log(`\nClient ID: ${clientId}`);
console.log('\nDirectus CDN URL pattern:');
console.log(`  ${BASE}/assets/{file-id}`);
