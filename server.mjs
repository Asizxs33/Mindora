import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);
    if (['/api/account', '/api/budget-draft', '/api/learning-plan', '/api/task-review'].includes(pathname)) {
      const { accountApi, budgetDraftApi } = await import('./backend/cloud-api.js');
      const { planApi } = await import('./backend/plan-api.js');
      const { taskReviewApi } = await import('./backend/task-review-api.js');
      const handlers = {
        '/api/account': accountApi,
        '/api/budget-draft': budgetDraftApi,
        '/api/learning-plan': planApi,
        '/api/task-review': taskReviewApi,
      };
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
        duplex: 'half',
      });
      const response = await handlers[pathname](request);
      const headers = Object.fromEntries(response.headers);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) headers['set-cookie'] = cookies;
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const publicPath = pathname === '/' ? '/index.html' : pathname;
    const file = resolve(root, '.' + publicPath);
    if (!file.startsWith(root + sep) || !/^\/(index\.html$|core\/|ui\/)/.test(publicPath)
      || publicPath.split('/').some(part => part.startsWith('.'))) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Mindora running at http://127.0.0.1:${port}`));
