import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
export async function migrateLegacyProfile(legacyDir, targetDir) {
  const source = path.join(legacyDir, 'krecher.sqlite'), target = path.join(targetDir, 'grim.sqlite');
  try { await fs.access(target); return false; } catch {}
  try { await fs.access(source); } catch { return false; }
  await fs.mkdir(targetDir, { recursive: true });
  const db = new DatabaseSync(source, { readOnly: true });
  try { await backup(db, target); } finally { db.close(); }
  try { await fs.cp(path.join(legacyDir, 'images'), path.join(targetDir, 'images'), { recursive: true, errorOnExist: false }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return true;
}
