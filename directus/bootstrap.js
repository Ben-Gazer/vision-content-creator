/**
 * Creates all Directus collections, fields, and relations for the vision pipeline.
 *
 * Usage:
 *   DIRECTUS_URL=https://your-project.up.railway.app \
 *   DIRECTUS_TOKEN=your-admin-token \
 *   node directus/bootstrap.js
 */

const BASE = process.env.DIRECTUS_URL;
const TOKEN = process.env.DIRECTUS_TOKEN;

if (!BASE || !TOKEN) {
  console.error('DIRECTUS_URL and DIRECTUS_TOKEN must be set');
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    const msg = JSON.parse(text)?.errors?.[0]?.message ?? text;
    // Ignore "already exists" errors so the script is safe to re-run
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      return null;
    }
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return text ? JSON.parse(text) : null;
}

async function createCollection(name, meta, fields) {
  console.log(`  collection: ${name}`);
  await api('POST', '/collections', {
    collection: name,
    meta: { icon: 'box', ...meta },
    schema: {},
    fields,
  });
}

async function addField(collection, field) {
  await api('POST', `/fields/${collection}`, field);
}

async function createRelation(rel) {
  await api('POST', '/relations', rel);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const uuid = (field = 'id') => ({
  field,
  type: 'uuid',
  meta: { hidden: true, readonly: true, interface: 'input' },
  schema: { is_primary_key: true, has_auto_increment: false },
});

const dateCreated = {
  field: 'date_created',
  type: 'timestamp',
  meta: { hidden: true, readonly: true, special: ['date-created'], interface: 'datetime', display: 'datetime' },
  schema: {},
};

const dateUpdated = {
  field: 'date_updated',
  type: 'timestamp',
  meta: { hidden: true, readonly: true, special: ['date-updated'], interface: 'datetime', display: 'datetime' },
  schema: {},
};

const str = (field, label, opts = {}) => ({
  field,
  type: 'string',
  meta: { interface: 'input', display: 'raw', note: null, ...opts, width: opts.width ?? 'full' },
  schema: { is_nullable: !opts.required },
});

const text = (field, label, opts = {}) => ({
  field,
  type: 'text',
  meta: { interface: 'input-multiline', display: 'raw', ...opts, width: opts.width ?? 'full' },
  schema: { is_nullable: true },
});

const int = (field, opts = {}) => ({
  field,
  type: 'integer',
  meta: { interface: 'input', ...opts },
  schema: { is_nullable: true },
});

const file = (field, label) => ({
  field,
  type: 'uuid',
  meta: { interface: 'file-image', display: 'image', note: label, width: 'half', special: ['file'] },
  schema: { is_nullable: true, foreign_key_table: 'directus_files', foreign_key_column: 'id' },
});

const select = (field, choices, label, defaultVal) => ({
  field,
  type: 'string',
  meta: {
    interface: 'select-dropdown',
    display: 'labels',
    options: { choices },
    default_value: defaultVal,
    width: 'half',
  },
  schema: { is_nullable: false, default_value: defaultVal },
});

const fk = (field, table) => ({
  field,
  type: 'uuid',
  meta: { interface: 'select-dropdown-m2o', display: 'related-values', width: 'half', special: ['m2o'] },
  schema: { is_nullable: false, foreign_key_table: table, foreign_key_column: 'id' },
});

// ─── Collections ─────────────────────────────────────────────────────────────

console.log('\nCreating collections…');

await createCollection('clients', { icon: 'people', display_template: '{{name}}' }, [
  uuid(),
  dateCreated,
  dateUpdated,
]);

await createCollection('campaigns', { icon: 'campaign', display_template: '{{name}}' }, [
  uuid(),
  dateCreated,
  dateUpdated,
]);

await createCollection('variants', { icon: 'art_track', display_template: '{{composition_id}}' }, [
  uuid(),
  dateCreated,
]);

await createCollection('renders', { icon: 'movie', display_template: '{{variant}}', sort_field: null }, [
  uuid(),
  dateCreated,
]);

// ─── Fields: clients ─────────────────────────────────────────────────────────

console.log('\nAdding fields: clients…');
const clientFields = [
  str('slug', 'Slug', { required: true, width: 'half', note: 'URL-safe identifier e.g. padel-pass' }),
  str('name', 'Name', { required: true, width: 'half' }),
  str('venue', 'Venue', { note: 'Shown in ad frame header e.g. Padel Pass · Luton' }),
  str('footer_tag', 'Footer tag'),
  str('default_qr_url', 'Default QR URL'),
  file('logo', 'Brand logo (PNG, transparent background)'),
];
for (const f of clientFields) await addField('clients', f);

// ─── Fields: campaigns ───────────────────────────────────────────────────────

console.log('Adding fields: campaigns…');
const campaignStatuses = [
  { text: 'Draft',            value: 'draft',            color: '#6B7280' },
  { text: 'Ready to render',  value: 'ready_to_render',  color: '#F59E0B' },
  { text: 'Rendering',        value: 'rendering',        color: '#3B82F6' },
  { text: 'Rendered',         value: 'rendered',         color: '#8B5CF6' },
  { text: 'Approved',         value: 'approved',         color: '#10B981' },
  { text: 'Published',        value: 'published',        color: '#059669' },
];
const campaignFields = [
  fk('client', 'clients'),
  str('name', 'Campaign name', { required: true }),
  select('status', campaignStatuses, 'Status', 'draft'),
];
for (const f of campaignFields) await addField('campaigns', f);

// ─── Fields: variants ────────────────────────────────────────────────────────

console.log('Adding fields: variants…');
const variantFields = [
  fk('campaign', 'campaigns'),
  str('composition_id', 'Composition ID', { note: 'e.g. ad-price, ad-community, ad-urgency', width: 'half' }),
  str('headline_1', 'Headline line 1', { width: 'half' }),
  str('headline_2', 'Headline line 2', { width: 'half' }),
  text('body', 'Body copy'),
  file('image', 'Background image'),
  str('qr_cta', 'QR call to action', { note: 'e.g. Scan to join', width: 'half' }),
  str('qr_url', 'QR URL override', { note: 'Leave blank to use client default QR URL', width: 'half' }),
];
for (const f of variantFields) await addField('variants', f);

// ─── Fields: renders ─────────────────────────────────────────────────────────

console.log('Adding fields: renders…');
const renderFields = [
  fk('variant', 'variants'),
  str('s3_key', 'S3 key'),
  text('presigned_url', 'Presigned URL'),
  { field: 'expires_at',           type: 'timestamp', meta: { interface: 'datetime', width: 'half' }, schema: { is_nullable: true } },
  { field: 'rendered_at',          type: 'timestamp', meta: { interface: 'datetime', width: 'half' }, schema: { is_nullable: true } },
  int('size_bytes', { width: 'half' }),
  str('nowsignage_asset_id', 'NowSignage asset ID', { width: 'half' }),
];
for (const f of renderFields) await addField('renders', f);

// ─── Relations ───────────────────────────────────────────────────────────────

console.log('\nCreating relations…');

await createRelation({
  collection: 'campaigns',
  field: 'client',
  related_collection: 'clients',
  meta: { one_field: null, sort_field: null },
  schema: { on_delete: 'SET NULL' },
});

await createRelation({
  collection: 'variants',
  field: 'campaign',
  related_collection: 'campaigns',
  meta: { one_field: null, sort_field: null },
  schema: { on_delete: 'CASCADE' },
});

await createRelation({
  collection: 'renders',
  field: 'variant',
  related_collection: 'variants',
  meta: { one_field: null, sort_field: null },
  schema: { on_delete: 'CASCADE' },
});

console.log('\n✓ Bootstrap complete.\n');
console.log('Next step: node directus/seed-padel-pass.js');
