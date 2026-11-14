// Python executes in a worker inside an opaque-origin iframe, never in the app
// origin or on the server. Its CSP prevents access to account/API endpoints.
export const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v314.0.8/full/';

export function pythonSandboxDocument(channel) {
  const worker = `
    self.onmessage = async ({ data }) => {
      let output = '';
      const write = line => { output = (output + String(line) + '\\n').slice(0, 2000); };
      try {
        const { loadPyodide } = await import(${JSON.stringify(`${PYODIDE_BASE}pyodide.mjs`)});
        const pyodide = await loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_BASE)}, stdout: write, stderr: write });
        self.postMessage({ type: 'running' });
        const value = await pyodide.runPythonAsync(data);
        if (value !== undefined) write(String(value));
        value?.destroy?.();
        self.postMessage({ type: 'done', output });
      } catch (error) { self.postMessage({ type: 'failed', output, error: String(error).slice(-1500) }); }
    };`;
  const script = `
    const channel = ${JSON.stringify(channel)};
    let worker;
    addEventListener('message', event => {
      if (event.source !== parent || event.data?.channel !== channel || worker) return;
      try {
        worker = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(worker)}], { type: 'text/javascript' })));
        worker.onmessage = event => parent.postMessage({ ...event.data, channel }, '*');
        worker.onerror = event => parent.postMessage({ type: 'unavailable', channel, error: event.message }, '*');
        worker.postMessage(event.data.code);
      } catch (error) { parent.postMessage({ type: 'unavailable', channel, error: String(error) }, '*'); }
    });
    parent.postMessage({ type: 'ready', channel }, '*');`;
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net blob:; connect-src https://cdn.jsdelivr.net; worker-src blob:;"><script>${script}</script>`;
}

export function runPython(code, { signal, onRunning = () => {}, document = globalThis.document, loadTimeout = 45000, runTimeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const channel = crypto.randomUUID();
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    const host = document.defaultView;
    let finished = false;
    let started = false;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      host.removeEventListener('message', receive);
      signal?.removeEventListener('abort', abort);
      frame.remove(); // Also terminates its worker, including an infinite loop.
      if (error) reject(new Error(error)); else resolve(value);
    };
    const abort = () => finish('cancelled');
    let timer = setTimeout(() => finish('unavailable'), loadTimeout);
    function receive(event) {
      if (event.source !== frame.contentWindow || event.data?.channel !== channel) return;
      const data = event.data;
      if (data.type === 'ready') frame.contentWindow.postMessage({ channel, code }, '*');
      if (data.type === 'running' && !started) {
        started = true;
        clearTimeout(timer);
        timer = setTimeout(() => finish('timeout'), runTimeout);
        onRunning();
      }
      if (data.type === 'done' || data.type === 'failed') finish(null, { output: String(data.output || '').slice(0, 2000), error: String(data.error || '').slice(0, 1500) });
      if (data.type === 'unavailable') finish('unavailable');
    }
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    host.addEventListener('message', receive);
    frame.srcdoc = pythonSandboxDocument(channel);
    document.body.append(frame);
  });
}
