import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetDraftApi } from '../backend/cloud-api.js';
import { createBudgetDraft } from '../core/budget-session.js';

const url = 'https://mindora.test/api/budget-draft';
const headers = { origin: 'https://mindora.test', 'content-type': 'application/json' };
const workspace = {
  minutes: 20, progress: 2, step: 2, goal: 'Таблица расходов',
  drafts: { 'budget-practice-20': { ...createBudgetDraft(2, 20), formula: '=SUM(B2:B4)' } },
};

test('cloud requests use the session owner and reject missing sessions, cross-origin writes and stale revisions', async () => {
  const rows = new Map();
  let user = { id: 'learner-a' };
  const deps = {
    settings: {},
    session: async () => ({ user, cookies: [] }),
    store: () => ({
      read: async id => rows.get(id) || null,
      write: async (id, saved, revision) => {
        const current = rows.get(id);
        if ((current?.revision ?? null) !== revision) return null;
        const row = { workspace: saved, revision: (revision ?? 0) + 1 };
        rows.set(id, row);
        return row;
      },
    }),
  };
  const save = (revision, origin = headers.origin, data = workspace) => budgetDraftApi(new Request(url, {
    method: 'PUT', headers: { ...headers, origin },
    body: JSON.stringify({ userId: 'learner-b', workspace: data, revision }),
  }), deps);
  assert.equal((await save(null, 'https://other.test')).status, 403);
  assert.equal((await save(null, headers.origin, { ...workspace, step: 3 })).status, 400);
  assert.equal((await save(null)).status, 200);
  assert.equal((await save(null)).status, 409);
  assert.equal((await save(1)).status, 200);
  const response = await budgetDraftApi(new Request(url), deps);
  assert.deepEqual((await response.json()).draft.workspace, workspace);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  user = { id: 'learner-b' };
  assert.equal((await (await budgetDraftApi(new Request(url), deps)).json()).draft, null);
  user = null;
  assert.equal((await budgetDraftApi(new Request(url), deps)).status, 401);
});
