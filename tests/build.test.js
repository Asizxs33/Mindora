import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test('production build removes stale files and excludes tests and review screenshots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mindora-build-'));
  try {
    const files = {
      'index.html': '<main>Mindora</main>',
      'core/app.js': 'export const app = true;',
      'ui/view.js': 'export const view = true;',
      'ui/assets/mascot.svg': '<svg/>',
      'ui/view.test.js': 'development assertion',
      'ui/review/desktop.png': 'development screenshot',
      'dist/stale.js': 'old removed release',
    };
    for (const [name, content] of Object.entries(files)) {
      const destination = join(root, name);
      await mkdir(join(destination, '..'), { recursive: true });
      await writeFile(destination, content);
    }
    const script = fileURLToPath(new URL('../scripts/build.mjs', import.meta.url));
    await promisify(execFile)(process.execPath, [script], { cwd: root, windowsHide: true });
    for (const name of ['index.html', 'core/app.js', 'ui/view.js', 'ui/assets/mascot.svg']) {
      assert.equal(await readFile(join(root, 'dist', name), 'utf8'), files[name]);
    }
    for (const name of ['stale.js', 'ui/view.test.js', 'ui/review/desktop.png']) {
      await assert.rejects(access(join(root, 'dist', name)), { code: 'ENOENT' });
    }
  } finally {
    // root is the exact directory returned by mkdtemp above.
    await rm(root, { recursive: true, force: true });
  }
});
