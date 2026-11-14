import { renderCloudPanel } from '../ui/cloud-drafts.js';
import { message } from '../ui/messages.js';

async function request(path, method = 'GET', body) {
  const response = await fetch(`/api/${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'Запрос не выполнен.'), { status: response.status });
  return result;
}

export function createCloudDrafts({ getWorkspace, restoreWorkspace, hasLocalDraft }) {
  let user = null;
  let available;
  let busy = false;
  let status = '';
  let revision = null;
  let conflict = false;
  let running = null;
  let refreshPending = false;
  let accountVersion = 0;

  function render() {
    renderCloudPanel(document.querySelector('[data-cloud-panel]'), { user, available, busy, status });
  }

  async function readAccount(version) {
    const account = await request('account');
    if (version !== accountVersion) return;
    if ((account.user?.id ?? account.user?.email) !== (user?.id ?? user?.email)) {
      revision = null;
      conflict = false;
    }
    available = account.available;
    user = account.user;
  }

  function run(task) {
    if (running) return running;
    busy = true;
    status = '';
    render();
    const version = accountVersion;
    running = (async () => {
      try {
        await task(version);
      } catch (error) {
        if (version === accountVersion) {
          if (error.status === 401) { user = null; revision = null; conflict = false; }
          if (error.status === 409) conflict = true;
          status = error.status ? error.message : 'Не удалось связаться с облаком. Черновик остался в браузере.';
        }
      }
      // Auth changes can arrive while a draft request or an earlier session read
      // is in flight. Drain one fresh read instead of dropping that notification.
      while (refreshPending) {
        refreshPending = false;
        const refreshVersion = accountVersion;
        try {
          await readAccount(refreshVersion);
        } catch {
          if (refreshVersion === accountVersion) {
            available = false; user = null; revision = null; conflict = false;
            status = 'Не удалось связаться с облаком. Черновик остался в браузере.';
          }
        }
      }
      busy = false;
      render();
    })().finally(() => { running = null; });
    return running;
  }

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-cloud-action]')?.dataset.cloudAction;
    if (!['load', 'save'].includes(action) || !user) return;
    void run(async version => {
      if (action === 'load') {
        const { draft } = await request('budget-draft');
        if (version !== accountVersion) return;
        if (!draft) {
          status = 'В аккаунте пока нет черновика.';
          return;
        }
        if (hasLocalDraft() && !window.confirm(message('Заменить текущие черновики таблицы копией из аккаунта?'))) return;
        restoreWorkspace(draft.workspace);
        revision = draft.revision;
        conflict = false;
        status = 'Черновик открыт из аккаунта.';
      } else if (action === 'save') {
        const workspace = getWorkspace();
        if (!workspace) return;
        let expectedRevision = revision;
        if (conflict) {
          const { draft } = await request('budget-draft');
          if (version !== accountVersion) return;
          if (draft && !window.confirm(message('Заменить сохранённый в аккаунте черновик текущей работой?'))) return;
          expectedRevision = draft?.revision ?? null;
        }
        const { draft } = await request('budget-draft', 'PUT', { workspace, revision: expectedRevision });
        if (version !== accountVersion) return;
        revision = draft.revision;
        conflict = false;
        status = 'Сохранено в аккаунте. Можно открыть на другом устройстве.';
      }
    });
  });

  return {
    render,
    init() {
      accountVersion += 1;
      refreshPending = true;
      return run(async () => {});
    },
  };
}
