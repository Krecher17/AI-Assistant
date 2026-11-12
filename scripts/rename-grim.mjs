import fs from 'node:fs';
import path from 'node:path';
const skip = new Set(['node_modules', '.local', '.git', 'test-output', 'output']);
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name) || entry.name === '.env' || entry.name === 'rename-grim.mjs') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(mjs|cjs|js|json|md|html|css|cmd|svg)$/.test(file) || entry.name === '.env.example') {
      const old = fs.readFileSync(file, 'utf8'), next = old.replaceAll('KRECHER','GRIM').replaceAll('Krecher','Grim').replaceAll('krecher','grim');
      if (next !== old) fs.writeFileSync(file, next);
    }
  }
}
walk('.');
if (fs.existsSync('Start Krecher.cmd')) fs.renameSync('Start Krecher.cmd', 'Start Grim.cmd');
fs.mkdirSync('public/assets', { recursive: true });
fs.copyFileSync('C:/Users/Akshay/.codex/generated_images/01a1c9be-06da-7e81-8f84-da5ac0cad6ee/exec-e7c850f5-a64f-4cad-b31d-291290586f61.png', 'public/assets/grim-atlas.png');
const bytes=fs.readFileSync('public/assets/grim-atlas.png');
console.log(JSON.stringify({atlasWidth:bytes.readUInt32BE(16),atlasHeight:bytes.readUInt32BE(20),colorType:bytes[25]}));
