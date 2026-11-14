# Account screen integration

The account UI is a presentation layer. It must not store passwords, invent a signed-in session, or claim a profile is saved until the backend confirms it. The learning controller and `mindora.workspace.v1` stay unchanged.

## Expected API

All requests use the same origin and `/api/account`, with `credentials: 'same-origin'`. Mutations send JSON. The server owns authentication, session cookies, validation and profile persistence.

| Request | Body | Successful response |
| --- | --- | --- |
| `GET` | — | `{ available: true, user, profile }` |
| `POST` | `{ action: 'signup', email, password, name, age, gender, interests }` | `{ ok: true, user, profile }` |
| `POST` | `{ action: 'signin', email, password }` | `{ ok: true, user, profile }` |
| `POST` | `{ action: 'signout' }` | `{ ok: true, user: null, profile: null }` |
| `PUT` | `{ name, age, gender, interests }` | `{ ok: true, user, profile }` |

`user` is `{ id, name, email }` or `null`. `profile` is `{ name, age, gender, interests }` or `null`. A signed-out GET returns null for both. An unavailable service may return `{ available: false, user: null, profile: null }`; the UI shows an unavailable state and preserves the form in memory, without pretending signup succeeded.

Errors use an appropriate HTTP status and `{ error: 'Readable message', code: 'MACHINE_CODE' }`. Use 401 for unauthenticated profile writes, 400 for invalid input, 429 for rate limits and 503 for an unavailable service. A failed login must not disclose whether an email exists.

## Profile fields

- `name`: trimmed string, 1–80 characters.
- `age`: optional integer, 1–120, or `null`.
- `gender`: optional; `''`, `woman`, `man`, `nonbinary`, `other`, or `prefer_not_to_say`.
- `interests`: 0–8 strings, each trimmed and 1–40 characters. Custom interests use the same list and validation. Deduplicate case-insensitively.
- `email`: normalized by the server; the form uses an email input and email autocomplete.
- `password`: 8–128 characters; never trim, log, return, or persist it in browser storage. Password confirmation is a client-side check only.

## Backend handoff

The teammate's `origin/feat/learning-experience` branch already supplies `/api/account` and a Neon Auth proxy in `backend/cloud-api.js`. Extend that identity flow; do not create a second login system. Keep its same-origin mutation protection and cookie handling. Profile queries must use the verified session's user ID, never a client-supplied ID.

If account creation succeeds but storing the profile fails, return `{ ok: true, user, profile: null, profilePending: true }` while retaining session cookies. The UI can retry authenticated `PUT` with the still-entered profile, rather than repeating signup. If email verification is required, return `verificationRequired: true` and provide the matching verification screen before claiming the user is signed in.

Verify signup, invalid credentials, signout, refresh/session restoration, profile save/reload, signed-out write rejection and isolation between two accounts when wiring the backend. No backend, database or environment changes are part of this design handoff.
