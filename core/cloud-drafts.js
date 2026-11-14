import { renderCloudPanel } from '../ui/cloud-drafts.js';

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

  function render() {
    renderCloudPanel(document.querySelector('[data-cloud-panel]'), { user, available, busy, status });
  }

  async function readAccount() {
    const account = await request('account');
    if (account.user?.email !== user?.email) {
      revision = null;
      conflict = false;
    }
    available = account.available;
    user = account.user;
  }

  async function run(task) {
    if (busy) return;
    busy = true;
    status = '';
    render();
    try {
      await task();
    } catch (error) {
      if (error.status === 401) {
        user = null;
        revision = null;
      }
      if (error.status === 409) conflict = true;
      status = error.status ? error.message : 'Не удалось связаться с облаком. Черновик остался в браузере.';
    } finally {
      busy = false;
      render();
    }
  }

  document.addEventListener('submit', event => {
    if (event.target.id !== 'mindora-account-form') return;
    event.preventDefault();
    const { email, password } = event.target.elements;
    const data = { email: email.value.trim(), password: password.value, action: event.submitter?.value || 'signin' };
    void run(async () => {
      await request('account', 'POST', data);
      await readAccount();
      status = user ? 'Вход выполнен.' : 'Аккаунт создан. Проверь почту и затем войди.';
    });
  });

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-cloud-action]')?.dataset.cloudAction;
    if (!action || !user) return;
    void run(async () => {
      if (action === 'signout') {
        await request('account', 'POST', { action });
        await readAccount();
        status = 'Ты вышел из аккаунта.';
      } else if (action === 'load') {
        const { draft } = await request('budget-draft');
        if (!draft) {
          status = 'В аккаунте пока нет черновика.';
          return;
        }
        if (hasLocalDraft() && !window.confirm('Заменить текущие черновики таблицы копией из аккаунта?')) return;
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
          if (draft && !window.confirm('Заменить сохранённый в аккаунте черновик текущей работой?')) return;
          expectedRevision = draft?.revision ?? null;
        }
        const { draft } = await request('budget-draft', 'PUT', { workspace, revision: expectedRevision });
        revision = draft.revision;
        conflict = false;
        status = 'Сохранено в аккаунте. Можно открыть на другом устройстве.';
      }
    });
  });

  return {
    render,
    init: () => run(async () => {
      try {
        await readAccount();
      } catch (error) {
        available = false;
        throw error;
      }
    }),
  };
}
