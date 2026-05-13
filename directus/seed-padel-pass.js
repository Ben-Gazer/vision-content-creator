/**
 * Seeds the Padel Pass client in Directus using local design system assets.
 *
 * - Creates a folder hierarchy: Padel Pass / Logo + Padel Pass / Brand Photography
 * - Uploads each asset into the correct folder with design-system-derived tags
 * - Creates (or updates) the client record
 *
 * Safe to re-run — skips folder/client creation if they already exist.
 *
 * Usage:
 *   npm run directus:seed:padel-pass
 */

import { readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.DIRECTUS_URL?.replace(/\/$/, '');
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

// ─── Folders ──────────────────────────────────────────────────────────────────

async function getOrCreateFolder(name, parent = null) {
  const filter = parent
    ? `/folders?filter[name][_eq]=${encodeURIComponent(name)}&filter[parent][_eq]=${parent}&limit=1`
    : `/folders?filter[name][_eq]=${encodeURIComponent(name)}&filter[parent][_null]=true&limit=1`;

  const existing = await api('GET', filter);
  if (existing.length > 0) {
    console.log(`  folder exists: ${name}`);
    return existing[0].id;
  }
  const folder = await api('POST', '/folders', { name, ...(parent ? { parent } : {}) });
  console.log(`  ✓ Created folder: ${name}`);
  return folder.id;
}

// ─── File upload ──────────────────────────────────────────────────────────────

async function uploadFile(localPath, { title, folder, tags }) {
  const filename = path.basename(localPath);
  const ext = filename.split('.').pop().toLowerCase();
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[ext] ?? 'application/octet-stream';

  const form = new FormData();
  form.append('title', title);
  form.append('folder', folder);
  form.append('tags', JSON.stringify(tags));
  form.append('file', new Blob([await readFile(localPath)], { type: mime }), filename);

  const res = await fetch(`${BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload ${filename} → ${res.status}: ${data?.errors?.[0]?.message}`);
  console.log(`  ✓ ${title}`);
  return data.data.id;
}

// ─── Folder structure ─────────────────────────────────────────────────────────

console.log('\nSetting up folder structure…');

const rootFolderId  = await getOrCreateFolder('Padel Pass');
const logoFolderId  = await getOrCreateFolder('Logo', rootFolderId);
const photoFolderId = await getOrCreateFolder('Brand — Colour Lifestyle', rootFolderId);

// ─── Upload assets ────────────────────────────────────────────────────────────

console.log('\nUploading assets…');

const [logoId, rallyId, teamFourId, handshakeId] = await Promise.all([
  uploadFile(path.join(ROOT, 'assets/logo-padel-pass-stacked-on-dark.png'), {
    title:  'Logo — Stacked, Dark Background',
    folder: logoFolderId,
    tags:   ['padel-pass', 'brand', 'logo', 'identity'],
  }),
  uploadFile(path.join(ROOT, 'assets/brand-rally.jpg'), {
    title:  'Brand — Colour Lifestyle: Match Action',
    folder: photoFolderId,
    tags:   ['padel-pass', 'brand', 'colour-lifestyle', 'match-action'],
  }),
  uploadFile(path.join(ROOT, 'assets/brand-team-four.jpg'), {
    title:  'Brand — Colour Lifestyle: Team Hero',
    folder: photoFolderId,
    tags:   ['padel-pass', 'brand', 'colour-lifestyle', 'team-hero'],
  }),
  uploadFile(path.join(ROOT, 'assets/brand-handshake.jpg'), {
    title:  'Brand — Colour Lifestyle: Sportsmanship',
    folder: photoFolderId,
    tags:   ['padel-pass', 'brand', 'colour-lifestyle', 'sportsmanship'],
  }),
]);

// ─── Client record ────────────────────────────────────────────────────────────

console.log('\nCreating client record…');

const existing = await api('GET', '/items/clients?filter[slug][_eq]=padel-pass&limit=1');

const clientData = {
  id:             existing.length > 0 ? existing[0].id : randomUUID(),
  slug:           'padel-pass',
  name:           'Padel Pass',
  venue:          'Padel Pass · Luton',
  footer_tag:     'Padel Plus Membership',
  default_qr_url: 'https://padelpass.co.uk/membership',
  logo:           logoId,
};

let clientId;
if (existing.length > 0) {
  clientId = existing[0].id;
  await api('PATCH', `/items/clients/${clientId}`, clientData);
  console.log(`  ✓ Updated existing client (${clientId})`);
} else {
  const client = await api('POST', '/items/clients', clientData);
  clientId = client.id;
  console.log(`  ✓ Created client (${clientId})`);
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n✓ Seed complete.\n');
console.log('Folder IDs:');
console.log(`  Padel Pass             ${rootFolderId}`);
console.log(`  └─ Logo                ${logoFolderId}`);
console.log(`  └─ Brand Photography   ${photoFolderId}`);
console.log('\nAsset IDs:');
console.log(`  logo                   ${logoId}`);
console.log(`  brand-rally            ${rallyId}`);
console.log(`  brand-team-four        ${teamFourId}`);
console.log(`  brand-handshake        ${handshakeId}`);
console.log(`\nClient ID: ${clientId}`);
console.log(`\nDirectus CDN base: ${BASE}/assets/`);
