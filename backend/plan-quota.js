import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { neon } from '@neondatabase/serverless';

export async function reserveGeneration(request, databaseUrl, quotaSecret) {
  const ip = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.trim() : '127.0.0.1';
  if (!ip || !isIP(ip)) return false;
  const visitor = createHmac('sha256', quotaSecret).update(ip).digest('hex');
  const sql = neon(databaseUrl);
  const reserve = () => sql`
    INSERT INTO public.mindora_plan_quota AS quota (day, total, visitors)
    VALUES ((now() AT TIME ZONE 'UTC')::date, 1, jsonb_build_object(${visitor}::text, 1))
    ON CONFLICT (day) DO UPDATE SET
      total = quota.total + 1,
      visitors = jsonb_set(quota.visitors, ARRAY[${visitor}::text], to_jsonb(COALESCE((quota.visitors ->> ${visitor}::text)::int, 0) + 1))
    WHERE quota.total < 100 AND COALESCE((quota.visitors ->> ${visitor}::text)::int, 0) < 10
    RETURNING total
  `;
  let rows;
  try {
    rows = await reserve();
  } catch (error) {
    if (error.code !== '42P01') throw error;
    await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(109802193, 4139)`,
      sql`CREATE TABLE IF NOT EXISTS public.mindora_plan_quota (
        day date PRIMARY KEY, total integer NOT NULL, visitors jsonb NOT NULL
      )`,
      sql`REVOKE ALL ON public.mindora_plan_quota FROM PUBLIC`,
      sql`ALTER TABLE public.mindora_plan_quota ENABLE ROW LEVEL SECURITY`,
    ]);
    rows = await reserve();
  }
  if (rows[0]?.total === 1) {
    // Retain only current and recent windows.
    await sql`DELETE FROM public.mindora_plan_quota WHERE day < (now() AT TIME ZONE 'UTC')::date - 1`;
  }
  return rows.length > 0;
}
