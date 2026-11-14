import { copyFile, cp, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await copyFile('index.html', 'dist/index.html');
await cp('core', 'dist/core', { recursive: true });
await cp('ui', 'dist/ui', { recursive: true });
