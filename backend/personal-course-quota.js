import { neon } from '@neondatabase/serverless';
import { randomUUID, createHash } from 'node:crypto';
import { learningWorkspaceStore } from './learning-workspace-store.js';

export function quotaIdentity(request, user, cookies) {
  if (user) return 'account:' + user.id;
  const previous = request.headers.get('cookie')?.match(/(?:^|;\s*)mindora_course_guest=([0-9a-f-]{36})(?:;|$)/)?.[1];
  if (previous) return 'browser:' + previous;
  const id = randomUUID();
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  cookies.push('mindora_course_guest=' + id + '; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax' + secure);
  return 'browser:' + id;
}

export function personalCourseQuota(settings) {
  const sql = neon(settings.databaseUrl);
  async function query(fn) {
    try { return await fn(); }
    catch (err) {
      if (err.code !== '42P01') throw err;
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(109802193, 4143)`,
        sql`CREATE TABLE IF NOT EXISTS public.mindora_personal_courses (
          owner text PRIMARY KEY, request_key text NOT NULL, lease uuid NOT NULL,
          started_at timestamptz NOT NULL DEFAULT now(), roadmap jsonb)`,
        sql`REVOKE ALL ON public.mindora_personal_courses FROM PUBLIC`,
        sql`ALTER TABLE public.mindora_personal_courses ENABLE ROW LEVEL SECURITY`,
      ]);
      return fn();
    }
  }
  return {
    async run(owner, input, build) {
      const key = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      const lease = randomUUID();
      const lookup = async () => {
        const [row] = await query(() => sql`SELECT request_key, roadmap FROM public.mindora_personal_courses WHERE owner = ${owner}`);
        if (row?.roadmap) return row.request_key === key ? { roadmap: row.roadmap } : { code: 'COURSE_LIMIT' };
        return null;
      };
      const existing = await lookup();
      if (existing) return existing;
      if (owner.startsWith('account:')) {
        const saved = await learningWorkspaceStore(settings.databaseUrl).read(owner.slice(8));
        if (saved?.data.learningRoadmap || saved?.data.learningRoadmaps?.length) return { code: 'COURSE_LIMIT' };
      }
      const rows = await sql`INSERT INTO public.mindora_personal_courses (owner, request_key, lease)
        VALUES (${owner}, ${key}, ${lease})
        ON CONFLICT (owner) DO UPDATE SET request_key = excluded.request_key, lease = excluded.lease, started_at = now()
        WHERE mindora_personal_courses.roadmap IS NULL AND mindora_personal_courses.started_at < now() - interval '2 minutes'
        RETURNING owner`;
      if (!rows.length) return await lookup() || { code: 'COURSE_BUSY' };
      try {
        const roadmap = await build();
        const committed = await sql`UPDATE public.mindora_personal_courses SET roadmap = ${JSON.stringify(roadmap)}::jsonb
          WHERE owner = ${owner} AND lease = ${lease} RETURNING owner`;
        return committed.length ? { roadmap } : { code: 'COURSE_BUSY' };
      } catch (err) {
        await sql`DELETE FROM public.mindora_personal_courses WHERE owner = ${owner} AND lease = ${lease} AND roadmap IS NULL`;
        throw err;
      }
    },
  };
}
