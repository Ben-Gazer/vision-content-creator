/**
 * Creates a test campaign in Directus with all four composition variants
 * for the Padel Pass client. Safe to re-run — skips if campaign already exists.
 *
 * Usage:
 *   npm run directus:seed:campaign-test
 */

import { randomUUID } from 'crypto';

const BASE = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const TOKEN = process.env.DIRECTUS_TOKEN;

if (!BASE || !TOKEN) {
  console.error('DIRECTUS_URL and DIRECTUS_TOKEN must be set');
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data?.errors)}`);
  return data?.data ?? null;
}

// ─── Resolve client + assets ──────────────────────────────────────────────────

const clients = await api('GET', '/items/clients?filter[slug][_eq]=padel-pass&limit=1');
if (!clients.length) {
  console.error('Padel Pass client not found — run npm run directus:seed:padel-pass first');
  process.exit(1);
}
const client = clients[0];
console.log(`Client: ${client.name} (${client.id})`);

// Fetch uploaded assets by title to get their IDs
const files = await api('GET', '/files?fields=id,title&limit=-1');
const byTitle = Object.fromEntries(files.map(f => [f.title, f.id]));

const imageIds = {
  'ad-price':     byTitle['Match Action'],
  'ad-community': byTitle['Team Hero'],
  'ad-urgency':   byTitle['Sportsmanship'],
  'ad-lifestyle': byTitle['Match Action'],
};

// ─── Campaign ─────────────────────────────────────────────────────────────────

const CAMPAIGN_NAME = 'Padel Plus Membership Drive — May 2026';
const CAMPAIGN_OBJECTIVE = 'Increase Padel Plus membership sign-ups by driving awareness of the value, community, and convenience benefits across in-venue display screens.';

const existing = await api('GET', `/items/campaigns?filter[name][_eq]=${encodeURIComponent(CAMPAIGN_NAME)}&limit=1`);
let campaignId;

if (existing.length > 0) {
  campaignId = existing[0].id;
  console.log(`\nCampaign already exists: ${campaignId}`);
} else {
  const campaign = await api('POST', '/items/campaigns', {
    id:        randomUUID(),
    client:    client.id,
    name:      CAMPAIGN_NAME,
    objective: CAMPAIGN_OBJECTIVE,
    status:    'draft',
  });
  campaignId = campaign.id;
  console.log(`\nCreated campaign: ${campaignId}`);
}

// ─── Variants ─────────────────────────────────────────────────────────────────

const VARIANTS = [
  {
    composition_id: 'ad-price',
    headline_1: 'Play More.',
    headline_2: 'Pay Less.',
    body: 'Unlock 20% off every booking and early court access with Padel Plus Membership',
    qr_cta: 'Scan to join',
  },
  {
    composition_id: 'ad-community',
    headline_1: 'Your Courts.',
    headline_2: 'Your Club.',
    body: 'Join hundreds of members playing more padel, more often, for less',
    qr_cta: 'Join the club',
  },
  {
    composition_id: 'ad-urgency',
    headline_1: 'Stop Waiting.',
    headline_2: 'Start Playing.',
    body: 'Book any court at any Padel Pass venue in seconds. Your next game is closer than you think',
    qr_cta: 'Book now',
  },
  {
    composition_id: 'ad-lifestyle',
    headline_1: 'Show Up.',
    headline_2: 'Level Up.',
    body: 'Every session makes you sharper. Join Padel Plus and play more of the game you love',
    qr_cta: 'Start playing',
  },
];

console.log('\nCreating variants…');
for (const v of VARIANTS) {
  const exists = await api('GET', `/items/variants?filter[campaign][_eq]=${campaignId}&filter[composition_id][_eq]=${v.composition_id}&limit=1`);
  if (exists.length > 0) {
    console.log(`  exists: ${v.composition_id}`);
    continue;
  }
  await api('POST', '/items/variants', {
    id:       randomUUID(),
    campaign: campaignId,
    image:    imageIds[v.composition_id] ?? null,
    ...v,
  });
  console.log(`  ✓ ${v.composition_id}`);
}

console.log(`\n✓ Done. Set campaign status → ready_to_render in Directus to trigger Make.com.`);
console.log(`  ${BASE}/admin/content/campaigns/${campaignId}`);
