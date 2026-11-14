import { neon } from '@neondatabase/serverless';

const genders = new Set(['', 'woman', 'man', 'nonbinary', 'other', 'prefer_not_to_say']);
const cleanText = (value, max) => typeof value === 'string' && value.trim().length >= 1
  && value.trim().length <= max && !/[\u0000-\u001f\u007f]/u.test(value) ? value.trim() : null;

export function validateProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const name = cleanText(input.name, 80);
  const age = input.age ?? null;
  const gender = input.gender ?? '';
  const interests = input.interests ?? [];
  if (!name || (age !== null && (!Number.isInteger(age) || age < 1 || age > 120))
    || !genders.has(gender) || !Array.isArray(interests) || interests.length > 8) return null;
  const unique = new Map();
  for (const value of interests) {
    const interest = cleanText(value, 40);
    if (!interest) return null;
    const key = interest.toLowerCase();
    if (!unique.has(key)) unique.set(key, interest);
  }
  return { name, age, gender, interests: [...unique.values()] };
}

export function profileStore(databaseUrl) {
  const sql = neon(databaseUrl);

  async function withTable(query) {
    try {
      return await query();
    } catch (error) {
      if (error.code !== '42P01') throw error;
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(109802193, 4140)`,
        sql`CREATE TABLE IF NOT EXISTS public.mindora_profiles (
          user_id text PRIMARY KEY,
          profile jsonb NOT NULL CHECK (jsonb_typeof(profile) = 'object'),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`,
        sql`REVOKE ALL ON public.mindora_profiles FROM PUBLIC`,
        sql`ALTER TABLE public.mindora_profiles ENABLE ROW LEVEL SECURITY`,
      ]);
      return query();
    }
  }

  return {
    async read(userId) {
      const [row] = await withTable(() => sql`
        SELECT profile FROM public.mindora_profiles WHERE user_id = ${userId}
      `);
      return validateProfile(row?.profile);
    },
    async write(userId, input) {
      const profile = validateProfile(input);
      if (!profile) throw new TypeError('Invalid account profile');
      const [row] = await withTable(() => sql`
        INSERT INTO public.mindora_profiles (user_id, profile)
        VALUES (${userId}, ${JSON.stringify(profile)}::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET profile = EXCLUDED.profile, updated_at = now()
        RETURNING profile
      `);
      const saved = validateProfile(row?.profile);
      if (!saved) throw new Error('Account profile was not saved');
      return saved;
    },
  };
}
