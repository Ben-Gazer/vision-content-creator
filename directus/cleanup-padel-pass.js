/**
 * Wipes all Padel Pass files and folders from Directus so the seed
 * script can run from a clean state.
 *
 * Deletion order: files → child folders → root folder
 *
 * Usage:
 *   npm run directus:cleanup:padel-pass
 */

const BASE = process.env.DIRECTUS_URL?.replace(/\/$/, '');
const TOKEN = process.env.DIRECTUS_TOKEN;

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data?.errors)}`);
  return data.data;
}

const allFolders = await api('GET', '/folders?limit=-1');

// Find every Padel Pass root folder (there may be duplicates from previous runs)
const roots = allFolders.filter(f => f.name === 'Padel Pass' && !f.parent);
const rootIds = roots.map(f => f.id);
const childFolders = allFolders.filter(f => rootIds.includes(f.parent));
const allPadelFolderIds = [...rootIds, ...childFolders.map(f => f.id)];

if (allPadelFolderIds.length === 0) {
  console.log('Nothing to clean up.');
  process.exit(0);
}

// 1. Delete files in all Padel Pass folders
console.log('\nDeleting files…');
const files = await api('GET', `/files?limit=-1&fields=id,title&filter[folder][_in]=${allPadelFolderIds.join(',')}`);
for (const f of files) {
  await api('DELETE', `/files/${f.id}`);
  console.log(`  deleted: ${f.title}`);
}

// 2. Delete child folders first (avoids FK violation on parent)
console.log('\nDeleting child folders…');
for (const f of childFolders) {
  await api('DELETE', `/folders/${f.id}`);
  console.log(`  deleted: ${f.name}`);
}

// 3. Delete root folders
console.log('\nDeleting root folders…');
for (const id of rootIds) {
  await api('DELETE', `/folders/${id}`);
  console.log(`  deleted: Padel Pass (${id})`);
}

console.log('\n✓ Cleanup complete. Run npm run directus:seed:padel-pass to re-seed.');
