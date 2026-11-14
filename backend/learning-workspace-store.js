import { neon } from '@neondatabase/serverless';
import { isDeepStrictEqual } from 'node:util';
import { validateBuiltinWorkspace } from './builtin-workspace.js';

function workspaceRow(row) {
  if (!row) return null;
  const data = validateBuiltinWorkspace(row.data);
  if (!data || !Number.isInteger(row.revision) || row.revision < 1) throw new Error('Invalid stored learning workspace');
  return { data, revision: row.revision, updatedAt: row.updatedAt };
}

export function learningWorkspaceStore(databaseUrl, { sql = neon(databaseUrl) } = {}) {
  async function withTable(query) {
    try { return await query(); } catch (error) {
      if (error.code !== '42P01') throw error;
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(109802193, 4142)`,
        sql`CREATE TABLE IF NOT EXISTS public.mindora_learning_workspaces (
          user_id text PRIMARY KEY,
          data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
          revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`,
        sql`REVOKE ALL ON public.mindora_learning_workspaces FROM PUBLIC`,
        sql`ALTER TABLE public.mindora_learning_workspaces ENABLE ROW LEVEL SECURITY`,
      ]);
      return query();
    }
  }
  async function read(userId) {
    const [row] = await withTable(() => sql`
      SELECT data, revision, updated_at AS "updatedAt" FROM public.mindora_learning_workspaces WHERE user_id = ${userId}
    `);
    return workspaceRow(row);
  }
  return {
    read,
    async write(userId, value, revision) {
      const data = validateBuiltinWorkspace(value);
      if (!data || (revision !== null && (!Number.isInteger(revision) || revision < 1 || revision > 2147483646))) throw new TypeError('Invalid learning workspace');
      const [row] = await withTable(() => revision === null ? sql`
        INSERT INTO public.mindora_learning_workspaces (user_id, data) VALUES (${userId}, ${JSON.stringify(data)}::jsonb)
        ON CONFLICT (user_id) DO NOTHING RETURNING data, revision, updated_at AS "updatedAt"
      ` : sql`
        UPDATE public.mindora_learning_workspaces SET data = ${JSON.stringify(data)}::jsonb, revision = revision + 1, updated_at = now()
        WHERE user_id = ${userId} AND revision = ${revision} RETURNING data, revision, updated_at AS "updatedAt"
      `);
      if (row) return workspaceRow(row);
      // Also covers an initial revision:null insert whose response was lost.
      const current = await read(userId);
      return current && isDeepStrictEqual(current.data, data) ? current : null;
    },
  };
}
