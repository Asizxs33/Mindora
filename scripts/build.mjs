import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
const output = resolve(root, 'dist');
if (output !== root + sep + 'dist') throw new Error('Build output must stay inside the project.');

// Start fresh so removed source files cannot survive a later deployment.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyFile(resolve(root, 'index.html'), resolve(output, 'index.html'));
for (const folder of ['core', 'ui']) {
  await cp(resolve(root, folder), resolve(output, folder), {
    recursive: true,
    filter: source => source !== resolve(root, 'ui', 'review')
      && !/\.test\.m?js$/.test(basename(source)),
  });
}
