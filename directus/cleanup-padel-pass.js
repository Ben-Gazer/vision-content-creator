/**
 * Removes duplicate Directus folders and files created by repeated seed runs.
 * Keeps the oldest record of each, deletes the rest.
 *
 * Usage:
 *   node --env-file=.env directus/cleanup-padel-pass.js
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

// ─── Deduplicate folders ──────────────────────────────────────────────────────

console.log('\nCleaning up duplicate folders…');

const allFolders = await api('GET', '/folders?limit=-1');

// Group by name+parent, keep oldest (first), delete the rest
const seen = new Map();
const foldersToDelete = [];

for (const f of allFolders) {
  const key = `${f.name}::${f.parent ?? 'root'}`;
  if (seen.has(key)) {
    foldersToDelete.push(f.id);
  } else {
    seen.set(key, f.id);
  }
}

// Delete children before parents to avoid FK constraint violations
const folderMap = Object.fromEntries(allFolders.map(f => [f.id, f]));
const toDelete = foldersToDelete.sort((a, b) => {
  const aHasParent = foldersToDelete.includes(folderMap[a]?.parent);
  const bHasParent = foldersToDelete.includes(folderMap[b]?.parent);
  return bHasParent - aHasParent; // children (whose parent is also being deleted) come first
});

for (const id of toDelete) {
  await api('DELETE', `/folders/${id}`);
  console.log(`  deleted folder: ${id}`);
}

console.log(`  kept ${seen.size} folders, removed ${foldersToDelete.length} duplicates`);

// ─── Deduplicate files ────────────────────────────────────────────────────────

console.log('\nCleaning up duplicate files…');

const allFiles = await api('GET', '/files?limit=-1&fields=id,title,uploaded_on');

const seenFiles = new Map();
const filesToDelete = [];

for (const f of allFiles) {
  if (!f.title) continue;
  if (seenFiles.has(f.title)) {
    filesToDelete.push(f.id);
  } else {
    seenFiles.set(f.title, f.id);
  }
}

for (const id of filesToDelete) {
  await api('DELETE', `/files/${id}`);
  console.log(`  deleted file: ${id}`);
}

console.log(`  kept ${seenFiles.size} files, removed ${filesToDelete.length} duplicates`);
console.log('\n✓ Cleanup complete. Run npm run directus:seed:padel-pass to re-seed.');
