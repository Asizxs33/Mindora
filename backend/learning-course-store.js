import { neon } from '@neondatabase/serverless';
import { isDeepStrictEqual } from 'node:util';
import { restorePlan } from '../core/learning-plan.js';

export const COURSE_MAX_BYTES = 98_304;
export const COURSE_LIST_LIMIT = 100;

export function courseId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

export function normalizeSavedCourse(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > COURSE_MAX_BYTES) return null;
    if (value.answers !== undefined && (!Array.isArray(value.answers)
      || value.answers.some(answer => typeof answer !== 'string' || answer.length > 1500))) return null;
    if (value.reviews !== undefined && !Array.isArray(value.reviews)) return null;
    if (value.study !== undefined && !Array.isArray(value.study)) return null;
    if (value.completed !== undefined && (!Number.isInteger(value.completed) || value.completed < 0)) return null;
    return restorePlan(value);
  } catch { return null; }
}

function courseRow(row) {
  if (!row) return null;
  const saved = normalizeSavedCourse(row.saved);
  if (!saved || !courseId(row.id) || !Number.isInteger(row.revision) || row.revision < 1) {
    throw new Error('Invalid stored course');
  }
  return { id: row.id, saved, revision: row.revision, updatedAt: row.updatedAt };
}

export function learningCourseStore(databaseUrl, { sql = neon(databaseUrl) } = {}) {
  async function withTable(query) {
    try { return await query(); } catch (error) {
      if (error.code !== '42P01') throw error;
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(109802193, 4141)`,
        sql`CREATE TABLE IF NOT EXISTS public.mindora_learning_courses (
          user_id text NOT NULL,
          id uuid NOT NULL,
          saved jsonb NOT NULL CHECK (jsonb_typeof(saved) = 'object'),
          revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, id)
        )`,
        sql`REVOKE ALL ON public.mindora_learning_courses FROM PUBLIC`,
        sql`ALTER TABLE public.mindora_learning_courses ENABLE ROW LEVEL SECURITY`,
      ]);
      return query();
    }
  }

  async function read(userId, id) {
    const [row] = await withTable(() => sql`
      SELECT id, saved, revision, updated_at AS "updatedAt" FROM public.mindora_learning_courses
      WHERE user_id = ${userId} AND id = ${id}::uuid
    `);
    return courseRow(row);
  }

  return {
    async list(userId) {
      // The library shows the 100 most recently updated courses without loading lesson bodies.
      return withTable(() => sql`
        SELECT id, saved->'plan'->>'title' AS title, saved->'plan'->>'goal' AS goal,
          (saved->'plan'->>'minutes')::integer AS minutes, saved->'plan'->>'language' AS language,
          (saved->>'completed')::integer AS completed,
          jsonb_array_length(saved->'plan'->'steps') AS "totalSteps", revision, updated_at AS "updatedAt"
        FROM public.mindora_learning_courses WHERE user_id = ${userId}
        ORDER BY updated_at DESC, id DESC LIMIT ${COURSE_LIST_LIMIT}
      `);
    },
    read,
    async create(userId, id, value) {
      const saved = normalizeSavedCourse(value);
      if (!courseId(id) || !saved) throw new TypeError('Invalid course');
      const [row] = await withTable(() => sql`
        INSERT INTO public.mindora_learning_courses (user_id, id, saved)
        VALUES (${userId}, ${id}::uuid, ${JSON.stringify(saved)}::jsonb)
        RETURNING id, saved, revision, updated_at AS "updatedAt"
      `);
      const result = courseRow(row);
      if (!result) throw new Error('Course was not saved');
      return result;
    },
    async write(userId, id, value, revision) {
      const saved = normalizeSavedCourse(value);
      if (!courseId(id) || !saved || !Number.isInteger(revision) || revision < 1 || revision > 2147483646) {
        throw new TypeError('Invalid course update');
      }
      const [row] = await withTable(() => sql`
        UPDATE public.mindora_learning_courses
        SET saved = ${JSON.stringify(saved)}::jsonb, revision = revision + 1, updated_at = now()
        WHERE user_id = ${userId} AND id = ${id}::uuid AND revision = ${revision}
        RETURNING id, saved, revision, updated_at AS "updatedAt"
      `);
      if (row) return courseRow(row);
      // The previous request may have committed before its acknowledgement was
      // lost on reload. Accept only the same normalized payload; never overwrite
      // a different course state using a stale revision.
      const current = await read(userId, id);
      return current && isDeepStrictEqual(current.saved, saved) ? current : null;
    },
  };
}
