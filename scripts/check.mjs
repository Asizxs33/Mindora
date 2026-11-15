import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const sourceFolders = ['api', 'backend', 'core', 'ui', 'scripts', 'tests'];

async function javascriptFiles(folder, recursive = true) {
  const files = [];
  const entries = await readdir(folder, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = join(folder, entry.name);
    if (entry.isDirectory() && recursive && !['assets', 'review'].includes(entry.name)) {
      files.push(...await javascriptFiles(file));
    } else if (entry.isFile() && /\.m?js$/.test(entry.name)) {
      files.push(file);
    }
  }
  return files;
}

const files = await javascriptFiles('.', false);
for (const folder of sourceFolders) files.push(...await javascriptFiles(folder));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error('Syntax check failed:', file);
    process.exit(result.status || 1);
  }
}
console.log('Syntax checked ' + files.length + ' JavaScript files.');
