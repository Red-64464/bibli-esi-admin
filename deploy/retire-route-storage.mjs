// One-off server maintenance: secrets stay on the VPS, never in output.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const bucket = 'bibli-route-videos';
const mode = process.argv[2];
const backup = resolve(process.argv[3] || '/invalid');
if (!['backup', 'delete'].includes(mode) || !backup.startsWith('/home/codex-admin/backups/bibliesi-retirement-')) {
  throw new Error('Expected backup/delete and a dedicated BiblESI retirement backup directory.');
}
const inspect = name => JSON.parse(execFileSync('sudo', ['docker', 'inspect', name], { encoding: 'utf8' }))[0];
const worker = inspect('bibliesi-reminder-worker');
const credentials = Object.fromEntries(worker.Config.Env.map(value => {
  const index = value.indexOf('='); return [value.slice(0, index), value.slice(index + 1)];
}));
const key = credentials.SUPABASE_SERVICE_ROLE_KEY;
const kong = inspect('supabase-kong');
const ip = kong.NetworkSettings.Networks.supabase_default?.IPAddress;
if (!key || !ip) throw new Error('Server credentials or private gateway missing.');
const base = `http://${ip}:8000/storage/v1`;
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const request = async (path, options = {}) => {
  const response = await fetch(base + path, { ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Storage operation failed: HTTP ${response.status}`);
  return response;
};
const list = async () => (await request(`/object/list/${bucket}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix: '', limit: 1000 }),
})).json();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestPath = join(backup, 'videos.json');

if (mode === 'backup') {
  await mkdir(backup, { recursive: true, mode: 0o700 });
  const files = await list();
  if (files.length > 10 || files.some(file => !file.id || file.name.includes('/') || !/^arrival-[0-9]+\.(mp4|mov|webm|m4v)$/.test(file.name))) {
    throw new Error('Unexpected contents: stop and inspect the dedicated bucket.');
  }
  const manifest = [];
  for (const file of files) {
    const bytes = Buffer.from(await (await request(`/object/${bucket}/${encodeURIComponent(file.name)}`)).arrayBuffer());
    if (!bytes.length || bytes.length !== Number(file.metadata?.size)) throw new Error('Backup size mismatch.');
    await writeFile(join(backup, file.name), bytes, { mode: 0o600, flag: 'wx' });
    manifest.push({ name: file.name, size: bytes.length, sha256: hash(bytes) });
  }
  await writeFile(manifestPath, JSON.stringify({ bucket, files: manifest }, null, 2), { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ backup, files: manifest.length, bytes: manifest.reduce((sum, file) => sum + file.size, 0) }));
} else {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.bucket !== bucket) throw new Error('Backup bucket mismatch.');
  const current = await list();
  if (JSON.stringify(current.map(file => file.name).sort()) !== JSON.stringify(manifest.files.map(file => file.name).sort())) throw new Error('Bucket changed since backup.');
  for (const file of manifest.files) {
    if (!/^arrival-[0-9]+\.(mp4|mov|webm|m4v)$/.test(file.name)) throw new Error('Invalid backup filename.');
    const bytes = await readFile(join(backup, file.name));
    if (bytes.length !== file.size || hash(bytes) !== file.sha256) throw new Error('Backup verification failed.');
  }
  if (current.length) await request(`/object/${bucket}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: manifest.files.map(file => file.name) }) });
  if ((await list()).length) throw new Error('Bucket is not empty after removal.');
  await request(`/bucket/${bucket}`, { method: 'DELETE' });
  console.log(JSON.stringify({ removedBucket: bucket, removedFiles: current.length, recoverableBackup: backup }));
}
