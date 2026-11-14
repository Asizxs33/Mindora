import { neon } from '@neondatabase/serverless';

const schema = `
  CREATE TABLE IF NOT EXISTS public.mindora_budget_drafts (
    user_id text PRIMARY KEY,
    workspace jsonb NOT NULL CHECK (jsonb_typeof(workspace) = 'object'),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

export function draftStore(databaseUrl) {
  const sql = neon(databaseUrl);

  async function withTable(query) {
    try {
      return await query();
    } catch (error) {
      if (error.code !== '42P01') throw error;
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(109802193, 4138)`,
        sql.query(schema),
        sql`REVOKE ALL ON public.mindora_budget_drafts FROM PUBLIC`,
        sql`ALTER TABLE public.mindora_budget_drafts ENABLE ROW LEVEL SECURITY`,
      ]);
      return query();
    }
  }

  return {
    async read(userId) {
      const [row] = await withTable(() => sql`
        SELECT workspace, revision, updated_at AS "updatedAt"
        FROM public.mindora_budget_drafts WHERE user_id = ${userId}
      `);
      return row || null;
    },
    async write(userId, workspace, revision) {
      const json = JSON.stringify(workspace);
      const [row] = await withTable(() => revision === null
        ? sql`
            INSERT INTO public.mindora_budget_drafts (user_id, workspace)
            VALUES (${userId}, ${json}::jsonb)
            ON CONFLICT (user_id) DO NOTHING
            RETURNING revision, updated_at AS "updatedAt"
          `
        : sql`
            UPDATE public.mindora_budget_drafts
            SET workspace = ${json}::jsonb, revision = revision + 1, updated_at = now()
            WHERE user_id = ${userId} AND revision = ${revision}
            RETURNING revision, updated_at AS "updatedAt"
          `);
      return row || null;
    },
  };
}
