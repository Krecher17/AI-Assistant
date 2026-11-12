import fs from 'node:fs/promises';
import path from 'node:path';

export function within(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function allowedPath(value, roots, { destination = false } = {}) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0')) throw new Error('Provide an absolute path.');
  // ADS and UNC/device paths complicate file identity and are deliberately unsupported.
  if (process.platform === 'win32' && (value.startsWith('\\\\') || value.slice(2).includes(':'))) throw new Error('Network, device, and alternate data stream paths are unsupported.');
  let resolved;
  if (destination) {
    const parent = await fs.realpath(path.dirname(value));
    resolved = path.join(parent, path.basename(value));
    try { await fs.lstat(resolved); throw new Error('Destination already exists.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  } else resolved = await fs.realpath(value);
  const canonicalRoots = await Promise.all(roots.map(root => fs.realpath(root)));
  if (!canonicalRoots.some(root => within(root, resolved))) throw new Error('This path is outside your enabled folders. Add its folder in Settings first.');
  return resolved;
}

export async function readText(value, roots) {
  const file = await allowedPath(value, roots);
  const parts = file.split(/[\\/]/), basename = parts.at(-1).toLowerCase();
  if (parts.some(part => ['.ssh', '.aws', '.codex', '.gnupg'].includes(part.toLowerCase())) ||
      (basename.startsWith('.env') && basename !== '.env.example') || ['credentials', 'credentials.json', 'id_rsa', 'id_ed25519'].includes(basename))
    throw new Error('Credential and private configuration files are excluded from AI file reading.');
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > 256000) throw new Error('Select a text file smaller than 256 KB.');
  const buffer = await fs.readFile(file);
  if (buffer.includes(0)) throw new Error('Binary files cannot be read as text.');
  return { path: file, text: buffer.toString('utf8') };
}

export async function searchFiles(query, roots) {
  if (typeof query !== 'string' || !query.trim()) throw new Error('Enter a file name to search.');
  const results = []; let inspected = 0;
  const skip = new Set(['node_modules', '.git', '.env', '.aws', '.ssh', 'AppData', '$RECYCLE.BIN']);
  async function walk(dir, depth) {
    if (depth > 7 || inspected > 12000 || results.length >= 60) return;
    let entries; try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (++inspected > 12000 || results.length >= 60) return;
      if (entry.isSymbolicLink() || skip.has(entry.name) || entry.name.startsWith('.env')) continue;
      const target = path.join(dir, entry.name);
      // Recheck canonical containment to exclude junctions/reparse points leaving the root.
      let safe; try { safe = await allowedPath(target, roots); } catch { continue; }
      if (entry.name.toLowerCase().includes(query.toLowerCase())) results.push({ path: safe, directory: entry.isDirectory() });
      if (entry.isDirectory()) await walk(safe, depth + 1);
    }
  }
  for (const root of roots) await walk(await fs.realpath(root), 0);
  return { results, bounded: true, inspected, note: 'File-name search, up to 7 levels / 12,000 entries / 60 results. Hidden credential folders are skipped.' };
}
